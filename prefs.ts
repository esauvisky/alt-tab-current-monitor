import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AltTabCurrentMonitorPreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;

  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    this._settings = this.getSettings();

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

    window.add(page);

    this._settings!.bind('use-mouse-monitor', useMouseMonitor, 'active', Gio.SettingsBindFlags.DEFAULT);

    return Promise.resolve();
  }
}
