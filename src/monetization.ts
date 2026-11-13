import { Capacitor, registerPlugin } from "@capacitor/core";
import { eventContext } from "./analytics";
import type { PluginListenerHandle } from "@capacitor/core";
import type { HelpIntent, RewardReceipt } from "./help-contract";
export type { RewardReceipt } from "./help-contract";
export type RewardedReadiness = {state: "ready" | "loading" | "unavailable" | "disabled"; reason: string};
export let rewardedReadiness: RewardedReadiness = {state: "disabled", reason: "disabled"};
function setReadiness(value: RewardedReadiness) {
  if (!["ready", "loading", "unavailable", "disabled"].includes(value?.state)) return;
  rewardedReadiness = value; window.dispatchEvent(new Event("seeds:rewarded-state"));
}
type Result = { shown?: boolean; reward?: RewardReceipt; status?: string; reason?: string; ad_session_id?: string };
type Configuration = {
  enabled: boolean;
  test: boolean;
  reward?: RewardReceipt;
  readiness?: RewardedReadiness;
};
export interface MonetizationBridge {
  initialize(): Promise<Configuration>;
  configureContext?(options: Record<string, string>): Promise<void>;
  banner(options: {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    viewportWidth: number;
  }): Promise<void>;
  preload(): Promise<void>;
  readiness?(): Promise<RewardedReadiness>;
  show(options: {
    kind: "interstitial" | "rewarded";
    attempt?: string;
    product?: string; intent_id?: string; offer_id?: string; ad_session_id?: string;
  }): Promise<Result>;
  pending(): Promise<{ reward?: RewardReceipt }>;
  acknowledge(options: { token: string }): Promise<void>;
  report(options: {
    name: string;
    data: Record<string, string | number | boolean>;
  }): Promise<{ accepted: boolean } | void>;
  addListener(name: "rewardedState", listener: (r: RewardedReadiness) => void): Promise<PluginListenerHandle>;
  addListener(
    name: "reward",
    listener: (r: RewardReceipt) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    name: "bannerSize",
    listener: (r: { height: number }) => void,
  ): Promise<PluginListenerHandle>;
}
declare global {
  interface Window {
    __SEEDS_ADS_TEST__?: MonetizationBridge;
  }
}
export const nativePlugin = registerPlugin<
  MonetizationBridge & {
    persistLabState(options:{key:string;value:string}):Promise<void>;
    persistState(options: {
      key: string;
      value: string;
      settingsKey: string;
      settings: string;
    }): Promise<void>;
  }
>("SeedsMonetization");
export const bridge =
  import.meta.env.DEV && window.__SEEDS_ADS_TEST__
    ? window.__SEEDS_ADS_TEST__
    : Capacitor.getPlatform() === "android"
      ? nativePlugin
      : undefined;
export let monetized = false;
export let adActive = false;
let onPause = (_active: boolean) => {};
export function track(
  name: string,
  data: Record<string, string | number | boolean> = {},
) {
  void bridge
    ?.report({ name, data: { ...eventContext(), ...data } })
    .catch(() => {});
}
export async function initializeMonetization(
  pause: (active: boolean) => void,
  reward: (r: RewardReceipt) => Promise<void>,
) {
  onPause = pause;
  if (!bridge) return;
  try {
    if (bridge.readiness) await bridge.addListener("rewardedState", setReadiness);
    await bridge.addListener("reward", (r) => {
      void reward(r);
    });
    await bridge.addListener("bannerSize", ({ height }) => {
      if (Number.isFinite(height) && height >= 1 && height < innerHeight)
        document.documentElement.style.setProperty(
          "--banner-height",
          `${Math.ceil(height)}px`,
        );
    });
    const config = await bridge.initialize();
    monetized = config.enabled;
    setReadiness(config.readiness ?? (bridge.readiness ? await bridge.readiness() : {state: import.meta.env.DEV && config.enabled ? "ready" : "disabled", reason: "legacy_qa_bridge"}));
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
  intent?: HelpIntent,
  adSession = crypto.randomUUID(),
): Promise<Result> {
  if (!monetized || !bridge || adActive) return { status: "unavailable", reason: adActive ? "fullscreen_busy" : "disabled" };
  adActive = true;
  onPause(true);
  try {
    return await bridge.show({ kind, attempt, ad_session_id: adSession, ...(intent ? {product: intent.product, intent_id: intent.id, offer_id: intent.offer} : {}) });
  } catch {
    return { status: "error", reason: "bridge_error" };
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
      // Native validates the real SDK height in pixels. CSS px can differ
      // from Android dp when the WebView scale changes.
      visible: visible && !adActive && r.width >= 250 && r.height > 0,
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

export async function refreshRewarded(preload = false) {
  if (!bridge) return;
  if (preload) await bridge.preload().catch(() => {});
  if (bridge.readiness) { try { setReadiness(await bridge.readiness()); } catch { setReadiness({state: "unavailable", reason: "bridge_error"}); } }
}
