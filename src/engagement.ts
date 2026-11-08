import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { metadata, type Progress } from "./progress";
export type NotificationState = {
  granted: boolean;
  available: boolean;
  entry?: boolean;
};
export interface EngagementBridge {
  configuration(): Promise<NotificationState>;
  requestNotifications(): Promise<NotificationState>;
  review(): Promise<{ status: string }>;
  prepareReview?(): Promise<{ status: string }>;
  openNotificationSettings?(): Promise<void>;
  addListener(
    name: "dailyOpen",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}
declare global {
  interface Window {
    __SEEDS_ENGAGEMENT_TEST__?: EngagementBridge;
  }
}
export const engagementBridge =
  import.meta.env.DEV && window.__SEEDS_ENGAGEMENT_TEST__
    ? window.__SEEDS_ENGAGEMENT_TEST__
    : Capacitor.getPlatform() === "android"
      ? registerPlugin<EngagementBridge>("SeedsEngagement")
      : undefined;
export function experience(p: Progress) {
  return (metadata(p).engagement ??= {
    activeMs: 0,
    sessions: 0,
    reviewAttempts: 0,
  });
}
export function reviewEligible(p: Progress, now = Date.now()) {
  const e = experience(p);
  return (
    !e.reviewDone &&
    e.sessions >= 2 &&
    e.activeMs >= 600000 &&
    e.reviewAttempts < 2 &&
    (e.lastReviewAt === undefined || now - e.lastReviewAt >= 30 * 86400000)
  );
}
