# VS Code CUDA Device IDs Extension

A small VS Code extension that shows CUDA device IDs in the status bar by reading the
`device_ids` entry from your `.devcontainer/docker-compose.yml`. It's useful when you
work with development containers or remote hosts that expose NVIDIA GPUs — the status
bar shows which GPU device IDs are available so you can quickly reference them.

## Quick overview (for users)

- What it shows: `CUDA IDs: <ids>` in the left status bar when `device_ids` are detected.
- Where it reads IDs from: `.devcontainer/docker-compose.yml` (supports nested locations such as `deploy.resources.reservations.devices[*].device_ids`).
- Default behavior: the extension is allowed to run on remote extension hosts by default. You can opt out via settings.
- Debug helper: Command Palette → `CUDA Device IDs: Debug Check` — shows remote name and whether device IDs were found.

## Usage

1. Make sure your workspace contains `.devcontainer/docker-compose.yml` with a `device_ids` entry under a service (examples below).
2. The extension will automatically parse the file and show `CUDA IDs: <ids>` in the status bar.
3. If CUDA is not available on the host, the extension appends `(No CUDA engine)` to the status text.

Quick example of supported YAML (simple and nested examples):

Simple:
```yaml
services:
   app:
      device_ids: ["0", "1"]
```

Nested (deploy -> resources -> reservations -> devices[*] -> device_ids):
```yaml
services:
   app:
      deploy:
         resources:
            reservations:
               devices:
                  - driver: nvidia
                     capabilities: [gpu]
                     device_ids: ["2"]
```

## Quick settings & requirements

- Requirements: Visual Studio Code and a workspace with `.devcontainer/docker-compose.yml` that contains `device_ids` (or nested `devices` entries).
- Enable/disable remotely: Setting `cudaIds.showInRemoteHosts` controls whether the extension runs on remote hosts (default: true).
   - Settings UI: File → Preferences → Settings and search for "CUDA Device IDs" or "Show In Remote Hosts".
   - Settings JSON: add `"cudaIds.showInRemoteHosts": true` to your settings.

## Development (how to run locally)

1. Clone the repository and open it in VS Code:
```powershell
git clone https://github.com/akkadhim/vscode-cuda-ids-extension.git
cd vscode-cuda-ids-extension
npm install
```
2. Press `F5` in VS Code to run the extension in an Extension Development Host window.

## Packaging & publishing

This repo includes a helper PowerShell script at `scripts/publish.ps1` that automates version bumping (edits `package.json`), compiling, packaging and optionally publishing. Examples:

```powershell
# package (no publish)
.\scripts\publish.ps1 -Bump none -PackageOnly

# bump patch, package and publish (prompts for PAT)
.\scripts\publish.ps1 -Bump patch -Publish
```

Notes:
- The helper script edits `package.json` but does not commit or push — commit/push manually from VS Code when you're ready.
- The script also writes `package.json` without a UTF-8 BOM to avoid packaging errors.
- If you prefer manual packaging:
```powershell
npm run compile
npx vsce package
```

## Contributing

Contributions are welcome. Feel free to open issues or pull requests.

## License

MIT — see the LICENSE file for details.