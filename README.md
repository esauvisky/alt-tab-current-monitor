# Alt-Tab Current Monitor

A GNOME Shell extension that makes Alt+Tab only show windows from the current monitor.

## Features

- Makes Alt+Tab only show windows from the current monitor
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
2. Run `make pack` to create a zip file
3. Run `make install` to install the extension

## Configuration

The extension provides a simple settings dialog where you can choose how to determine the "current monitor":

- **Use mouse pointer monitor**: When enabled, the "current monitor" is the one where your mouse pointer is located. When disabled (default), it's the monitor with the focused window.

## License

This extension is licensed under the GPL-3.0 License.

## Author

Emi Bemol ([@esauvisky](https://github.com/esauvisky))
