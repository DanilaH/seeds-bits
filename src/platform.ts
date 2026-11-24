import { identifyPortal } from "./distribution";
import type { AnalyticsEvent } from "./analytics";
import { nativePlugin } from "./monetization";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
export const isYandex = import.meta.env.MODE === "yandex";
type YandexSDK = {
  environment?: {app?: {id?: string}; i18n?: {lang?: string}};
  features: {
    LoadingAPI: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  on?(event: string, fn: () => void): void;
};
declare global {
  interface Window {
    ym?: (counter: number, method: string, ...args: unknown[]) => void;
    YaGames?: { init(): Promise<YandexSDK> };
  }
}
let sdk: YandexSDK | undefined;
const configuredOrigin = import.meta.env.VITE_SEEDS_PORTAL_ORIGIN;
const counterId = Number(import.meta.env.VITE_SEEDS_YANDEX_COUNTER);
export const marketQA = import.meta.env.VITE_SEEDS_MARKET_QA === "1";
export function platformLocale() { return sdk?.environment?.i18n?.lang; }
export function webDistribution() {
  const app = sdk?.environment?.app?.id;
  const expected = import.meta.env.VITE_SEEDS_YANDEX_APP_ID;
  const yandex = isYandex && app && (!expected || String(app)===expected);
  const verifiedOrigin = Boolean(configuredOrigin && location.origin===configuredOrigin);
  return identifyPortal({
    buildPortal:isYandex?"yandex_games":import.meta.env.VITE_SEEDS_PORTAL,
    sdkPortal:yandex?"yandex_games":undefined,
    distributor:verifiedOrigin?import.meta.env.VITE_SEEDS_DISTRIBUTOR:undefined,
    verifiedOrigin:verifiedOrigin && (!isYandex || !app || Boolean(yandex)),
    direct: Boolean(import.meta.env.VITE_SEEDS_DIRECT_ORIGIN && location.origin===import.meta.env.VITE_SEEDS_DIRECT_ORIGIN),
    conflict:Boolean(isYandex && app && expected && String(app)!==expected),
  });
}
const webGoal = /^(web_first_play|web_session_open|activity_day|locale_resolved|language_picker_open|language_changed|first_unassisted_pair|first_complete|game_start|game_complete)$/;
export function webAnalyticsEnabled() {
  if (marketQA) return true;
  return import.meta.env.VITE_SEEDS_YANDEX_TELEMETRY === "1" && Number.isInteger(counterId) && counterId>0 &&
    webDistribution().portal_id==="yandex_games" && navigator.doNotTrack!=="1";
}
let counterStarted = false;
export async function reportWeb(event: AnalyticsEvent): Promise<boolean> {
  if (!webGoal.test(event.name)) return true;
  if (!webAnalyticsEnabled()) return true;
  const data = {...event.data,event_id:event.id};
  if (marketQA) {
    window.dispatchEvent(new CustomEvent("seeds:market-qa", {detail:{name:event.name,data}}));
    return true;
  }
  if (!navigator.onLine) return false;
  if (!counterStarted && !window.ym) {
    counterStarted=true;
    const queue = Object.assign((...args: unknown[]) => { queue.a.push(args); },{a: [] as unknown[][],l:Date.now()});
    window.ym=queue;
    const tag=document.createElement("script");
    tag.src="https://mc.yandex.ru/metrika/tag.js";
    tag.async=true;
    tag.onerror=()=>{ window.ym=undefined;counterStarted=false;tag.remove(); };
    document.head.append(tag);
    window.ym(counterId,"init",{clickmap:false,trackLinks:false,accurateTrackBounce:false});
  }
  return new Promise<boolean>(resolve=>{
    const timeout=setTimeout(()=>resolve(false),3500);
    try {
      window.ym?.(counterId,"reachGoal",event.name,data,()=>{clearTimeout(timeout);resolve(true);});
    } catch {clearTimeout(timeout);resolve(false);}
  });
}
export async function initPlatform(
  onPause: () => void,
  onResume: () => void,
): Promise<void> {
  if (isYandex) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      sdk = await Promise.race([
        (async () => {
          if (!window.YaGames)
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "/sdk.js";
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("SDK unavailable"));
              document.head.append(script);
            });
          if (!window.YaGames) throw new Error("SDK missing");
          return window.YaGames.init();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("SDK timeout")), 4000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    sdk.on?.("game_api_pause", onPause);
    sdk.on?.("game_api_resume", onResume);
  }
}
export function ready() {
  sdk?.features.LoadingAPI.ready();
}
export function gameplay(active: boolean) {
  const api = sdk?.features.GameplayAPI;
  active ? api?.start() : api?.stop();
}
const temporary = new Map<string,string>();
let webStorageBlocked = false;
try { if(!Capacitor.isNativePlatform()) localStorage.getItem("seeds-bits.settings.v1"); }
catch (error) {
  if ((error as Error).name!=="SecurityError") throw error;
  webStorageBlocked = true;
}
function browserRead(key:string) {
  return webStorageBlocked ? temporary.get(key) ?? null : localStorage.getItem(key);
}
function browserWrite(key:string,value:string) {
  if(webStorageBlocked) temporary.set(key,value);
  else localStorage.setItem(key,value);
}
export async function read(key: string): Promise<string | null> {
  return Capacitor.isNativePlatform()
    ? (await Preferences.get({ key })).value
    : browserRead(key);
}
/** Per-field browser keys prevent unrelated preferences from overwriting each other across tabs. */
export async function readSettings(key: string): Promise<string | null> {
  const raw = await read(key);
  if (native) return raw;
  let result: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      result = parsed;
  } catch {}
  for (const field of [
    "theme",
    "sound",
    "vibration",
    "tutorialDone",
    "reminders",
    "reminderTime",
    "languageChoice",
  ]) {
    const item = browserRead(`${key}.${field}`);
    if (item !== null)
      try {
        result[field] = JSON.parse(item);
      } catch {}
  }
  return Object.keys(result).length ? JSON.stringify(result) : null;
}
export async function write(key: string, value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Preferences.set({ key, value });
  else browserWrite(key, value);
}
export { haptic, setHapticState } from "./haptics";
export async function listenAppState(
  onChange: (active: boolean) => void,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { App } = await import("@capacitor/app");
    await App.addListener("appStateChange", ({ isActive }) =>
      onChange(isActive),
    );
  }
}

/** Android Back follows our screens; at home it backgrounds the app. */
export async function listenBack(onBack: () => boolean): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", () => {
    if (!onBack()) void App.minimizeApp();
  });
}

export const native = Capacitor.isNativePlatform();
export class SaveConflict extends Error {}
/** Serialize game writes. Independent preference patches remain valid in a stale game tab. */
export async function saveState(
  key: string,
  value: string,
  expected: string | null,
  settingsKey: string,
  settings: string,
  patch: Record<string, unknown> = {},
) {
  const persist = async () => {
    const conflict = !native && browserRead(key) !== expected;
    const defaults = JSON.parse(settings);
    let latest: Record<string, unknown> = {};
    try {
      latest = JSON.parse((await readSettings(settingsKey)) ?? "{}") ?? {};
    } catch {
      /* Keep valid defaults. */
    }
    const merged = { ...defaults };
    for (const field of Object.keys(defaults)) {
      if (typeof latest[field] === typeof defaults[field])
        merged[field] = latest[field];
      if (Object.hasOwn(patch, field)) merged[field] = patch[field];
    }
    if (Capacitor.getPlatform() === "android") {
      await nativePlugin.persistState({
        key,
        value,
        settingsKey,
        settings: JSON.stringify(merged),
      });
    } else if (native) {
      await write(settingsKey, JSON.stringify(merged));
      await write(key, value);
    } else {
      // The Web Lock spans the merge and write; each preference has its own canonical key.
      for (const field of Object.keys(patch)) {
        if (
          Object.hasOwn(defaults, field) &&
          typeof patch[field] === typeof defaults[field]
        )
          browserWrite(
            `${settingsKey}.${field}`,
            JSON.stringify(patch[field]),
          );
      }
      browserWrite(settingsKey, JSON.stringify(merged));
      if (conflict) throw new SaveConflict();
      browserWrite(key, value);
    }
    return merged;
  };
  if (!native && navigator.locks)
    return await navigator.locks.request("seeds-save", persist);
  else return await persist();
}

/** Safe bounded diagnostics: never expose native messages or saved content. */
export function saveErrorReason(error: unknown) {
  if (error instanceof SaveConflict) return "conflict";
  const e = error as { name?: string; code?: string };
  if (e?.name === "QuotaExceededError") return "quota";
  if (e?.name === "SecurityError") return "blocked";
  if (["DISK_COMMIT", "PERSIST_EXCEPTION"].includes(e?.code ?? ""))
    return e.code!;
  return native ? "native_write" : "storage_write";
}

/** Settings remain editable when another tab owns the newer game snapshot. */
export async function writeSettingsPatch(
  key: string,
  defaults: string,
  patch: Record<string, unknown>,
) {
  const update = async () => {
    const merged = {
      ...JSON.parse(defaults),
      ...JSON.parse((await readSettings(key)) ?? "{}"),
      ...patch,
    };
    if (!native) for (const [field, value] of Object.entries(patch))
      browserWrite(`${key}.${field}`, JSON.stringify(value));
    await write(key, JSON.stringify(merged));
    return merged;
  };
  return !native && navigator.locks
    ? await navigator.locks.request("seeds-save", update)
    : await update();
}
