import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const key = "seeds-bits.progress.v2",
  out = "test-results/audit-2026-10-23";
mkdirSync(out, { recursive: true });
for (let n = 0; n < 12; n++)
  test(`E${n} concurrent accepted moves must reject one stale branch`, async ({
    page,
    context,
  }) => {
    const writes: any[] = [];
    const capture = (p: any) =>
      p.on("console", (m: any) => {
        if (m.text().startsWith("AUDIT_MOVE "))
          writes.push(JSON.parse(m.text().slice(11)));
      });
    capture(page);
    context.on("page", capture);
    await context.addInitScript(() => {
      const id = crypto.randomUUID(),
        set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === "seeds-bits.progress.v2")
          console.log(
            "AUDIT_MOVE " +
              JSON.stringify({
                id,
                at: Date.now(),
                kind: "write",
                value: JSON.parse(v),
              }),
          );
        return set.call(this, k, v);
      };
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem("seeds-bits.progress.v2")) {
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true }),
        );
        localStorage.setItem(
          "seeds-bits.progress.v2",
          JSON.stringify({
            version: 3,
            active: "classic",
            sessions: {
              classic: {
                rules: 1,
                current: {
                  board: Array(36).fill(5),
                  moves: 0,
                  additions: 0,
                  scroll: 0,
                },
                history: [],
              },
            },
            done: [],
            seen: [],
            hints: {},
          }),
        );
      }
    });
    await page.goto("/");
    await page.locator("#resume").click();
    await page.locator("#hint").click();
    await expect
      .poll(() =>
        page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).version, key),
      )
      .toBe(4);
    const other = await context.newPage();
    await other.goto("/");
    await other.locator("#resume").click();
    await Promise.all([
      page.locator('[data-index="0"]').dispatchEvent("click"),
      other.locator('[data-index="2"]').dispatchEvent("click"),
    ]);
    await Promise.all([
      page.locator('[data-index="1"]').dispatchEvent("click"),
      other.locator('[data-index="3"]').dispatchEvent("click"),
    ]);
    await Promise.all([
      expect(page.locator("#remaining")).toHaveText("34"),
      expect(other.locator("#remaining")).toHaveText("34"),
    ]);
    await page.waitForTimeout(400);
    const result = {
      n,
      writes,
      firstWarning: await page.locator("#save-warning").textContent(),
      secondWarning: await other.locator("#save-warning").textContent(),
      firstNotice: await page.locator("#save-notice").isVisible(),
      secondNotice: await other.locator("#save-notice").isVisible(),
      stored: await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!),
        key,
      ),
      scope: "two visible documents; simultaneous real DOM click handlers",
    };
    writeFileSync(
      `${out}/E-concurrent-${n}.json`,
      JSON.stringify(result, null, 2),
    );
    expect(result.firstNotice || result.secondNotice).toBe(true);
    expect(
      [result.firstWarning, result.secondWarning].some((s) =>
        s?.includes("другой вкладке"),
      ),
    ).toBe(true);
  });
