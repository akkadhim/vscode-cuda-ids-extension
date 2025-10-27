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

    // If not inside a devcontainer, do not show anything in the status bar.
    if (!remoteName.toLowerCase().includes('dev-container') && !remoteName.toLowerCase().includes('devcontainer')) {
        console.log('Not running inside a dev container. Status bar will remain hidden.');
        context.subscriptions.push(statusBarController);
        return;
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
        }
    } else {
        console.log('docker-compose.yml not found');
    }

    context.subscriptions.push(statusBarController);
}

function getDeviceIdsFromDockerCompose(filePath: string): string | null {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsedYaml = yaml.parse(fileContent) as any;

        // Try to locate device_ids under any service.
        const services = parsedYaml?.services ?? {};
        for (const svcName of Object.keys(services)) {
            const svc = services[svcName];
            const deviceIds = svc?.device_ids ?? svc?.devices ?? null;
            if (deviceIds) {
                if (Array.isArray(deviceIds)) {
                    return deviceIds.join(', ');
                }
                return String(deviceIds);
            }
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