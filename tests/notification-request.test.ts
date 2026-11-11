import { afterEach, expect, test, vi } from "vitest";
import {
  requestNotificationPermission,
  type EngagementBridge,
} from "../src/engagement";
afterEach(() => vi.useRealTimers());
test("a missing native callback releases the caller; a late grant cannot change its outcome", async () => {
  vi.useFakeTimers();
  let resolve!: (value: { available: boolean; granted: boolean }) => void;
  const bridge = {
    requestNotifications: () =>
      new Promise((r) => {
        resolve = r;
      }),
  } as EngagementBridge;
  const outcome = requestNotificationPermission(bridge, 2000).then(
    () => "granted",
    () => "timeout",
  );
  await vi.advanceTimersByTimeAsync(2000);
  expect(await outcome).toBe("timeout");
  resolve({ available: true, granted: true });
  await vi.runAllTimersAsync();
  expect(await outcome).toBe("timeout");
  expect(vi.getTimerCount()).toBe(0);
});
test("a real denial is returned as denial and bridge failures stay errors", async () => {
  const requestNotifications = vi
    .fn()
    .mockResolvedValue({ available: true, granted: false });
  const bridge = { requestNotifications } as unknown as EngagementBridge;
  expect(await requestNotificationPermission(bridge)).toEqual({
    available: true,
    granted: false,
  });
  requestNotifications.mockRejectedValueOnce(new Error("native_unavailable"));
  await expect(requestNotificationPermission(bridge)).rejects.toThrow(
    "native_unavailable",
  );
});
