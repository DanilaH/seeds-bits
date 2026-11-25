import { Capacitor, registerPlugin } from "@capacitor/core";
import { eventContext } from "./analytics";
import type { InstallContext } from "./distribution";
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
  bannerEpoch?: string;
  bannerHeight?: number;
  reward?: RewardReceipt;
  readiness?: RewardedReadiness;
};
export interface MonetizationBridge {
  initialize(): Promise<Configuration>;
  installContext?(): Promise<InstallContext & {locales: string[]; enabled: boolean; build_channel: string}>;
  configureContext?(options: Record<string, string>): Promise<void>;
  banner(options: {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    revision: number;
    epoch?: string;
  }): Promise<void>;
  preload(): Promise<void>;
  readiness?(): Promise<RewardedReadiness>;
  show(options: {
    kind: "interstitial" | "rewarded";
    attempt?: string;
    product?: string; intent_id?: string; offer_id?: string; ad_session_id?: string;
    route?: string; transition_id?: string;
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
  addListener(name: "bannerRefresh", listener: () => void): Promise<PluginListenerHandle>;
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
function setBannerHeight(height: number) {
  if (Number.isFinite(height) && height >= 1 && height < innerHeight)
    document.documentElement.style.setProperty("--banner-height", `${Math.ceil(height)}px`);
}
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
    await bridge.addListener("bannerSize", ({ height }) => setBannerHeight(height));
    if (bridge === nativePlugin) await bridge.addListener("bannerRefresh", () => {
      bannerGeometry = "";
      window.dispatchEvent(new Event("seeds:banner-refresh"));
    });
    const config = await bridge.initialize();
    bannerEpoch = config.bannerEpoch;
    if (config.bannerHeight !== undefined) setBannerHeight(config.bannerHeight);
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
  transition?: {route: string; transitionId: string},
): Promise<Result> {
  if (!monetized || !bridge || adActive) return { status: "unavailable", reason: adActive ? "fullscreen_busy" : "disabled" };
  adActive = true;
  onPause(true);
  try {
    return await bridge.show({ kind, attempt, ad_session_id: adSession, ...(transition ? {route:transition.route,transition_id:transition.transitionId} : {}), ...(intent ? {product: intent.product, intent_id: intent.id, offer_id: intent.offer} : {}) });
  } catch {
    return { status: "error", reason: "bridge_error" };
  } finally {
    adActive = false;
    onPause(false);
  }
}
let bannerRevision = 0;
let bannerEpoch: string | undefined;
let bannerGeometry = "";
let bannerSentAt = -Infinity;

export async function syncBanner(visible: boolean) {
  if (!monetized || !bridge) return;
  const slot = document.getElementById("ad-space");
  const viewport = document.getElementById("banner-viewport");
  if (!slot || !viewport) return;
  const r = slot.getBoundingClientRect();
  const space = viewport.getBoundingClientRect();
  const valid = visible && r.width >= 250 && r.height > 0;
  const geometry = valid ? [r.x, r.y, r.width, r.height, space.width, space.height].join(":") : "hidden";
  if (geometry === bannerGeometry && (!valid || performance.now() - bannerSentAt < 60000)) return;
  bannerGeometry = geometry;
  bannerSentAt = performance.now();
  const revision = ++bannerRevision;
  try {
    await bridge.banner({
      visible: valid,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      viewportWidth: space.width,
      viewportHeight: space.height,
      revision,
      epoch: bannerEpoch,
    });
  } catch {
    if (revision === bannerRevision) bannerGeometry = "";
  }
}

export async function refreshRewarded(preload = false) {
  if (!bridge) return;
  if (preload) await bridge.preload().catch(() => {});
  if (bridge.readiness) { try { setReadiness(await bridge.readiness()); } catch { setReadiness({state: "unavailable", reason: "bridge_error"}); } }
}
