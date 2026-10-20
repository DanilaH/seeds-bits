import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
export type RewardReceipt = { token: string; attempt: string };
type Result = { shown?: boolean; reward?: RewardReceipt; status?: string };
type Configuration = {
  enabled: boolean;
  test: boolean;
  reward?: RewardReceipt;
};
export interface MonetizationBridge {
  initialize(): Promise<Configuration>;
  banner(options: {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    viewportWidth: number;
  }): Promise<void>;
  preload(): Promise<void>;
  show(options: {
    kind: "interstitial" | "rewarded";
    attempt?: string;
  }): Promise<Result>;
  pending(): Promise<{ reward?: RewardReceipt }>;
  acknowledge(options: { token: string }): Promise<void>;
  report(options: {
    name: string;
    data: Record<string, string | number | boolean>;
  }): Promise<void>;
  addListener(
    name: "reward",
    listener: (r: RewardReceipt) => void,
  ): Promise<PluginListenerHandle>;
}
declare global {
  interface Window {
    __SEEDS_ADS_TEST__?: MonetizationBridge;
  }
}
const plugin = registerPlugin<MonetizationBridge>("SeedsMonetization");
export const bridge =
  import.meta.env.DEV && window.__SEEDS_ADS_TEST__
    ? window.__SEEDS_ADS_TEST__
    : Capacitor.getPlatform() === "android"
      ? plugin
      : undefined;
export let monetized = false;
export let adActive = false;
let onPause = (_active: boolean) => {};
export function track(
  name: string,
  data: Record<string, string | number | boolean> = {},
) {
  void bridge?.report({ name, data }).catch(() => {});
}
export async function initializeMonetization(
  pause: (active: boolean) => void,
  reward: (r: RewardReceipt) => Promise<void>,
) {
  onPause = pause;
  if (!bridge) return;
  try {
    await bridge.addListener("reward", (r) => {
      void reward(r);
    });
    const config = await bridge.initialize();
    monetized = config.enabled;
    document.documentElement.classList.toggle("has-mobile-ads", monetized);
    if (config.reward) await reward(config.reward);
    void bridge.preload().catch(() => {});
  } catch {
    monetized = false;
  }
}
export async function showAd(
  kind: "interstitial" | "rewarded",
  attempt?: string,
): Promise<Result> {
  if (!monetized || !bridge || adActive) return { status: "unavailable" };
  adActive = true;
  onPause(true);
  try {
    return await bridge.show({ kind, attempt });
  } catch {
    return { status: "error" };
  } finally {
    adActive = false;
    onPause(false);
  }
}
export async function syncBanner(visible: boolean) {
  if (!monetized || !bridge) return;
  const slot = document.getElementById("ad-space");
  if (!slot) return;
  const r = slot.getBoundingClientRect();
  try {
    await bridge.banner({
      visible: visible && !adActive && r.width >= 250 && r.height >= 45,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      viewportWidth: innerWidth,
    });
  } catch {
    /* Advertising must not interrupt play. */
  }
}
