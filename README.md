# Alt-Tab Current Monitor

A GNOME Shell extension that makes Alt+Tab only show windows from the current monitor and workspace.

## Features

- **Monitor-Specific Alt+Tab**: Only shows windows from your current monitor in Alt+Tab
- **Cross-Monitor Switching**: Hold a modifier key (Shift by default) with Alt+Tab to see windows from other monitors
- **Focus Protection**: Maintains focus on the current monitor when switching workspaces
- **Multiple Switcher Support**: Works with both window switcher and app switcher
- **Flexible Monitor Detection**: Choose how to determine your "current" monitor:
  - By mouse pointer location (default)
  - By focused window location

## Why You Need This

If you use multiple monitors, you've probably experienced the frustration of Alt+Tab showing windows from all monitors, making it difficult to quickly switch between applications on your current screen. This extension solves that problem by:

1. Limiting Alt+Tab to only show windows from the monitor you're currently using
2. Preventing focus from jumping between monitors when switching workspaces
3. Creating a more predictable window switching experience

This is especially useful for multi-monitor setups with "Workspaces on primary display only" enabled.

## Installation

### From GNOME Extensions Website
Visit [extensions.gnome.org](https://extensions.gnome.org) and search for "Alt-Tab Current Monitor"

### Manual Installation
1. Clone this repository: `git clone https://github.com/esauvisky/alt-tab-current-monitor.git`
2. Install dependencies: `npm install`
3. Build and pack: `npm run pack`
4. Install the extension: `npm run install-extension`

## Configuration

### Monitor Selection
- **Use mouse pointer monitor**: When enabled (default), the "current monitor" is determined by your mouse pointer location. When disabled, it uses the monitor containing the focused window.

### Window Behavior
- **Keep focus on current monitor when switching workspaces**: Prevents focus from jumping to windows on other monitors when switching workspaces.
- **Modifier key for other monitors**: Hold this key (Shift by default) while using Alt+Tab to show windows from monitors other than your current one.

### Debugging
- **Enable debugging logs**: Enables detailed logging for troubleshooting.
  - View logs with: `journalctl -f -o cat /usr/bin/gnome-shell`

## Compatibility

Compatible with GNOME Shell 46, 47, and 48.

## Troubleshooting

If you experience any issues:

1. Enable debugging logs in the extension preferences
2. Check the logs with: `journalctl -f -o cat /usr/bin/gnome-shell`
3. [Open an issue](https://github.com/esauvisky/alt-tab-current-monitor/issues) with the log output

## License

This extension is licensed under the GPL-3.0 License.

## Author

Emi Bemol ([@esauvisky](https://github.com/esauvisky))
