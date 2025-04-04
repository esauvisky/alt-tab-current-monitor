import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class AltTabCurrentMonitorExtension extends Extension {
  private gsettings?: Gio.Settings;
  private originalWindowSwitcherPopupGetWindows: Function | null = null;
  private originalAppSwitcherPopupGetWindows: Function | null = null;
  private useMouseMonitor: boolean = false;
  private settingsChangedId: number | null = null;

  enable() {
    this.gsettings = this.getSettings();
    this.useMouseMonitor = this.gsettings.get_boolean('use-mouse-monitor');

    // Save original functions
    this.originalWindowSwitcherPopupGetWindows = AltTab.WindowSwitcherPopup.prototype._getWindowList;
    this.originalAppSwitcherPopupGetWindows = AltTab.AppSwitcherPopup.prototype._getWindowList;

    // Override window list functions to filter by current monitor
    AltTab.WindowSwitcherPopup.prototype._getWindowList = () => this.getFilteredWindowList();
    AltTab.AppSwitcherPopup.prototype._getWindowList = () => this.getFilteredWindowList();

    // Listen for settings changes
    this.settingsChangedId = this.gsettings.connect('changed::use-mouse-monitor', () => {
      this.useMouseMonitor = this.gsettings!.get_boolean('use-mouse-monitor');
    });
  }

  disable() {
    // Restore original functions
    if (this.originalWindowSwitcherPopupGetWindows) {
      AltTab.WindowSwitcherPopup.prototype._getWindowList = this.originalWindowSwitcherPopupGetWindows;
      this.originalWindowSwitcherPopupGetWindows = null;
    }

    if (this.originalAppSwitcherPopupGetWindows) {
      AltTab.AppSwitcherPopup.prototype._getWindowList = this.originalAppSwitcherPopupGetWindows;
      this.originalAppSwitcherPopupGetWindows = null;
    }

    // Disconnect settings signal
    if (this.settingsChangedId !== null && this.gsettings) {
      this.gsettings.disconnect(this.settingsChangedId);
      this.settingsChangedId = null;
    }

    this.gsettings = undefined;
  }

  private getCurrentMonitor(): number {
    if (this.useMouseMonitor) {
      // Get monitor with mouse pointer
      const [x, y] = global.get_pointer();
      return global.display.get_monitor_index_for_point(x, y);
    } else {
      // Get monitor with focused window
      const focusedWindow = global.display.focus_window;
      if (focusedWindow) {
        return focusedWindow.get_monitor();
      }
      
      // Fallback to primary monitor if no window is focused
      return global.display.get_primary_monitor();
    }
  }

  private getFilteredWindowList(): Meta.Window[] {
    // Get all windows from the original function
    const windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
    
    // Get current monitor index
    const currentMonitor = this.getCurrentMonitor();
    
    // Filter windows to only include those on the current monitor
    return windows.filter(window => {
      return window.get_monitor() === currentMonitor;
    });
  }
}
