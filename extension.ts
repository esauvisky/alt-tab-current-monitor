import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Mtk from 'gi://Mtk';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WindowManager from 'resource:///org/gnome/shell/ui/windowManager.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export default class AltTabCurrentMonitorExtension extends Extension {
  private gsettings?: Gio.Settings;
  private originalWindowSwitcherPopupGetWindows: any = null;
  private originalWindowCyclerPopupGetWindows: any = null;
  private useMouseMonitor: boolean = true;
  private preventFocusOnOtherDisplays: boolean = true;
  private enableDebugging: boolean = false;
  private otherMonitorsModifierKey: string = 'Control';
  private settingsChangedId: number[] = [];
  private timeoutId: number = 0;

  // Original methods we'll override
  private actionMoveWorkspaceOriginal: any = null;

  // Log colors
  private readonly LOG_PREFIX = '[alt-tab-current-monitor]';
  private readonly COLOR_INFO = '\x1b[36m'; // Cyan
  private readonly COLOR_SUCCESS = '\x1b[32m'; // Green
  private readonly COLOR_WARNING = '\x1b[33m'; // Yellow
  private readonly COLOR_ERROR = '\x1b[31m'; // Red
  private readonly COLOR_HIGHLIGHT = '\x1b[35m'; // Magenta
  private readonly COLOR_RESET = '\x1b[0m';

  enable() {
    this.gsettings = this.getSettings();
    this.useMouseMonitor = this.gsettings.get_boolean('use-mouse-monitor');
    this.preventFocusOnOtherDisplays = this.gsettings.get_boolean('prevent-focus-on-other-displays');
    this.enableDebugging = this.gsettings.get_boolean('enable-debugging');
    this.otherMonitorsModifierKey = this.gsettings.get_string('other-monitors-modifier-key');

    this.logInfo('Extension enabled with settings:');
    this.logInfo(`  useMouseMonitor: ${this.useMouseMonitor}`);
    this.logInfo(`  preventFocusOnOtherDisplays: ${this.preventFocusOnOtherDisplays}`);
    this.logInfo(`  enableDebugging: ${this.enableDebugging}`);
    this.logInfo(`  otherMonitorsModifierKey: ${this.otherMonitorsModifierKey}`);

    // Save original functions
    this.originalWindowSwitcherPopupGetWindows = AltTab.WindowSwitcherPopup.prototype._getWindowList;
    this.originalWindowCyclerPopupGetWindows = AltTab.WindowCyclerPopup.prototype._getWindows;

    // Create a reference to this extension instance for use in the overridden methods
    const self = this;

    // Override WindowSwitcherPopup._getWindowList
    AltTab.WindowSwitcherPopup.prototype._getWindowList = function() {
      const windows = self.originalWindowSwitcherPopupGetWindows.call(this);
      return self.filterWindows(windows);
    };

    // Override WindowCyclerPopup._getWindows
    AltTab.WindowCyclerPopup.prototype._getWindows = function() {
      const windows = self.originalWindowCyclerPopupGetWindows.call(this);
      return self.filterWindows(windows);
    };

    // Listen for settings changes
    this.settingsChangedId.push(
      this.gsettings.connect('changed::use-mouse-monitor', () => {
        this.useMouseMonitor = this.gsettings!.get_boolean('use-mouse-monitor');
        this.logInfo(`Setting changed: useMouseMonitor = ${this.useMouseMonitor}`);
      })
    );


    this.settingsChangedId.push(
      this.gsettings.connect('changed::prevent-focus-on-other-displays', () => {
        this.preventFocusOnOtherDisplays = this.gsettings!.get_boolean('prevent-focus-on-other-displays');
        this.logInfo(`Setting changed: preventFocusOnOtherDisplays = ${this.preventFocusOnOtherDisplays}`);
        this._setupWorkspaceSwitchHandlers();
      })
    );

    this.settingsChangedId.push(
      this.gsettings.connect('changed::enable-debugging', () => {
        this.enableDebugging = this.gsettings!.get_boolean('enable-debugging');
        this.logInfo(`Setting changed: enableDebugging = ${this.enableDebugging}`);
      })
    );

    this.settingsChangedId.push(
      this.gsettings.connect('changed::other-monitors-modifier-key', () => {
        this.otherMonitorsModifierKey = this.gsettings!.get_string('other-monitors-modifier-key');
        this.logInfo(`Setting changed: otherMonitorsModifierKey = ${this.otherMonitorsModifierKey}`);
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
    if (this.originalWindowCyclerPopupGetWindows) {
      AltTab.WindowCyclerPopup.prototype._getWindows = this.originalWindowCyclerPopupGetWindows;
      this.originalWindowCyclerPopupGetWindows = null;
    }

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
    // Get the current state of the modifier key
    const modifierState = global.get_pointer()[2];
    const modifierActive = this.isModifierActive(modifierState);

    // Get the current monitor
    const currentMonitor = this.getCurrentMonitor();

    // Always filter by workspace
    const activeWorkspace = global.workspace_manager.get_active_workspace();
    let filtered = windows.filter(window => window.get_workspace() === activeWorkspace);

    // If the modifier key is active and configured, show windows from other monitors
    if (modifierActive && this.otherMonitorsModifierKey) {
      this.logDebug(`Modifier key (${this.otherMonitorsModifierKey}) is active, showing windows from other monitors`);
      filtered = filtered.filter(window => window.get_monitor() !== currentMonitor);
    } else {
      // Default behavior: only show windows from the current monitor
      filtered = filtered.filter(window => window.get_monitor() === currentMonitor);
    }

    return filtered;
  }

  /**
   * Check if the configured modifier key is active
   */
  private isModifierActive(modifierState: number): boolean {
    // Map modifier key names to their mask values
    const modifierMap: {[key: string]: number} = {
      'Shift': Clutter.ModifierType.SHIFT_MASK,
      'Control': Clutter.ModifierType.CONTROL_MASK,
      'Alt': Clutter.ModifierType.MOD1_MASK,
      'Super': Clutter.ModifierType.SUPER_MASK,
      'Hyper': Clutter.ModifierType.HYPER_MASK,
      'Caps Lock': Clutter.ModifierType.LOCK_MASK,
      'Meta': Clutter.ModifierType.META_MASK,
    };

    this.logDebug(`Modifier state: ${modifierState} (${modifierMap[modifierState]}). Preference: ${this.otherMonitorsModifierKey}`);
    if (!this.otherMonitorsModifierKey || this.otherMonitorsModifierKey === '') {
      return false;
    }


    const mask = modifierMap[this.otherMonitorsModifierKey];
    if (mask === undefined) {
      this.logWarning(`Unknown modifier key: ${this.otherMonitorsModifierKey}`);
      return false;
    }

    return (modifierState & mask) !== 0;
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
      this.logWarning('No focused window, falling back to primary monitor');
      return global.display.get_primary_monitor();
    }
  }

  private _setupWorkspaceSwitchHandlers(): void {
    this.logInfo(`Setting up workspace switch handlers, preventFocusOnOtherDisplays: ${this.preventFocusOnOtherDisplays}`);

    if (!this.preventFocusOnOtherDisplays) {
      this.logInfo('Feature disabled, not setting up handlers');
      return;
    }

    // Override actionMoveWorkspace to handle keyboard shortcuts and UI buttons
    this.actionMoveWorkspaceOriginal = WindowManager.WindowManager.prototype.actionMoveWorkspace;

    const self = this;
    WindowManager.WindowManager.prototype.actionMoveWorkspace = function(workspace) {
      // Store current state before workspace switch
      const focusedWindowBefore = global.display.focus_window;
      const currentMonitor = self.getCurrentMonitor();
      const isOnAllWorkspaces = focusedWindowBefore?.is_on_all_workspaces() || false;
      const workspaceIndexBefore = global.workspace_manager.get_active_workspace_index();

      // Log the state before workspace switch
      self.logHighlight('=== WORKSPACE SWITCH START ===');
      self.logDebug(`Current monitor: ${currentMonitor}`);
      self.logDebug(`Current workspace: ${workspaceIndexBefore}`);
      self.logDebug(`Focused window before: ${focusedWindowBefore ? focusedWindowBefore.get_title() : 'none'}`);
      self.logDebug(`Focused window monitor: ${focusedWindowBefore ? focusedWindowBefore.get_monitor() : 'none'}`);
      self.logDebug(`Window on all workspaces: ${isOnAllWorkspaces}`);

      // Call the original workspace switching function
      self.actionMoveWorkspaceOriginal.apply(this, arguments);

      // We'll handle focus after the workspace switch instead of trying to unfocus before
      self._tick().then(() => {
        const workspaceIndexAfter = global.workspace_manager.get_active_workspace_index();
        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const focusedWindowAfter = global.display.focus_window;

        // Log the state after workspace switch
        self.logHighlight('=== WORKSPACE SWITCH COMPLETED ===');
        self.logDebug(`New workspace: ${workspaceIndexAfter}`);
        self.logDebug(`Focused window after: ${focusedWindowAfter ? focusedWindowAfter.get_title() : 'none'}`);
        self.logDebug(`Focused window monitor: ${focusedWindowAfter ? focusedWindowAfter.get_monitor() : 'none'}`);

        // Case 1: If the previously focused window is on all workspaces, and the current monitor
        // is the same as the previously focused window, keep it focused
        if (isOnAllWorkspaces && focusedWindowBefore?.get_monitor() === currentMonitor) {
          self.logSuccess(`Refocusing window that's on all workspaces: ${focusedWindowBefore.get_title()}`);
          focusedWindowBefore.activate(global.get_current_time());
          return;
        }

        // Case 2: Find and focus the most recently used window on the current monitor
        if (activeWorkspace) {
          // Get all windows on the current workspace
          const windows = self._getWindowsForWorkspace(activeWorkspace);
          self.logDebug(`Total windows on workspace ${workspaceIndexAfter}: ${windows.length}`);

          // Filter windows on the current monitor
          const windowsOnCurrentMonitor = windows.filter(window =>
            window.get_monitor() === currentMonitor &&
            !window.is_skip_taskbar()
          );

          self.logDebug(`Windows on monitor ${currentMonitor}: ${windowsOnCurrentMonitor.length}`);
          windowsOnCurrentMonitor.forEach((window, i) => {
            self.logDebug(`  Window ${i + 1}: ${window.get_title()} (user_time: ${window.get_user_time()})`);
          });

          // Sort windows by most recently used
          windowsOnCurrentMonitor.sort((a, b) => b.get_user_time() - a.get_user_time());

          // Focus the most recently used window on the current monitor
          if (windowsOnCurrentMonitor.length > 0) {
            const windowToFocus = windowsOnCurrentMonitor[0];
            self.logSuccess(`Focusing most recently used window: ${windowToFocus.get_title()}`);
            Main.activateWindow(windowToFocus);
          } else {
            // Case 3: No windows on current monitor, ensure nothing is focused
            self.logWarning(`No windows on monitor ${currentMonitor}, clearing focus`);
            // More robust approach to unfocus windows
            self._clearFocus();
          }
        } else {
          self.logError(`Couldn't find active workspace, clearing focus`);
          // More robust approach to unfocus windows
          self._clearFocus();
        }

        self.logHighlight('=== WORKSPACE SWITCH END ===');
      });
    };

    this.logSuccess('Workspace switch handlers set up');
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
   * Stolen from https://github.com/christopher-l/focus-follows-workspace
   */
  private _tick(): Promise<void> {
    return new Promise((resolve) => {
      this._clearTimeout();
      this.timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, 0, () => {
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

  /**
   * More robust method to clear focus from all windows
   */
  private _clearFocus(): void {
    try {
      // First try the standard approach with current time
      global.display.unset_input_focus(global.get_current_time());

      // Then try with timestamp 0 as a fallback
      global.display.unset_input_focus(0);

      // Force the stage to get focus as another fallback
      global.stage.set_key_focus(null);

      this.logDebug('Applied multiple focus clearing methods');
    } catch (e) {
      this.logError(`Error while clearing focus: ${e}`);
    }
  }

  private logInfo(message: string): void {
    if (this.enableDebugging) {
      log(`${this.LOG_PREFIX} ${this.COLOR_INFO}${message}${this.COLOR_RESET}`);
    }
  }

  private logSuccess(message: string): void {
    if (this.enableDebugging) {
      log(`${this.LOG_PREFIX} ${this.COLOR_SUCCESS}${message}${this.COLOR_RESET}`);
    }
  }

  private logWarning(message: string): void {
    log(`${this.LOG_PREFIX} ${this.COLOR_WARNING}${message}${this.COLOR_RESET}`);
  }

  private logError(message: string): void {
    log(`${this.LOG_PREFIX} ${this.COLOR_ERROR}${message}${this.COLOR_RESET}`);
  }

  private logHighlight(message: string): void {
    if (this.enableDebugging) {
      log(`${this.LOG_PREFIX} ${this.COLOR_HIGHLIGHT}${message}${this.COLOR_RESET}`);
    }
  }

  private logDebug(message: string): void {
    if (this.enableDebugging) {
      log(`${this.LOG_PREFIX} ${message}`);
    }
  }
}
