import { nativePlugin } from "./monetization";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
export const isYandex = import.meta.env.MODE === "yandex";
type YandexSDK = {
  features: {
    LoadingAPI: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  on?(event: string, fn: () => void): void;
};
declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSDK> };
  }
}
let sdk: YandexSDK | undefined;
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
export async function read(key: string): Promise<string | null> {
  return Capacitor.isNativePlatform()
    ? (await Preferences.get({ key })).value
    : localStorage.getItem(key);
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
  ]) {
    const item = localStorage.getItem(`${key}.${field}`);
    if (item !== null)
      try {
        result[field] = JSON.parse(item);
      } catch {}
  }
  return Object.keys(result).length ? JSON.stringify(result) : null;
}
export async function write(key: string, value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Preferences.set({ key, value });
  else localStorage.setItem(key, value);
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
    const conflict = !native && localStorage.getItem(key) !== expected;
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
          localStorage.setItem(
            `${settingsKey}.${field}`,
            JSON.stringify(patch[field]),
          );
      }
      localStorage.setItem(settingsKey, JSON.stringify(merged));
      if (conflict) throw new SaveConflict();
      localStorage.setItem(key, value);
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
  if (native) return;
  const update = async () => {
    const merged = {
      ...JSON.parse(defaults),
      ...JSON.parse((await readSettings(key)) ?? "{}"),
      ...patch,
    };
    for (const [field, value] of Object.entries(patch))
      localStorage.setItem(`${key}.${field}`, JSON.stringify(value));
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  };
  return navigator.locks
    ? await navigator.locks.request("seeds-save", update)
    : await update();
}
