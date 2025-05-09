import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
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

    const behaviorGroup = new Adw.PreferencesGroup({
      title: _('Window Behavior'),
      description: _('Configure how windows behave across workspaces and monitors. If focus is jumping unexpectedly between monitors, try adjusting these settings.'),
    });
    page.add(behaviorGroup);


    const preventFocusOnOtherDisplays = new Adw.SwitchRow({
      title: _('Keep focus on current monitor when switching workspaces'),
      subtitle: _('When enabled, switching workspaces will not change focus to windows on other monitors.'),
    });
    behaviorGroup.add(preventFocusOnOtherDisplays);

    // Add modifier key dropdown for other monitors
    const modifierKeys = [
      ['', _('Disabled')],
      ['Shift', _('Shift')],
      ['Control', _('Control')],
      ['Alt', _('Alt')],
      ['Super', _('Super')],
      ['Hyper', _('Hyper')],
      ['Caps Lock', _('Caps Lock')],
      ['Meta', _('Meta')],
    ];

    const otherMonitorsModifierKey = new Adw.ComboRow({
      title: _('Modifier key for other monitors'),
      subtitle: _('Hold this key while using Alt+Tab to show windows from other monitors. Set to "Disabled" to turn off this feature.'),
      model: new Gtk.StringList({
        strings: modifierKeys.map(([_, label]) => label)
      }),
    });
    behaviorGroup.add(otherMonitorsModifierKey);

    // Set the initial value
    // @ts-ignore
    const currentModifier = window._settings.get_string('other-monitors-modifier-key');
    const modifierIndex = modifierKeys.findIndex(([value, _]) => value === currentModifier);
    if (modifierIndex !== -1) {
      otherMonitorsModifierKey.selected = modifierIndex;
    }

    // Connect the signal
    otherMonitorsModifierKey.connect('notify::selected', () => {
      const selected = otherMonitorsModifierKey.selected;
      if (selected >= 0 && selected < modifierKeys.length) {
        // @ts-ignore
        window._settings.set_string('other-monitors-modifier-key', modifierKeys[selected][0]);
      }
    });

    // Add debugging group
    const debuggingGroup = new Adw.PreferencesGroup({
      title: _('Debugging'),
      description: _('Advanced options for troubleshooting'),
    });
    page.add(debuggingGroup);

    const enableDebugging = new Adw.SwitchRow({
      title: _('Enable debugging logs'),
      subtitle: _('When enabled, detailed debugging information will be logged to the journal. Use `journalctl -f -o cat /usr/bin/gnome-shell` to view logs.'),
    });
    debuggingGroup.add(enableDebugging);

    window.add(page);

    // @ts-ignore
    window._settings.bind('use-mouse-monitor', useMouseMonitor, 'active', Gio.SettingsBindFlags.DEFAULT);
    // @ts-ignore
    window._settings.bind('prevent-focus-on-other-displays', preventFocusOnOtherDisplays, 'active', Gio.SettingsBindFlags.DEFAULT);
    // @ts-ignore
    window._settings.bind('enable-debugging', enableDebugging, 'active', Gio.SettingsBindFlags.DEFAULT);

    return Promise.resolve();
  }
}
