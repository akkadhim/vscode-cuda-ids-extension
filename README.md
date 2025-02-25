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
   git clone https://github.com/akkadhim/vscode-cuda-ids.git
   ```

2. Open the project in Visual Studio Code.

3. Install the dependencies:
   ```
   npm install
   ```

4. Press `F5` to run the extension in a new Extension Development Host window.

## Usage

Once the extension is activated, the CUDA device IDs will be displayed in the status bar. If the `device_ids` section in the `docker-compose.yml` file is updated, the status bar will reflect the changes automatically.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for details.