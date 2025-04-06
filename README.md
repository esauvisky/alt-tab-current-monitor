# Alt-Tab Current Monitor

A GNOME Shell extension that makes Alt+Tab only show windows from the current monitor and workspace.

## Features

- Makes Alt+Tab only show windows from the current monitor
- Option to only show windows from the current workspace
- Maintains focus on the current monitor when switching workspaces
- Works with both window switcher and app switcher
- Option to define "current monitor" as either:
  - The monitor where the mouse pointer is located
  - The monitor with the focused window (default)
- Particularly useful for multi-monitor setups with "Workspaces on primary display only" enabled

## Installation

### From GNOME Extensions Website
Visit [extensions.gnome.org](https://extensions.gnome.org) and search for "Alt-Tab Current Monitor"

### Manual Installation
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run pack` to create a zip file
4. Run `npm run install-extension` to install the extension

## Configuration

The extension provides several configuration options:

### Monitor Selection
- **Use mouse pointer monitor**: When enabled, the "current monitor" is the one where your mouse pointer is located. When disabled (default), it's the monitor with the focused window.

### Window Behavior
- **Current workspace only**: When enabled, Alt+Tab will only show windows from the current workspace.
- **Keep focus on current monitor when switching workspaces**: Prevents focus from jumping to windows on other monitors when switching workspaces.

### Debugging
- **Enable debugging logs**: Enables detailed logging for troubleshooting issues.

## Compatibility

Compatible with GNOME Shell 46, 47, and 48.

## License

This extension is licensed under the GPL-3.0 License.

## Author

Emi Bemol ([@esauvisky](https://github.com/esauvisky))
