import { t } from "./i18n";
import { icon } from "./icons";
import { OwnedDomMotion } from "./vendor/mini-games-kit/owned-dom-motion";

export type ResultKind = "classic" | "daily" | "task" | "page" | "book";

/** Completion order, rather than task number, identifies a newly filled page.
 * Replaying another task in an already completed book is still a task result. */
export function resultKind(
  id: string,
  done: readonly string[],
  tasks: readonly { id: string }[],
  newlyCompleted = true,
): ResultKind {
  if (id === "classic") return "classic";
  if (id.startsWith("daily")) return "daily";
  if (!newlyCompleted) return "task";
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return "task";
  const finished = new Set(done);
  const completes = (size: number) => {
    const group = tasks.slice(
      Math.floor(index / size) * size,
      Math.floor(index / size) * size + size,
    );
    const ids = new Set(group.map((t) => t.id));
    return (
      group.length === size &&
      group.every((t) => finished.has(t.id)) &&
      [...done].reverse().find((t) => ids.has(t)) === id
    );
  };
  return completes(24) ? "book" : completes(6) ? "page" : "task";
}

/** Code-native paper artwork; the saved result is already complete at rest. */
export function resultArtwork(kind: ResultKind): string {
  if (kind === "classic")
    return '<svg class="result-field-art" viewBox="0 0 144 144" aria-hidden="true" focusable="false"><circle class="result-field-halo" cx="72" cy="72" r="61"/><g class="result-sprout"><path class="result-field-stem" d="M28 114C10 98 11 74 20 59M116 114c18-16 17-40 8-55"/><path class="result-field-seed" d="M17 82C5 77 5 65 11 60c9 7 12 15 6 22ZM21 105C8 105 3 95 6 88c11 2 18 8 15 17ZM127 82c12-5 12-17 6-22-9 7-12 15-6 22ZM123 105c13 0 18-10 15-17-11 2-18 8-15 17Z"/></g><rect class="result-field-paper" x="34" y="24" width="76" height="94" rx="9"/><path class="result-field-grid" d="M59 24v94M85 24v94M34 55h76M34 87h76"/><g class="result-clearing-cells"><rect x="37" y="27" width="19" height="25" rx="3"/><rect x="62" y="27" width="20" height="25" rx="3"/></g><g class="result-field-check"><circle cx="72" cy="74" r="23"/><path d="m60 74 8 8 17-18"/></g></svg>';
  if (kind !== "page" && kind !== "book") return icon("check");
  const sheet =
    '<path class="result-paper" d="M24 10h64l17 18v88H24z"/><path class="result-fold" d="M88 10v18h17"/>';
  const content =
    kind === "page"
      ? sheet +
        Array.from({ length: 6 }, (_, i) => {
          const x = 36 + (i % 2) * 34,
            y = 44 + Math.floor(i / 2) * 26;
          return `<g class="result-mark${i === 5 ? " result-last-mark" : ""}"><rect x="${x}" y="${y}" width="22" height="18" rx="4"/><path d="m${x + 5} ${y + 9} 4 4 8-9"/></g>`;
        }).join("")
      : Array.from(
          { length: 4 },
          (_, i) =>
            `<g class="result-leaf" style="--leaf:${i}" transform="translate(${i * 2} ${-i * 2})"><rect class="result-paper" x="26" y="15" width="75" height="101" rx="5"/></g>`,
        ).join("") +
        '<g class="result-cover"><rect x="20" y="13" width="83" height="106" rx="6"/><path d="M34 13v106M44 37h43M44 45h30"/><circle cx="66" cy="78" r="20"/><path class="result-book-check" d="m55 77 8 8 15-17"/></g>';
  return `<svg class="result-paper-art" viewBox="0 0 132 132" aria-hidden="true" focusable="false">${content}</svg><span class="result-stamp">${kind === "page" ? t("ui.done") : "24/24"}</span>`;
}

/** No timers or gameplay locks. Navigation cancels every animation and particle. */
export function celebrateResult(
  host: HTMLElement,
  kind: ResultKind,
  reduced: boolean,
) {
  if (reduced) return Object.assign(() => {}, {finished: Promise.resolve()});
  const owner = new OwnedDomMotion();
  const pose = getComputedStyle(host).transform;
  const base = pose === "none" ? "rotate(0deg)" : pose;
  const animations: Animation[] = [];
  const animate = (
    node: Element | null,
    frames: Keyframe[],
    duration: number,
  ) => {
    const animation = owner.animate(node, frames, {duration, easing: "cubic-bezier(.2,.8,.3,1)"});
    if (animation) animations.push(animation);
  };
  if (kind === "classic" || kind === "daily") {
    animate(host, [
      {transform: `${base} scale(.96)`},
      {transform: `${base} scale(1.025)`,offset:.5},
      {transform: `${base} scale(1)`},
    ], kind === "classic" ? 500 : 420);
    animate(
      host.querySelector(".result-clearing-cells"),
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(.6)" },
      ],
      280,
    );
    animate(
      host.querySelector(".result-field-check"),
      [
        { opacity: 0, transform: "scale(.65)" },
        { opacity: 0, offset: 0.25 },
        { opacity: 1, transform: "scale(1)" },
      ],
      480,
    );
    animate(
      host.querySelector(".result-sprout"),
      [
        { opacity: 0, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      500,
    );
  } else if (kind === "book") {
    animate(host, [
      {transform: `${base} scale(.96)`},
      {transform: `${base} scale(1.035)`,offset:.4},
      {transform: `${base} scale(1)`},
    ], 680);
    for (const [i, leaf] of [
      ...host.querySelectorAll(".result-leaf"),
    ].entries())
      animate(
        leaf,
        [
          { transform: `translateY(${-i * 5}px) rotate(${8 + i * 4}deg)` },
          { transform: "translateY(0) rotate(0)" },
        ],
        500,
      );
    animate(
      host.querySelector(".result-cover"),
      [
        { transform: "rotate(-16deg) scaleX(.75)" },
        { transform: "rotate(0) scaleX(1)" },
      ],
      560,
    );
  } else if (kind === "page") {
    animate(
      host.querySelector(".result-last-mark"),
      [
        { opacity: 0.1, transform: "scale(.4)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      240,
    );
  } else
    animate(
      host.querySelector(".win-symbol"),
      [
        { transform: "scale(.82)" },
        { transform: "scale(1.05)", offset: .55 },
        { transform: "scale(1)" },
      ],
      300,
    );
  animate(
    host.querySelector(".result-stamp"),
    [
      { opacity: 0, transform: "scale(1.4) rotate(-12deg)" },
      { opacity: 1, transform: "scale(1) rotate(-5deg)" },
    ],
    kind === "book" ? 600 : 400,
  );
  const burst = document.createElement("span");
  burst.className = "result-seed-burst";
  burst.setAttribute("aria-hidden", "true");
  if (kind === "book" || kind === "classic") {
    host.append(burst);
    const count = kind === "book" ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const grain = document.createElement("i");
      burst.append(grain);
      const a = (i * Math.PI * 2) / count;
      grain.style.background = ["var(--table-cover)", "#ac5b3e", "#be983d"][i % 3];
      animate(
        grain,
        [
          { transform: "translate(0,0) scale(.3)", opacity: 0 },
          { opacity: 1, offset: 0.2 },
          {
            transform: `translate(${Math.cos(a) * (92 + i % 3 * 14)}px,${Math.sin(a) * 90 + 28}px) rotate(${i * 43}deg)`,
            opacity: 0,
          },
        ],
        620 + i % 3 * 35,
      );
    }
  }
  const clear = () => {
    owner.cancelAll();
    burst.remove();
  };
  const finished = Promise.allSettled(animations.map((a) => a.finished)).then(() => { burst.remove(); });
  return Object.assign(clear, {finished});
}
