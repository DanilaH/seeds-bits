import { test, expect, vi, afterEach } from "vitest";
import { freshHelp } from "../src/help-contract";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
test("A public bundle ignores the combined QA URL; only an explicit QA build enables all", async () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_SEEDS_QA_PROFILE", undefined);
  vi.stubGlobal("location", { search: "?qa=all" });
  vi.resetModules();
  const publicConfig = await import("../src/help-config");
  expect(publicConfig.qaProfile).toBe("");
  expect(publicConfig.helpPaused).toBe(true);
  expect(Object.values(publicConfig.helpFlags).some(Boolean)).toBe(false);
  expect(publicConfig.assignHelp(freshHelp(), true).qa).toBe(false);
  vi.stubEnv("VITE_SEEDS_QA_PROFILE", "all");
  vi.resetModules();
  const qa = await import("../src/help-config");
  expect(qa.qaProfile).toBe("all");
  expect(Object.values(qa.helpFlags)).toEqual(Array(6).fill(true));
  expect(qa.assignHelp(freshHelp(), true)).toMatchObject({
    qa: true,
    experiment: "seeds-all-qa-v1",
  });
});

test("Baseline QA keeps every experiment paused and is marked as QA control", async () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_SEEDS_QA_PROFILE", "baseline");
  vi.resetModules();
  const config = await import("../src/help-config");
  expect(config.helpPaused).toBe(true);
  expect(Object.values(config.helpFlags).some(Boolean)).toBe(false);
  expect(config.assignHelp(freshHelp(), true)).toMatchObject({
    qa: true,
    variant: "control",
    experiment: "seeds-baseline-qa-v1",
  });
});
