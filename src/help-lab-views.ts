import { icon } from "./icons";
export type LabCue =
  "magnet" | "plan" | "shuffle" | "add" | "undo" | "pair" | "select" | "reject";
export type LabFeedback = (cue: LabCue, stage?: number) => void;
export const labTag = '<p class="lab-tag">QA · без настоящей рекламы</p>';
export const labHeading = (title: string, close = "lab-close") =>
  `<div class="lab-heading"><h2>${title}</h2><button id="${close}" aria-label="Закрыть">${icon("close")}</button></div>`;
export function labCells(
  board: readonly number[],
  attribute: string,
  marked: readonly number[] = [],
) {
  return board
    .map(
      (n, i) =>
        `<button type="button" ${attribute}="${i}" class="${marked.includes(i) ? "lab-guided" : ""}" ${n ? "" : "disabled"} aria-label="${n || "Пусто"}, клетка ${i + 1}">${n ? `<span class="lab-digit" aria-hidden="true">${n}</span>` : ""}</button>`,
    )
    .join("");
}
export const labHelp = (text: string) =>
  `<details class="lab-help"><summary>Как работает</summary><p>${text}</p></details>`;

const actionObservers = new WeakMap<HTMLElement, ResizeObserver>();
/** Keep whole action words at the actual font size, including system text zoom. */
export function fitLabActions(dialog: HTMLElement) {
  actionObservers.get(dialog)?.disconnect();
  let scheduled = false;
  const fit = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      let minimum = 92;
      for (const button of dialog.querySelectorAll<HTMLElement>(
        ".lab-actions button",
      )) {
        const style = getComputedStyle(button),
          measure = document.createElement("span");
        Object.assign(measure.style, {
          position: "fixed",
          visibility: "hidden",
          whiteSpace: "nowrap",
          font: style.font,
          letterSpacing: style.letterSpacing,
        });
        dialog.append(measure);
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          for (const word of node.textContent?.match(/\S+/g) ?? []) {
            measure.textContent = word;
            minimum = Math.max(
              minimum,
              measure.getBoundingClientRect().width +
                parseFloat(style.paddingLeft) +
                parseFloat(style.paddingRight) +
                4,
            );
          }
        }
        measure.remove();
      }
      dialog.style.setProperty("--lab-control-min", `${Math.ceil(minimum)}px`);
    });
  };
  const observer = new ResizeObserver(fit);
  actionObservers.set(dialog, observer);
  observer.observe(dialog);
  dialog
    .querySelectorAll(".lab-actions button")
    .forEach((button) => observer.observe(button));
  fit();
}
