# VS Code CUDA Device IDs Extension

This extension displays CUDA device IDs in the status bar of Visual Studio Code. It reads the `device_ids` from the `.devcontainer/docker-compose.yml` file, allowing users to quickly see the available device IDs while working in their development environment.

## Features

- Displays device IDs in the status bar.
- Automatically updates when the `docker-compose.yml` file changes.
- Only activates if a valid `docker-compose.yml` file with `device_ids` is present.

## Requirements

- Visual Studio Code
- A valid `.devcontainer/docker-compose.yml` file with a `device_ids` section.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/akkadhim/vscode-cuda-ids-extension.git
   ```

2. Open the project in Visual Studio Code.

3. Install the dependencies:
   ```
   npm install
   ```

4. Press `F5` to run the extension in a new Extension Development Host window.

## Usage

Once the extension is activated, the CUDA device IDs will be displayed in the status bar. If the `device_ids` section in the `docker-compose.yml` file is updated, the status bar will reflect the changes automatically.

## Packaging & Publishing (helper script)

This repository includes a helper PowerShell script at `scripts/publish.ps1` to simplify packaging and publishing.

Basic usage (from repository root):

- Create a patch bump, compile and package (.vsix) without publishing:

```powershell
.\scripts\publish.ps1 -Bump patch -PackageOnly
```

- Package only (no version bump):

```powershell
.\scripts\publish.ps1 -Bump none -PackageOnly
```

- Bump, package and publish to the Marketplace (the script will prompt for your VSCE PAT):

```powershell
.\scripts\publish.ps1 -Bump patch -Publish
```

Notes:
- The script edits `package.json` to bump the version (no git commits or tags are created); commit and push manually from VS Code when ready.
- To publish, you need a Personal Access Token (PAT) for Marketplace publishing. The script will prompt securely if you don't pass `-PAT`.
- The script writes `package.json` without a UTF-8 BOM to avoid packaging errors.

If you prefer to package manually:

```powershell
# compile
npm run compile
# package
npx vsce package
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for details.