import { WIDTH, type Board, type Connection } from "./core";
/** Preserve cell nodes during selection and retain surviving nodes on row collapse. */
export class BoardView {
  private nodes: HTMLElement[] = [];
  private values: number[] = [];
  private marked = new Set<number>();
  private remapped = false;
  private focusIndex = 0;
  private measuredDigit: HTMLElement | null = null;
  private rowFrame = 0;
  private rowObserver = new ResizeObserver(() => {
    cancelAnimationFrame(this.rowFrame);
    this.rowFrame = requestAnimationFrame(() => this.fitRow());
  });
  constructor(private root: HTMLElement) {
    this.rowObserver.observe(root);
    root.addEventListener("focusin", (event) => {
      const target = event.target as HTMLElement;
      if (target.matches("button.cell")) {
        this.focusIndex = Number(target.dataset.index);
        this.tabStops();
      }
    });
  }
  private fitRow() {
    if (!this.measuredDigit?.isConnected) return;
    // Android text zoom can enlarge rendered glyphs without changing CSS em.
    // Measure one digit, not the whole field, and share its row with the grid.
    const range = document.createRange();
    range.selectNodeContents(this.measuredDigit);
    const transform = new DOMMatrixReadOnly(
      getComputedStyle(this.measuredDigit).transform,
    );
    const scale = Math.hypot(transform.c, transform.d) || 1;
    const height = range.getBoundingClientRect().height / scale;
    if (!height) return;
    const row = Math.ceil(height + 4 - 0.01) + "px";
    if (this.root.style.getPropertyValue("--board-digit-row") !== row)
      this.root.style.setProperty("--board-digit-row", row);
  }
  private tabStops() {
    if (!this.values[this.focusIndex])
      this.focusIndex = this.values.findIndex(Boolean);
    this.nodes.forEach((n, i) => {
      if (n.tagName === "BUTTON") n.tabIndex = i === this.focusIndex ? 0 : -1;
    });
  }
  cell(index: number) {
    return this.nodes[index] ?? null;
  }
  remap(positions: Map<number, number>) {
    const old = this.nodes;
    this.remapped =
      positions.size !== old.length ||
      [...positions].some(([to, from]) => to !== from);
    for (const i of this.marked) {
      old[i]?.classList.remove("selected", "hinted");
      old[i]?.setAttribute("aria-pressed", "false");
    }
    this.marked.clear();
    this.nodes = [...positions.keys()].map((n) => old[positions.get(n)!]);
    this.values = [...positions.keys()].map(
      (n) => this.values[positions.get(n)!],
    );
  }
  render(values: Board, selected: number, hint: Connection | null) {
    const changed =
      this.remapped ||
      values.length !== this.values.length ||
      values.some((v, i) => v !== this.values[i]);
    if (changed) {
      this.root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      const length = Math.ceil(values.length / WIDTH) * WIDTH;
      const desired: HTMLElement[] = [];
      for (let i = 0; i < length; i++) {
        const value = values[i] || 0;
        let node = this.nodes[i];
        if (
          node &&
          this.values[i] === value &&
          node.dataset.index === String(i)
        ) {
          desired.push(node);
          continue;
        }
        if (!node || (node.tagName === "BUTTON") !== Boolean(value)) {
          node = document.createElement(value ? "button" : "span");
          node.className = value ? "cell" : "cell empty";
          if (!value) node.setAttribute("aria-hidden", "true");
        }
        if (node.dataset.index !== String(i)) node.dataset.index = String(i);
        if (value) {
          let digit = node.querySelector<HTMLElement>(".digit");
          if (!digit) {
            digit = document.createElement("span");
            digit.className = "digit";
            digit.setAttribute("aria-hidden", "true");
            node.replaceChildren(digit);
          }
          if (digit.textContent !== String(value))
            digit.textContent = String(value);
          const label = `${value}, строка ${Math.floor(i / WIDTH) + 1}, столбец ${(i % WIDTH) + 1}`;
          if (node.getAttribute("aria-label") !== label)
            node.setAttribute("aria-label", label);
        }
        if (node.matches(".erasing, .selected, .hinted"))
          node.classList.remove("erasing", "selected", "hinted");
        if (value && node.getAttribute("aria-pressed") !== "false")
          node.setAttribute("aria-pressed", "false");
        desired.push(node);
      }
      const keep = new Set(desired);
      for (const child of [...this.root.children])
        if (!keep.has(child as HTMLElement)) child.remove();
      let cursor = this.root.firstElementChild;
      for (const node of desired) {
        if (cursor === node) cursor = cursor.nextElementSibling;
        else this.root.insertBefore(node, cursor);
      }
      this.nodes = desired;
      this.values = [...values];
      this.remapped = false;
      const digit = this.root.querySelector<HTMLElement>(".digit");
      if (digit !== this.measuredDigit) {
        if (this.measuredDigit) this.rowObserver.unobserve(this.measuredDigit);
        this.measuredDigit = digit;
        if (digit) this.rowObserver.observe(digit);
      }
    }
    const marked = new Set(
      [selected, hint?.a ?? -1, hint?.b ?? -1].filter((i) => i >= 0),
    );
    for (const i of new Set([...this.marked, ...marked])) {
      const n = this.nodes[i];
      if (!n) continue;
      n.classList.toggle("selected", i === selected);
      n.classList.toggle(
        "hinted",
        Boolean(hint && (i === hint.a || i === hint.b)),
      );
      if (n.tagName === "BUTTON")
        n.setAttribute("aria-pressed", String(i === selected));
    }
    this.marked = marked;
    this.tabStops();
  }
}
