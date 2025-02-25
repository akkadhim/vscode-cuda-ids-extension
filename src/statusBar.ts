import * as vscode from 'vscode';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    public createStatusBarItem(text: string) {
        this.statusBarItem.text = `CUDA IDs: ${text}`;
        this.statusBarItem.show();
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}