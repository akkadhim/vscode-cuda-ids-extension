import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StatusBarController } from './statusBar';
import * as yaml from 'yaml';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        console.log('No workspace folder found');
        return;
    }

    const dockerComposePath = path.join(workspaceFolder.uri.fsPath, '.devcontainer', 'docker-compose.yml');
    console.log(`Docker Compose Path: ${dockerComposePath}`);
    const statusBarController = new StatusBarController();

    if (fs.existsSync(dockerComposePath)) {
        const deviceIds = getDeviceIdsFromDockerCompose(dockerComposePath);
        if (deviceIds) {
            statusBarController.createStatusBarItem(deviceIds);
        } else {
            console.log('No device IDs found in docker-compose.yml');
        }
    } else {
        console.log('docker-compose.yml not found');
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