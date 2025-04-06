import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AltTabCurrentMonitorPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    // @ts-ignore
    window._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('Settings'),
      iconName: 'preferences-system-symbolic',
    });

    const monitorGroup = new Adw.PreferencesGroup({
      title: _('Monitor Selection'),
      description: _('Configure which monitor is considered "current"'),
    });
    page.add(monitorGroup);

    const useMouseMonitor = new Adw.SwitchRow({
      title: _('Use mouse pointer monitor'),
      subtitle: _('When enabled, the "current monitor" is the one where your mouse pointer is located. When disabled, it\'s the monitor with the focused window.'),
    });
    monitorGroup.add(useMouseMonitor);

    const workspaceGroup = new Adw.PreferencesGroup({
      title: _('Workspace Filtering'),
      description: _('Configure workspace filtering behavior'),
    });
    page.add(workspaceGroup);

    const currentWorkspaceOnly = new Adw.SwitchRow({
      title: _('Current workspace only'),
      subtitle: _('When enabled, Alt+Tab will only show windows from the current workspace.'),
    });
    workspaceGroup.add(currentWorkspaceOnly);

    const preventFocusOnOtherDisplays = new Adw.SwitchRow({
      title: _('Keep focus on current monitor when switching workspaces'),
      subtitle: _('When enabled, switching workspaces will not change focus to windows on other monitors.'),
    });
    workspaceGroup.add(preventFocusOnOtherDisplays);

    window.add(page);

    // @ts-ignore
    window._settings.bind('use-mouse-monitor', useMouseMonitor, 'active', Gio.SettingsBindFlags.DEFAULT);
    // @ts-ignore
    window._settings.bind('current-workspace-only', currentWorkspaceOnly, 'active', Gio.SettingsBindFlags.DEFAULT);
    // @ts-ignore
    window._settings.bind('prevent-focus-on-other-displays', preventFocusOnOtherDisplays, 'active', Gio.SettingsBindFlags.DEFAULT);

    return Promise.resolve();
  }
}
