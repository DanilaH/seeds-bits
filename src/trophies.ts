import { icon, monthEmblem } from "./icons";

const ribbon =
  '<path class="medal-ribbon" d="M16 3h12l9 25-12 5L16 3ZM36 3h12l-9 30-12-5L36 3Z"/><path class="medal-fold" d="m20 3 7 21M44 3l-7 21"/>';
const rim =
  '<circle class="medal-ring" cx="32" cy="44" r="24"/><circle class="medal-inner" cx="32" cy="44" r="19"/>';
const emblemTransform = "translate(18 30) scale(1.166667)";
let artworkId = 0;
const metals = [
  { name: "Бронза", color: "#b77946", light: "#f2d0a1", ink: "#58351b" },
  { name: "Серебро", color: "#8c9eb3", light: "#e6edf6", ink: "#3a4e65" },
  { name: "Золото", color: "#d0a037", light: "#ffeb9e", ink: "#60430b" },
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
    : complete && i === 2
      ? "Все медали месяца собраны"
      : !complete && i === 1
        ? "Бронза получена"
        : !complete && i === 2
          ? "Бронза и серебро получены"
          : "";
  const next = i < 2 ? metals[i + 1] : undefined;
  const left = [14, total][i] - count;
  const taskWord =
    left % 10 === 1 && left % 100 !== 11
      ? "задача"
      : left % 10 >= 2 &&
          left % 10 <= 4 &&
          !(left % 100 >= 12 && left % 100 <= 14)
        ? "задачи"
        : "задач";
  const emblem = monthEmblem(Number(month.slice(5)));
  const preview = next
    ? `<span class="next-medal" style="--preview-metal:${next.color}" aria-label="Следующая медаль: ${next.name}, ещё ${left} ${taskWord}"><span class="next-eyebrow">${complete && !pending ? "Следующая" : "Следом"}</span><svg class="next-medal-art" viewBox="0 0 64 76" aria-hidden="true" focusable="false">${ribbon}${rim}<g class="medal-emblem" transform="${emblemTransform}">${emblem}</g></svg><strong>${next.name}</strong><span class="next-count">Ещё ${left} ${taskWord}</span></span>`
    : "";
  const id = `medal-${++artworkId}`;
  const fillY = 68 - (48 * filled) / target;
  const fillHeight = (48 * filled) / target;
  return `<span class="trophy-display${next ? " has-next" : ""}"><span class="trophy-mark${complete ? " earned" : ""}" data-tier="${i + 1}" style="--metal:${metal.color};--metal-light:${metal.light};--metal-ink:${metal.ink}"><span class="medal-figure"><svg class="medal-art" viewBox="0 0 64 76" aria-hidden="true" focusable="false"><defs><clipPath id="${id}-clip"><circle cx="32" cy="44" r="24"/></clipPath><clipPath id="${id}-ink"><rect class="medal-ink-level" data-target="${target}" x="8" y="${fillY}" width="48" height="${fillHeight}"/></clipPath><linearGradient id="${id}-metal" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="${metal.color}"/><stop offset=".62" stop-color="${metal.light}"/><stop offset="1" stop-color="${metal.color}"/></linearGradient></defs>${ribbon}<circle class="medal-base" cx="32" cy="44" r="24"/><g clip-path="url(#${id}-clip)"><rect class="medal-liquid" data-target="${target}" x="8" y="${fillY}" width="48" height="${fillHeight}" fill="url(#${id}-metal)"/><path class="medal-sheen" d="M-36 10h12l78 78H42Z" fill="#fff" opacity="0"/></g>${rim}<g class="medal-emblem" transform="${emblemTransform}">${emblem}</g><g clip-path="url(#${id}-ink)"><g class="medal-emblem on-metal" transform="${emblemTransform}">${emblem}</g></g></svg><span class="medal-receipt" aria-hidden="true" ${complete && !pending ? "" : "hidden"}>${icon("check")}</span></span><span class="metal-name">${title}</span><span class="metal-count">${filled} из ${target} дней</span><span class="medal-note">${note}</span></span>${preview}</span>`;
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
        { transform: "scale(.8) rotate(-7deg)" },
        { transform: "scale(1.2) rotate(4deg)", offset: 0.46 },
        { transform: "scale(.98) rotate(-1deg)", offset: 0.8 },
        { transform: "scale(1) rotate(0)" },
      ],
      { duration: 560, easing: "ease-out" },
    ),
  ];
  const sheen = mark.querySelector(".medal-sheen");
  if (sheen)
    animations.push(
      sheen.animate(
        [
          { opacity: 0, transform: "translateX(-40px)" },
          { opacity: 0.7, transform: "translateX(18px)", offset: 0.5 },
          { opacity: 0, transform: "translateX(80px)" },
        ],
        { duration: 650, delay: 100, easing: "ease-in-out" },
      ),
    );
  const receipt = mark.parentElement?.querySelector(".medal-receipt");
  if (receipt)
    animations.push(
      receipt.animate(
        [
          { opacity: 0, transform: "scale(.5) rotate(-20deg)" },
          { opacity: 1, transform: "scale(1.15) rotate(-4deg)", offset: 0.6 },
          { opacity: 1, transform: "scale(1) rotate(-8deg)" },
        ],
        { duration: 430, delay: 120, easing: "ease-out", fill: "backwards" },
      ),
    );
  const layer = document.createElement("span");
  layer.className = "trophy-confetti";
  layer.setAttribute("aria-hidden", "true");
  const box = mark.getBoundingClientRect(),
    parent = host.getBoundingClientRect();
  const x = box.x + box.width / 2 - parent.x,
    y = box.y + (box.height * 44) / 76 - parent.y;
  const palette = [
    "#ffffff",
    "#f3c86b",
    "#e58b74",
    "#80b4db",
    "#c3ade3",
    "#fff2cb",
  ];
  const spread = Math.min(116, Math.max(55, parent.width / 2 - 10));
  for (let i = 0; i < 32; i++) {
    const piece = document.createElement("i");
    const angle = (i / 32) * Math.PI * 2;
    const dx = Math.cos(angle) * spread * (0.72 + (i % 4) * 0.08),
      dy = Math.sin(angle) * (62 + (i % 3) * 11) - 22;
    piece.dataset.shape = ["rect", "diamond", "strip"][i % 3];
    piece.dataset.white = String(i % palette.length === 0);
    piece.style.cssText = `left:${x}px;top:${y}px;background:${palette[i % palette.length]}`;
    layer.append(piece);
    const tilt = i * 23,
      spin = 100 + i * 19;
    animations.push(
      piece.animate(
        [
          {
            opacity: 0,
            transform: `translate(0,0) rotate(${tilt}deg) scale(.5)`,
          },
          {
            opacity: 1,
            transform: `translate(${dx * 0.7}px,${dy}px) rotate(${tilt + spin * 0.4}deg) rotateY(${i % 2 ? 45 : -40}deg)`,
            offset: 0.35,
          },
          {
            opacity: 0.9,
            transform: `translate(${dx * 0.9}px,${dy + 26}px) rotate(${tilt + spin * 0.7}deg) rotateY(${i % 2 ? 100 : -90}deg)`,
            offset: 0.7,
          },
          {
            opacity: 0,
            transform: `translate(${dx}px,${dy + 88}px) rotate(${tilt + spin}deg) rotateY(${i % 2 ? 160 : -160}deg)`,
          },
        ],
        { duration: 1000 + (i % 4) * 70, easing: "ease-out", fill: "both" },
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
