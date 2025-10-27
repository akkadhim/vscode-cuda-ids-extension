import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec as childExec } from 'child_process';
import { promisify } from 'util';
import { StatusBarController } from './statusBar';
import * as yaml from 'yaml';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        console.log('No workspace folder found');
        return;
    }

    // Only operate when opened inside a devcontainer remote.
    // vscode.env.remoteName is set for remote contexts (e.g. 'dev-container').
    const remoteName = vscode.env.remoteName ?? '';
    console.log(`Remote name: ${remoteName}`);

    const statusBarController = new StatusBarController();

    // Register a simple debug command the user can run to get a helpful message
    // about missing .devcontainer/docker-compose.yml or missing device_ids.
    const debugCmd = vscode.commands.registerCommand('cuda-ids.debugCheck', async () => {
        const cfg = vscode.workspace.getConfiguration('cudaIds');
        const showInAnyRemote = cfg.get<boolean>('showInRemoteHosts', false);
        vscode.window.showInformationMessage(`Remote name: ${remoteName || '<none>'}; showInRemoteHosts: ${showInAnyRemote}`);

        const dockerComposePath = path.join(workspaceFolder.uri.fsPath, '.devcontainer', 'docker-compose.yml');
        if (!fs.existsSync(dockerComposePath)) {
            vscode.window.showInformationMessage('.devcontainer/docker-compose.yml not found in workspace.');
            return;
        }
        const deviceIds = getDeviceIdsFromDockerCompose(dockerComposePath);
        if (!deviceIds) {
            vscode.window.showInformationMessage('docker-compose.yml found but no "device_ids" entry was detected (expected under services.<service>.device_ids).');
            return;
        }
        vscode.window.showInformationMessage(`Found device IDs: ${deviceIds}`);
    });

    context.subscriptions.push(debugCmd);

    // Register command to show live GPU utilization (opens a QuickPick that updates every second).
    const gpuCmd = vscode.commands.registerCommand('cuda-ids.showGpuUtilization', async () => {
        const execP = promisify(childExec);

        // Create a QuickPick so it can stay open and be updated.
        const qp = vscode.window.createQuickPick();
        qp.placeholder = 'GPU utilization (updates every second). Press Esc or click away to close.';
        qp.matchOnDescription = false;
        qp.matchOnDetail = false;
        qp.busy = true;

        let timer: NodeJS.Timeout | undefined;

        async function updateOnce() {
            try {
                qp.busy = true;
                // Query index, name and utilization
                const cmd = 'nvidia-smi --query-gpu=index,name,utilization.gpu --format=csv,noheader,nounits';
                const res = await execP(cmd, { timeout: 2000 });
                const stdout = (res && (res as any).stdout) || '';
                const lines = stdout.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);

                const items: vscode.QuickPickItem[] = lines.map((l: string) => {
                    // CSV line e.g. "0, GeForce GTX 1080 Ti, 12"
                    const parts = l.split(',');
                    const util = parts.pop()?.trim() ?? '';
                    const index = parts.shift()?.trim() ?? '';
                    const name = parts.join(',').trim();

                    const pct = Number(util) || 0;
                    // Use a short 5-block bar with the '❚' glyph for filled segments to match the requested style.
                    const barLen = 5;
                    const filled = Math.round((pct / 100) * barLen);
                    const filledChar = '❚';
                    const emptyChar = '░';
                    const bar = filledChar.repeat(filled) + emptyChar.repeat(Math.max(0, barLen - filled));

                    return { label: `GPU ${index}: ${bar} ${pct}%`, description: name };
                });

                if (items.length === 0) {
                    qp.items = [{ label: 'No GPUs detected or nvidia-smi output empty', description: '' }];
                } else {
                    qp.items = items;
                }
            } catch (err) {
                qp.items = [{ label: 'Failed to run nvidia-smi or no GPUs found', description: String((err as any)?.message ?? err) }];
                // stop updates if command fails repeatedly
                if (timer) {
                    clearInterval(timer);
                    timer = undefined;
                }
            } finally {
                qp.busy = false;
            }
        }

        qp.onDidHide(() => {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
            qp.dispose();
        });

        qp.show();
        await updateOnce();
        // set interval to refresh every 1s
        timer = setInterval(() => void updateOnce(), 1000);
    });

    context.subscriptions.push(gpuCmd);

    // Respect user configuration: allow showing on any remote host if enabled.
    const cfg = vscode.workspace.getConfiguration('cudaIds');
    const showInAnyRemote = cfg.get<boolean>('showInRemoteHosts', false);

    if (!showInAnyRemote) {
        // If the user did not opt-in, only show when running inside a devcontainer remote.
        if (!remoteName.toLowerCase().includes('dev-container') && !remoteName.toLowerCase().includes('devcontainer')) {
            console.log('Not running inside a dev container. Status bar will remain hidden.');
            context.subscriptions.push(statusBarController);
            return;
        }
    } else {
        // showInAnyRemote=true: allow running on any remote host (SSH, containers, etc.).
        console.log(`showInRemoteHosts is enabled; remoteName='${remoteName}'`);
    }

    const dockerComposePath = path.join(workspaceFolder.uri.fsPath, '.devcontainer', 'docker-compose.yml');
    console.log(`Docker Compose Path: ${dockerComposePath}`);

    if (fs.existsSync(dockerComposePath)) {
        const deviceIds = getDeviceIdsFromDockerCompose(dockerComposePath);
        if (deviceIds) {
            // Check for CUDA availability and append a helpful note if missing.
            const hasCuda = await checkCudaAvailable();
            if (hasCuda) {
                statusBarController.createStatusBarItem(deviceIds);
            } else {
                statusBarController.createStatusBarItem(deviceIds, '(No CUDA engine)');
            }
        } else {
            console.log('No device IDs found in docker-compose.yml');
            // If the user opted into showing on any remote host, give a helpful message.
            const cfg = vscode.workspace.getConfiguration('cudaIds');
            const showInAnyRemote = cfg.get<boolean>('showInRemoteHosts', false);
            if (showInAnyRemote) {
                const choice = await vscode.window.showInformationMessage(
                    'docker-compose.yml found but no "device_ids" entry was detected. The extension will not show device IDs.',
                    'Open Settings',
                    'Run Debug Check'
                );
                if (choice === 'Open Settings') {
                    // Open the Settings UI focused on this setting
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'cudaIds.showInRemoteHosts');
                } else if (choice === 'Run Debug Check') {
                    await vscode.commands.executeCommand('cuda-ids.debugCheck');
                }
            }
        }
    } else {
        console.log('docker-compose.yml not found');
        const cfg = vscode.workspace.getConfiguration('cudaIds');
        const showInAnyRemote = cfg.get<boolean>('showInRemoteHosts', false);
        if (showInAnyRemote) {
            const choice = await vscode.window.showInformationMessage(
                '.devcontainer/docker-compose.yml not found in workspace. The extension requires this file with a `device_ids` entry to show CUDA IDs.',
                'Open Settings',
                'Run Debug Check'
            );
            if (choice === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'cudaIds.showInRemoteHosts');
            } else if (choice === 'Run Debug Check') {
                await vscode.commands.executeCommand('cuda-ids.debugCheck');
            }
        }
    }

    context.subscriptions.push(statusBarController);
}

function getDeviceIdsFromDockerCompose(filePath: string): string | null {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsedYaml = yaml.parse(fileContent) as any;
        // Deep-search for device_ids or devices anywhere under services.
        const services = parsedYaml?.services ?? {};

        const found: string[] = [];

        function collectDeviceIds(node: any) {
            if (node == null) return;
            if (Array.isArray(node)) {
                for (const item of node) collectDeviceIds(item);
                return;
            }
            if (typeof node === 'object') {
                for (const key of Object.keys(node)) {
                    const lower = key.toLowerCase();
                    const val = node[key];
                    if (lower === 'device_ids' || lower === 'device-ids' || lower === 'deviceids') {
                        if (Array.isArray(val)) {
                            for (const v of val) found.push(String(v));
                        } else if (val != null) {
                            found.push(String(val));
                        }
                    } else if (lower === 'devices') {
                        // devices could be an array of strings or objects which may contain device_ids
                        if (Array.isArray(val)) {
                            for (const dv of val) {
                                if (typeof dv === 'string') {
                                    // strings like "/dev/nvidia0" — include as-is
                                    found.push(dv);
                                } else {
                                    collectDeviceIds(dv);
                                }
                            }
                        } else {
                            collectDeviceIds(val);
                        }
                    } else {
                        collectDeviceIds(val);
                    }
                }
            }
        }

        for (const svcName of Object.keys(services)) {
            collectDeviceIds(services[svcName]);
            if (found.length) break;
        }

        if (found.length) {
            return found.join(', ');
        }
    } catch (err) {
        console.error('Failed to read/parse docker-compose.yml', err);
    }
    return null;
}

async function checkCudaAvailable(): Promise<boolean> {
    // try to run `nvidia-smi -L` to detect NVIDIA GPUs
    const execP = promisify(childExec);
    try {
        const result = await execP('nvidia-smi -L', { timeout: 3000 });
        const stdout = (result && (result as any).stdout) || '';
        if (stdout && String(stdout).trim().length > 0) {
            return true;
        }
    } catch (err) {
        // command not found or returned non-zero — assume no CUDA available
        console.log('nvidia-smi check failed or not present:', (err as any)?.message ?? String(err));
    }
    return false;
}

export function deactivate() {}