import * as vscode from 'vscode';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    // text: main text to show (e.g. device ids). suffix: optional small note like '(No CUDA engine)'.
    public createStatusBarItem(text: string, suffix?: string) {
        const suffixPart = suffix ? ` ${suffix}` : '';
        this.statusBarItem.text = `CUDA IDs: ${text}${suffixPart}`;
        this.statusBarItem.tooltip = suffix ? `Note: ${suffix.replace(/^\s*/, '')}` : `CUDA IDs: ${text}`;
        // Attach a click command that shows GPU utilization details.
        this.statusBarItem.command = 'cuda-ids.showGpuUtilization';
        this.statusBarItem.show();
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}