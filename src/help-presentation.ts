/** Bounded feedback for already-saved assistance. Never owns a game action. */
type Digit = { index: number; value: string; rect: DOMRect };
export type HelpFrame = {
  root: HTMLElement;
  digits: Digit[];
  values: number[];
  viewport?: { width: number; height: number };
};
const active = new Map<HTMLElement, () => void>();
let listening = false,
  epoch = 0;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function clearHelpEffects(root?: HTMLElement) {
  if (root) active.get(root)?.();
  else {
    epoch++;
    for (const clear of [...active.values()]) clear();
  }
}
function listen() {
  if (!listening) {
    listening = true;
    window.addEventListener("resize", () => clearHelpEffects());
    window.addEventListener("blur", () => clearHelpEffects());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearHelpEffects();
    });
    document.addEventListener("pointerdown", () => clearHelpEffects(), {
      passive: true,
      capture: true,
    });
    document.addEventListener("keydown", () => clearHelpEffects(), {
      capture: true,
    });
  }
}
export function helpEffectEpoch() {
  listen();
  return epoch;
}
function begin(root: HTMLElement) {
  listen();
  clearHelpEffects(root);
  if (reduced() || document.hidden || !root.isConnected) return;
  const nodes: HTMLElement[] = [],
    animations: Animation[] = [];
  let timer: ReturnType<typeof setTimeout>;
  const clear = () => {
    clearTimeout(timer);
    animations.forEach((a) => a.cancel());
    nodes.forEach((n) => n.remove());
    if (active.get(root) === clear) active.delete(root);
  };
  active.set(root, clear);
  timer = setTimeout(clear, 650);
  return {
    nodes,
    animations,
    clear,
    host: root.closest("dialog") ?? document.body,
  };
}
const index = (n: HTMLElement) =>
  Number(n.dataset.index ?? n.dataset.labIndex ?? n.dataset.shuffleIndex);
const digits = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>(
    "[data-index],[data-lab-index],[data-shuffle-index]",
  ),
];
export function captureHelpFrame(root: HTMLElement): HelpFrame {
  const values: number[] = [],
    visible: Digit[] = [];
  const clip = (root.closest("#viewport") ?? root).getBoundingClientRect();
  for (const n of digits(root)) {
    const i = index(n),
      value = n.textContent?.trim() ?? "";
    values[i] = Number(value) || 0;
    if (!value || visible.length >= 54) continue;
    const r = n.getBoundingClientRect();
    if (
      r.width &&
      r.height &&
      r.bottom > Math.max(0, clip.top) &&
      r.top < Math.min(innerHeight, clip.bottom)
    )
      visible.push({ index: i, value, rect: r });
  }
  return {
    root,
    digits: visible,
    values,
    viewport: { width: innerWidth, height: innerHeight },
  };
}
function ghost(d: Digit, scope: NonNullable<ReturnType<typeof begin>>) {
  const n = document.createElement("span");
  n.className = "assist-ghost";
  n.textContent = d.value;
  n.setAttribute("aria-hidden", "true");
  Object.assign(n.style, {
    left: d.rect.x + "px",
    top: d.rect.y + "px",
    width: d.rect.width + "px",
    height: d.rect.height + "px",
  });
  scope.host.append(n);
  scope.nodes.push(n);
  return n;
}
function pulse(
  root: HTMLElement,
  pair: readonly number[],
  scope: NonNullable<ReturnType<typeof begin>>,
) {
  for (const i of pair) {
    const n = digits(root).find((n) => index(n) === i);
    if (!n) continue;
    scope.animations.push(
      n.animate(
        [
          {
            boxShadow: "inset 0 0 0 2px var(--accent)",
            background: "var(--selected)",
          },
          { boxShadow: "inset 0 0 0 0 transparent" },
        ],
        { duration: 380, easing: "ease-out" },
      ),
    );
  }
}
export function presentHelpStep(root: HTMLElement, pair: readonly number[]) {
  const scope = begin(root);
  if (scope) pulse(root, pair, scope);
}
export function presentHelpChange(
  frame: HelpFrame,
  kind: "magnet" | "shuffle" | "add" | "undo" | "pair",
  pair: readonly number[] = [],
  nextPair: readonly number[] = [],
) {
  const root = frame.root,
    scope = begin(root);
  if (!scope) return;
  const after = digits(root).filter((n) => Number(n.textContent?.trim()) > 0);
  const sameViewport =
    !frame.viewport ||
    (frame.viewport.width === innerWidth &&
      frame.viewport.height === innerHeight);
  if (!sameViewport) {
    if (nextPair.length) pulse(root, nextPair, scope);
    return;
  }
  if (kind === "magnet") {
    const removed = frame.digits.filter((d) => pair.includes(d.index));
    if (removed.length === 2) {
      const cx =
          removed.reduce((sum, d) => sum + d.rect.x + d.rect.width / 2, 0) / 2,
        cy =
          removed.reduce((sum, d) => sum + d.rect.y + d.rect.height / 2, 0) / 2;
      for (const d of removed) {
        const n = ghost(d, scope);
        scope.animations.push(
          n.animate(
            [
              { transform: "translate(0,0) scale(1)", opacity: 1 },
              {
                transform: `translate(${cx - d.rect.x - d.rect.width / 2}px,${cy - d.rect.y - d.rect.height / 2}px) scale(.55)`,
                opacity: 0,
              },
            ],
            {
              duration: 240,
              easing: "cubic-bezier(.2,.8,.25,1)",
              fill: "forwards",
            },
          ),
        );
      }
    }
  }
  const origins: number[] = [];
  if (kind === "pair" || kind === "magnet") {
    const remaining = frame.values.map((v, i) => (pair.includes(i) ? 0 : v));
    for (let row = 0; row < remaining.length; row += 9)
      if (remaining.slice(row, row + 9).some(Boolean))
        for (let i = row; i < Math.min(row + 9, remaining.length); i++)
          origins.push(i);
  }
  const queues = new Map<string, Digit[]>();
  for (const d of frame.digits) {
    const q = queues.get(d.value) ?? [];
    q.push(d);
    queues.set(d.value, q);
  }
  for (const [order, n] of after.slice(0, 54).entries()) {
    const visual = n.querySelector<HTMLElement>(".digit,.lab-digit") ?? n;
    const i = index(n),
      r = n.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const old =
      kind === "shuffle"
        ? queues.get(n.textContent!.trim())?.shift()
        : frame.digits.find(
            (d) => d.index === (origins.length ? origins[i] : i),
          );
    if (kind === "shuffle" && old) {
      const g = ghost(old, scope);
      scope.animations.push(
        g.animate(
          [
            { transform: "translate(0,0)", opacity: 1 },
            {
              transform: `translate(${r.x - old.rect.x}px,${r.y - old.rect.y}px)`,
              opacity: 0,
            },
          ],
          {
            duration: 260,
            easing: "cubic-bezier(.2,.8,.25,1)",
            fill: "forwards",
          },
        ),
      );
      scope.animations.push(
        visual.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 260,
          easing: "ease-in",
        }),
      );
    } else if (kind === "undo" || (kind === "add" && !old)) {
      scope.animations.push(
        visual.animate(
          [
            { opacity: 0.2, transform: "scale(.78)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 180, delay: Math.min(order, 8) * 10, easing: "ease-out" },
        ),
      );
    } else if (
      old &&
      (Math.abs(old.rect.y - r.y) > 1 || Math.abs(old.rect.x - r.x) > 1)
    ) {
      scope.animations.push(
        visual.animate(
          [
            {
              transform: `translate(${old.rect.x - r.x}px,${old.rect.y - r.y}px)`,
            },
            { transform: "translate(0,0)" },
          ],
          { duration: 180, easing: "ease-out" },
        ),
      );
    }
  }
  if (nextPair.length) pulse(root, nextPair, scope);
}
