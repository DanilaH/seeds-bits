/** Small original line emblems, one for each calendar month. */
const paths = [
  "M24 5v38M7 14l34 20M7 34l34-20M18 9l6 6 6-6M18 39l6-6 6 6M8 21l8-2-1-8M40 27l-8 2 1 8",
  "M24 39S5 28 7 17c2-10 13-10 17-2 4-8 15-8 17 2 2 11-17 22-17 22Z",
  "M24 42V24M24 30C7 30 8 10 8 10s17 1 16 20ZM24 23C24 7 40 6 40 6s1 17-16 17Z",
  "M24 30v13M24 30C4 38 4 13 18 18 7 2 34 0 30 17 46 9 48 37 29 30ZM20 24h8",
  "M11 38C0 10 26 3 40 6c2 25-12 39-29 32ZM11 38l24-25M19 30l-2-10M26 23l8 1",
  "M24 4v5M24 39v5M4 24h5M39 24h5M9 9l4 4M35 35l4 4M9 39l4-4M35 13l4-4M24 14a10 10 0 1 0 0 20 10 10 0 1 0 0-20",
  "M9 34C-3 10 49 1 40 34L24 42ZM24 42V10M24 42L12 18M24 42l12-24",
  "M24 14a10 10 0 1 0 0 20 10 10 0 1 0 0-20M20 14L24 4l4 10M34 20l10 4-10 4M28 34l-4 10-4-10M14 28L4 24l10-4",
  "M24 14C4 3 3 32 16 40c4 3 6-1 8-1s4 4 8 1c13-8 12-37-8-26ZM24 14c-2-8 3-10 6-11M25 9c7-6 12-2 12-2-3 6-8 5-12 2",
  "M13 21c0 17 11 22 11 22s11-5 11-22ZM9 21c0-17 30-17 30 0ZM24 8l3-5M14 16l5 5M23 12l9 9M32 13l5 5",
  "M24 43V8M24 31L7 25l5-5-6-9 12 3 6-10 6 10 12-3-6 9 5 5-17 6M24 31l-9 6 2-10M24 31l9 6-2-10",
  "M24 4L11 19h7L7 31h12v10h10V31h12L30 19h7ZM17 42h14",
];

let artworkId = 0;
const metals = [
  { name: "Бронза", color: "#b77946", light: "#f2d0a1" },
  { name: "Серебро", color: "#8c9eb3", light: "#e6edf6" },
  { name: "Золото", color: "#d0a037", light: "#ffeb9e" },
];
/** Show a reached milestone at its boundary; otherwise fill the next one. */
export function trophyMark(
  month: string,
  count: number,
  total: number,
  pending = false,
) {
  const i = count <= 7 ? 0 : count <= 14 ? 1 : 2;
  const metal = metals[i],
    target = [7, 14, total][i],
    filled = Math.min(count, target);
  const complete = filled === target;
  const title =
    complete && !pending
      ? ["Бронза получена", "Серебро получено", "Золото получено"][i]
      : metal.name;
  const note = pending
    ? "Ожидает сохранения"
    : complete
      ? i === 0
        ? "До серебра — 7 дней"
        : i === 1
          ? `До золота — ${total - 14} дней`
          : "Месяц пройден"
      : i === 1
        ? "Бронза получена"
        : i === 2
          ? "Бронза и серебро получены"
          : "";
  const id = `medal-${++artworkId}`;
  return `<span class="trophy-display"><span class="trophy-mark${complete ? " earned" : ""}" data-tier="${i + 1}" style="--metal:${metal.color};--metal-light:${metal.light}"><svg class="medal-art" viewBox="0 0 64 76" aria-hidden="true"><defs><clipPath id="${id}-clip"><circle cx="32" cy="44" r="24"/></clipPath><linearGradient id="${id}-metal" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="${metal.color}"/><stop offset=".62" stop-color="${metal.light}"/><stop offset="1" stop-color="${metal.color}"/></linearGradient></defs><path class="medal-ribbon" d="M15 2h13l7 24-13 6ZM36 2h13l-7 30-13-6Z"/><circle class="medal-base" cx="32" cy="44" r="24"/><g clip-path="url(#${id}-clip)"><rect class="medal-liquid" data-target="${target}" x="8" y="${68 - (48 * filled) / target}" width="48" height="${(48 * filled) / target}" fill="url(#${id}-metal)"/></g><circle class="medal-ring" cx="32" cy="44" r="24"/><circle class="medal-inner" cx="32" cy="44" r="19"/><g class="medal-emblem" transform="translate(18 30) scale(.58)"><path d="${paths[Number(month.slice(5)) - 1]}"/></g>${complete ? '<path class="medal-check" d="m43 61 3 3 6-7"/>' : ""}</svg><span class="metal-name">${title}</span><span class="metal-count">${filled} из ${target} дней</span><span class="medal-note">${note}</span></span></span>`;
}

/** A bounded, local burst. It owns no rewards, timers or input and cancels on navigation. */
export function celebrateTrophy(
  host: HTMLElement,
  tier: number,
  reduced: boolean,
) {
  const mark = host.querySelector<HTMLElement>(
    `[data-tier="${tier}"] .medal-art`,
  );
  if (!mark || reduced) return () => {};
  const animations: Animation[] = [
    mark.animate(
      [
        { transform: "scale(.86) rotate(-5deg)" },
        { transform: "scale(1.12) rotate(3deg)", offset: 0.5 },
        { transform: "scale(1) rotate(0)" },
      ],
      { duration: 440, easing: "ease-out" },
    ),
  ];
  const layer = document.createElement("span");
  layer.className = "trophy-confetti";
  layer.setAttribute("aria-hidden", "true");
  const box = mark.getBoundingClientRect(),
    parent = host.getBoundingClientRect();
  const x = box.x + box.width / 2 - parent.x,
    y = box.y + box.height / 2 - parent.y;
  for (let i = 0; i < 16; i++) {
    const piece = document.createElement("i");
    const angle = (i / 16) * Math.PI * 2;
    const dx = Math.cos(angle) * (40 + (i % 3) * 15),
      dy = Math.sin(angle) * 38 - 30;
    piece.style.cssText = `left:${x}px;top:${y}px;background:${["#c58b4c", "#e8c46d", "#a2b3c6", "#d3b792"][i % 4]}`;
    layer.append(piece);
    animations.push(
      piece.animate(
        [
          { opacity: 0, transform: "translate(0,0) scale(.5)" },
          {
            opacity: 1,
            transform: `translate(${dx * 0.65}px,${dy}px) rotate(${i * 27}deg)`,
            offset: 0.35,
          },
          {
            opacity: 0,
            transform: `translate(${dx}px,${dy + 45}px) rotate(${i * 50}deg)`,
          },
        ],
        { duration: 650 + (i % 3) * 60, easing: "ease-out", fill: "both" },
      ),
    );
  }
  host.append(layer);
  const clear = () => {
    animations.forEach((a) => a.cancel());
    layer.remove();
  };
  void Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() =>
    layer.remove(),
  );
  return clear;
}
