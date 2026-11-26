import { Capacitor, registerPlugin } from "@capacitor/core";
const appearance = registerPlugin<{setTheme(options:{dark:boolean}):Promise<void>}>("SeedsAppearance");
/** Native chrome follows the saved in-game theme; web builds use theme-color. */
export function syncGameAppearance(dark:boolean) {
  if (Capacitor.getPlatform() === "android") void appearance.setTheme({dark}).catch(()=>{});
}
