import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StatusBarController } from './statusBar';
import * as yaml from 'yaml';

export function activate(context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const dockerComposePath = path.join(workspaceFolder.uri.fsPath, '.devcontainer', 'docker-compose.yml');
    const statusBarController = new StatusBarController();

    if (fs.existsSync(dockerComposePath)) {
        const deviceIds = getDeviceIdsFromDockerCompose(dockerComposePath);
        if (deviceIds) {
            statusBarController.createStatusBarItem(deviceIds);
        }
    }

    context.subscriptions.push(statusBarController);
}

function getDeviceIdsFromDockerCompose(filePath: string): string | null {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedYaml = yaml.parse(fileContent);
    const deviceIds = parsedYaml?.services?.app?.device_ids;
    return deviceIds ? deviceIds.join(', ') : null;
}

export function deactivate() {}