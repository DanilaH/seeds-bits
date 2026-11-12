import { test, expect } from "@playwright/test";

test("control glyphs stay centred in the same field at large text", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true, sound: false, vibration: false }),
    ),
  );
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const issues = await page.locator("svg.seed-icon").evaluateAll((nodes) =>
    nodes
      .filter((n) => n.getClientRects().length)
      .flatMap((node) => {
        const svg = node as SVGSVGElement,
          b = svg.getBBox();
        return svg.getAttribute("viewBox") !== "0 0 24 24" ||
          b.x < 1 ||
          b.y < 1 ||
          b.x + b.width > 23 ||
          b.y + b.height > 23 ||
          Math.abs(b.x + b.width / 2 - 12) > 1 ||
          Math.abs(b.y + b.height / 2 - 12) > 1
          ? [svg.outerHTML]
          : [];
      }),
  );
  expect(issues).toEqual([]);
  await expect(page.locator("#menu")).toHaveAccessibleName("Открыть меню");
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  for (const id of ["settings-back", "close"]) {
    const box = await page.locator("#" + id).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const theme of ["light", "dark"])
  test(`seasonal engravings fit the medal and keep independent fill masks in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/");
    const result = await page.evaluate(async (theme) => {
      const { trophyMark } = await import("/src/trophies.ts");
      document.documentElement.dataset.theme = theme;
      const host = document.createElement("section");
      document.body.append(host);
      host.innerHTML = Array.from({ length: 12 }, (_, month) =>
        [0, 4, 7, 14, 30]
          .map((count) =>
            trophyMark(`2025-${String(month + 1).padStart(2, "0")}`, count, 30),
          )
          .join(""),
      ).join("");
      const bad: string[] = [];
      for (const svg of host.querySelectorAll<SVGSVGElement>(".medal-art")) {
        const matrix = svg.getScreenCTM()!.inverse();
        for (const group of svg.querySelectorAll<SVGGElement>(
          ".medal-emblem",
        )) {
          const b = group.getBBox(),
            m = matrix.multiply(group.getScreenCTM()!);
          for (const [x, y] of [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x, b.y + b.height],
            [b.x + b.width, b.y + b.height],
          ]) {
            const point = new DOMPoint(x, y).matrixTransform(m);
            if (Math.hypot(point.x - 32, point.y - 44) > 19)
              bad.push(group.outerHTML);
          }
        }
        const ink = svg.querySelector<SVGRectElement>(".medal-ink-level")!;
        const liquid = svg.querySelector<SVGRectElement>(".medal-liquid")!;
        if (
          ink.getAttribute("height") !== liquid.getAttribute("height") ||
          ink.getAttribute("y") !== liquid.getAttribute("y")
        )
          bad.push("Fill mask mismatch");
      }
      const ids = [...host.querySelectorAll("[id]")].map((n) => n.id);
      return {
        bad,
        idsUnique: new Set(ids).size === ids.length,
        medals: host.querySelectorAll(".medal-art").length,
      };
    }, theme);
    expect(result.bad).toEqual([]);
    expect(result.idsUnique).toBe(true);
    expect(result.medals).toBe(60);
  });
