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
export async function write(key: string, value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Preferences.set({ key, value });
  else localStorage.setItem(key, value);
}
export async function haptic(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } else navigator.vibrate?.(12);
}
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
/** Serialize cooperating tabs and reject stale snapshots before touching either key. */
export async function saveState(
  key: string,
  value: string,
  expected: string | null,
  settingsKey: string,
  settings: string,
  patch: Record<string, unknown> = {},
) {
  const persist = async () => {
    if (!native && localStorage.getItem(key) !== expected)
      throw new SaveConflict();
    const defaults = JSON.parse(settings);
    let latest: Record<string, unknown> = {};
    try {
      latest = JSON.parse((await read(settingsKey)) ?? "{}") ?? {};
    } catch {
      /* Keep valid defaults. */
    }
    const merged = { ...defaults };
    for (const field of Object.keys(defaults)) {
      if (typeof latest[field] === typeof defaults[field])
        merged[field] = latest[field];
      if (Object.hasOwn(patch, field)) merged[field] = patch[field];
    }
    await write(settingsKey, JSON.stringify(merged));
    await write(key, value);
    return merged;
  };
  if (!native && navigator.locks)
    return await navigator.locks.request("seeds-save", persist);
  else return await persist();
}
