import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Mtk from 'gi://Mtk';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WindowManager from 'resource:///org/gnome/shell/ui/windowManager.js';
import GLib from 'gi://GLib';

export default class AltTabCurrentMonitorExtension extends Extension {
  private gsettings?: Gio.Settings;
  private originalWindowSwitcherPopupGetWindows: any = null;
  private useMouseMonitor: boolean = false;
  private currentWorkspaceOnly: boolean = true;
  private preventFocusOnOtherDisplays: boolean = true;
  private settingsChangedId: number[] = [];
  private timeoutId: number = 0;

  // Original methods we'll override
  private actionMoveWorkspaceOriginal: any = null;

  enable() {
    this.gsettings = this.getSettings();
    this.useMouseMonitor = this.gsettings.get_boolean('use-mouse-monitor');
    this.currentWorkspaceOnly = this.gsettings.get_boolean('current-workspace-only');
    this.preventFocusOnOtherDisplays = this.gsettings.get_boolean('prevent-focus-on-other-displays');

    log(`[alt-tab-current-monitor] Extension enabled with settings:`);
    log(`[alt-tab-current-monitor]   useMouseMonitor: ${this.useMouseMonitor}`);
    log(`[alt-tab-current-monitor]   currentWorkspaceOnly: ${this.currentWorkspaceOnly}`);
    log(`[alt-tab-current-monitor]   preventFocusOnOtherDisplays: ${this.preventFocusOnOtherDisplays}`);

    // Save original functions
    this.originalWindowSwitcherPopupGetWindows = AltTab.WindowSwitcherPopup.prototype._getWindowList;
    const originalWindowCyclerPopupGetWindows = AltTab.WindowCyclerPopup.prototype._getWindows;

    // Create a reference to this extension instance for use in the overridden methods
    const self = this;

    // Override WindowSwitcherPopup._getWindowList
    AltTab.WindowSwitcherPopup.prototype._getWindowList = function() {
      const windows = self.originalWindowSwitcherPopupGetWindows.call(this);
      return self.filterWindows(windows);
    };

    // Override WindowCyclerPopup._getWindows
    AltTab.WindowCyclerPopup.prototype._getWindows = function() {
      const windows = originalWindowCyclerPopupGetWindows.call(this);
      return self.filterWindows(windows);
    };

    // Listen for settings changes
    this.settingsChangedId.push(
      this.gsettings.connect('changed::use-mouse-monitor', () => {
        this.useMouseMonitor = this.gsettings!.get_boolean('use-mouse-monitor');
      })
    );

    this.settingsChangedId.push(
      this.gsettings.connect('changed::current-workspace-only', () => {
        this.currentWorkspaceOnly = this.gsettings!.get_boolean('current-workspace-only');
      })
    );

    this.settingsChangedId.push(
      this.gsettings.connect('changed::prevent-focus-on-other-displays', () => {
        this.preventFocusOnOtherDisplays = this.gsettings!.get_boolean('prevent-focus-on-other-displays');
        this._setupWorkspaceSwitchHandlers();
      })
    );

    // Set up workspace switching handlers if enabled
    if (this.preventFocusOnOtherDisplays) {
      this._setupWorkspaceSwitchHandlers();
    }
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

    // Restore workspace switching methods
    if (this.actionMoveWorkspaceOriginal) {
      WindowManager.WindowManager.prototype.actionMoveWorkspace = this.actionMoveWorkspaceOriginal;
      this.actionMoveWorkspaceOriginal = null;
    }

    // Disconnect settings signals
    if (this.gsettings) {
      this.settingsChangedId.forEach(id => {
        this.gsettings!.disconnect(id);
      });
      this.settingsChangedId = [];
    }

    // Clear any pending timeouts
    this._clearTimeout();

    this.gsettings = undefined;
  }

  filterWindows(windows: Meta.Window[]): Meta.Window[] {
    // Filter by monitor
    const currentMonitor = this.getCurrentMonitor();
    let filtered = windows.filter(window => window.get_monitor() === currentMonitor);

    // Filter by workspace if enabled
    if (this.currentWorkspaceOnly) {
      const activeWorkspace = global.workspace_manager.get_active_workspace();
      filtered = filtered.filter(window => window.get_workspace() === activeWorkspace);
    }

    return filtered;
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

  private _setupWorkspaceSwitchHandlers(): void {
    log(`[alt-tab-current-monitor] Setting up workspace switch handlers, preventFocusOnOtherDisplays: ${this.preventFocusOnOtherDisplays}`);

    if (!this.preventFocusOnOtherDisplays) {
      log(`[alt-tab-current-monitor] Feature disabled, not setting up handlers`);
      return;
    }

    // Override actionMoveWorkspace to handle keyboard shortcuts and UI buttons
    this.actionMoveWorkspaceOriginal = WindowManager.WindowManager.prototype.actionMoveWorkspace;

    const self = this;
    WindowManager.WindowManager.prototype.actionMoveWorkspace = function(workspace) {
      log(`[alt-tab-current-monitor] actionMoveWorkspace called`);
      self.actionMoveWorkspaceOriginal.apply(this, arguments);

      // Focus a window on the current monitor after workspace switch
      self._focusWindowOnCurrentMonitor().catch(error =>
        console.error('[alt-tab-current-monitor] Error focusing window:', error)
      );
    };


    log(`[alt-tab-current-monitor] Workspace switch handlers set up`);
  }


  /**
   * Focus a window on the current monitor after workspace switch
   */
  private async _focusWindowOnCurrentMonitor(): Promise<void> {
    log(`[alt-tab-current-monitor] Focusing window on current monitor`);

    // Wait a tick for the workspace switch to complete
    // await this._tick();

    // Get the current monitor
    const currentMonitor = this.getCurrentMonitor();
    log(`[alt-tab-current-monitor] Current monitor: ${currentMonitor}`);

    // Get the focused window
    const focusedWindow = global.display.focus_window;
    log(`[alt-tab-current-monitor] Focused window: ${focusedWindow ?
      `${focusedWindow.get_title()} (monitor: ${focusedWindow.get_monitor()})` : 'none'}`);

    // If there's no focused window or it's on a different monitor, find a window to focus
    if (!focusedWindow || focusedWindow.get_monitor() !== currentMonitor) {
      log(`[alt-tab-current-monitor] Need to find a window to focus on monitor ${currentMonitor}`);

      // Get all windows on the current workspace and monitor
      const activeWorkspace = global.workspace_manager.get_active_workspace();
      if (!activeWorkspace) {
        log(`[alt-tab-current-monitor] Couldn't find active workspace`);
        return;
      }

      // Get windows using the same approach as AltTab
      const windows = this._getWindowsForWorkspace(activeWorkspace);
      log(`[alt-tab-current-monitor] Total windows on active workspace: ${windows.length}`);

      const windowsOnCurrentMonitor = windows.filter(window =>
        window.get_monitor() === currentMonitor &&
        !window.is_skip_taskbar()
      );

      log(`[alt-tab-current-monitor] Windows on current monitor ${currentMonitor}: ${windowsOnCurrentMonitor.length}`);
      windowsOnCurrentMonitor.forEach((window, i) => {
        log(`[alt-tab-current-monitor]   Window ${i+1}: ${window.get_title()} (user_time: ${window.get_user_time()})`);
      });

      // Sort windows by most recently used
      windowsOnCurrentMonitor.sort((a, b) => {
        return b.get_user_time() - a.get_user_time();
      });

      // Focus the most recently used window on the current monitor
      if (windowsOnCurrentMonitor.length > 0) {
        const windowToFocus = windowsOnCurrentMonitor[0];
        log(`[alt-tab-current-monitor] Focusing window: ${windowToFocus.get_title()}`);
        Main.activateWindow(windowToFocus);
      } else {
        log(`[alt-tab-current-monitor] No suitable windows found to focus on monitor ${currentMonitor}. unfocusing everything`);
        Main.activateWindow(null);
      }
    } else {
      log(`[alt-tab-current-monitor] Focused window already on current monitor, no action needed`);
    }
  }

  /**
   * Get windows for a workspace, handling attached dialogs properly
   */
  private _getWindowsForWorkspace(workspace: Meta.Workspace): Meta.Window[] {
    // We ignore skip-taskbar windows in switchers, but if they are attached
    // to their parent, their position in the MRU list may be more appropriate
    // than the parent; so start with the complete list...
    let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);

    // ... map windows to their parent where appropriate...
    return windows
      .map(w => {
        if (w.is_attached_dialog()) {
          const parent = w.get_transient_for();
          return parent || w; // Return original window if no parent found
        }
        return w;
      })
      // ... and filter out skip-taskbar windows and duplicates
      .filter((w, i, a) => !w.skip_taskbar && a.indexOf(w) === i);
  }

  /**
   * Wait for the next tick in the event loop
   */
  private _tick(): Promise<void> {
    return new Promise((resolve) => {
      this._clearTimeout();
      this.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 0, () => {
        this.timeoutId = 0;
        resolve();
        return GLib.SOURCE_REMOVE;
      });
    });
  }

  /**
   * Clear any pending timeout
   */
  private _clearTimeout(): void {
    if (this.timeoutId !== 0) {
      GLib.Source.remove(this.timeoutId);
      this.timeoutId = 0;
    }
  }
}
