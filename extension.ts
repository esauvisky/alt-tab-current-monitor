import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Mtk from 'gi://Mtk';

export default class AltTabCurrentMonitorExtension extends Extension {
  private gsettings?: Gio.Settings;
  private originalWindowSwitcherPopupGetWindows: any = null;
  private useMouseMonitor: boolean = false;
  private settingsChangedId: number | null = null;

  enable() {
    this.gsettings = this.getSettings();
    this.useMouseMonitor = this.gsettings.get_boolean('use-mouse-monitor');

    // Save original functions
    this.originalWindowSwitcherPopupGetWindows = AltTab.WindowSwitcherPopup.prototype._getWindowList;
    const originalWindowCyclerPopupGetWindows = AltTab.WindowCyclerPopup.prototype._getWindows;

    // Create a reference to this extension instance for use in the overridden methods
    const self = this;

    // Override WindowSwitcherPopup._getWindowList
    AltTab.WindowSwitcherPopup.prototype._getWindowList = function() {
      const windows = self.originalWindowSwitcherPopupGetWindows.call(this);
      const currentMonitor = self.getCurrentMonitor();
      return windows.filter((window: Meta.Window) => window.get_monitor() === currentMonitor);
    };

    // Override WindowCyclerPopup._getWindows
    AltTab.WindowCyclerPopup.prototype._getWindows = function() {
      const windows = originalWindowCyclerPopupGetWindows.call(this);
      const currentMonitor = self.getCurrentMonitor();
      return windows.filter((window: Meta.Window) => window.get_monitor() === currentMonitor);
    };

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

    // Restore WindowCyclerPopup._getWindows
    // We don't store this in a class property since we don't need it after disable
    const originalWindowCyclerPopupGetWindows = function() {
      return global.display.get_tab_list(Meta.TabList.NORMAL, null);
    };
    AltTab.WindowCyclerPopup.prototype._getWindows = originalWindowCyclerPopupGetWindows;

    // Disconnect settings signal
    if (this.settingsChangedId !== null && this.gsettings) {
      this.gsettings.disconnect(this.settingsChangedId);
      this.settingsChangedId = null;
    }

    this.gsettings = undefined;
  }

  getCurrentMonitor(): number {
    if (this.useMouseMonitor) {
      // Get monitor with mouse pointer
      const [x, y] = global.get_pointer();
      return global.display.get_monitor_index_for_rect(
        new Mtk.Rectangle({ x, y, width: 1, height: 1 })
      );
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

}
