// UI-only fixture: real late-notebook content, deterministic native ad geometry.
import { readFileSync } from "node:fs";
import { removePair } from "../src/core.ts";
const extra = JSON.parse(
  readFileSync(new URL("../src/notebook-extra.json", import.meta.url), "utf8"),
);
const entry = extra[2161 - 25];
let board = [...entry[0]].map(Number);
let previous;
const moves = (board.filter(Boolean).length - 212) / 2;
for (let move = 0; move < moves; move++) {
  previous = { board, moves: move, additions: 0, scroll: 0 };
  board = removePair(board, entry[1][move * 3], entry[1][move * 3 + 1]);
}
export async function openBannerFixture(page, options = {}) {
  const { url = "/", dark = false, ads = true } = options;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ board, previous, moves, dark, ads }) => {
      const active = "book-v1-2161";
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({
          tutorialDone: true,
          theme: dark ? "dark" : "light",
          reminders: false,
        }),
      );
      localStorage.setItem(
        "seeds-bits.progress.v2",
        JSON.stringify({
          version: 3,
          active,
          sessions: {
            [active]: {
              rules: 1,
              current: { board, moves, additions: 0, scroll: 0 },
              history: [previous],
            },
          },
          hints: {},
          done: [],
          seen: [],
          meta: {
            version: 2,
            since: "2026-11-12",
            wallet: 3,
            completed: 0,
            unassisted: 0,
            attempts: {
              [active]: { id: "banner-layout-fixture", completed: false },
            },
          },
        }),
      );
      const w = window;
      w.bannerCalls = [];
      w.__SEEDS_ADS_TEST__ = {
        initialize: async () => ({ enabled: ads, test: true }),
        addListener: async (name, callback) => {
          if (name === "bannerSize") w.bannerSizeListener = callback;
          return { remove: async () => {} };
        },
        banner: async (placement) => {
          w.bannerCalls.push(placement);
        },
        preload: async () => {},
        report: async () => ({ accepted: true }),
        pending: async () => ({}),
        acknowledge: async () => {},
        show: async () => ({ status: "unavailable" }),
      };
      const style = document.documentElement.style;
      for (const [side, value] of Object.entries({
        top: 24,
        bottom: 24,
        left: 0,
        right: 0,
      }))
        style.setProperty(`--safe-area-inset-${side}`, `${value}px`);
    },
    { board, previous, moves, dark, ads },
  );
  await page.goto(url);
  await page.locator("#resume").click();
}
