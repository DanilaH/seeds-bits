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
  if (isYandex && window.YaGames) {
    sdk = await window.YaGames.init();
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
