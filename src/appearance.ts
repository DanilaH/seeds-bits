import { Capacitor, registerPlugin } from "@capacitor/core";
const appearance = registerPlugin<{setTheme(options:{dark:boolean}):Promise<void>}>("SeedsAppearance");
let requestedDark:boolean|undefined;
let appearanceRevision=0;
/** Native chrome follows the saved in-game theme; web builds use theme-color. */
export function syncGameAppearance(dark:boolean) {
  if (Capacitor.getPlatform() !== "android" || requestedDark === dark) return;
  // Settings are merged after every durable move. Repainting the Android window
  // for an unchanged theme can reapply insets and briefly hide the SDK banner.
  // MainActivity separately restores chrome on resume/configuration changes.
  requestedDark = dark;
  const revision=++appearanceRevision;
  void appearance.setTheme({dark}).catch(()=>{if(appearanceRevision===revision)requestedDark=undefined;});
}
