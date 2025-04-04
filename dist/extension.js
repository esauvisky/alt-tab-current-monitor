import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
export default class MyExtension extends Extension {
    gsettings;
    animationsEnabled = true;
    enable() {
        this.gsettings = this.getSettings();
        this.animationsEnabled = this.gsettings.get_value('padding-inner').deepUnpack() ?? 8;
    }
    disable() {
        this.gsettings = undefined;
    }
}
