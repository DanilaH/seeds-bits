import { WIDTH, type Board, type Connection } from "./core";
/** Preserve cell nodes during selection and retain surviving nodes on row collapse. */
export class BoardView {
  private nodes: HTMLElement[] = [];
  private values: number[] = [];
  private marked = new Set<number>();
  constructor(private root: HTMLElement) {}
  remap(positions: Map<number, number>) {
    const old = this.nodes;
    this.nodes = [...positions.keys()].map((n) => old[positions.get(n)!]);
    this.values = [];
  }
  render(values: Board, selected: number, hint: Connection | null) {
    const changed =
      values.length !== this.values.length ||
      values.some((v, i) => v !== this.values[i]);
    if (changed) {
      this.root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      const length = Math.ceil(values.length / WIDTH) * WIDTH;
      const desired: HTMLElement[] = [];
      for (let i = 0; i < length; i++) {
        const value = values[i] || 0;
        let node = this.nodes[i];
        if (!node || (node.tagName === "BUTTON") !== Boolean(value)) {
          node = document.createElement(value ? "button" : "span");
          node.className = value ? "cell" : "cell empty";
          if (!value) node.setAttribute("aria-hidden", "true");
        }
        node.dataset.index = String(i);
        if (value) {
          if (node.textContent !== String(value))
            node.textContent = String(value);
          node.setAttribute(
            "aria-label",
            `${value}, строка ${Math.floor(i / WIDTH) + 1}, столбец ${(i % WIDTH) + 1}`,
          );
        }
        node.classList.remove("erasing", "selected", "hinted");
        if (value) node.setAttribute("aria-pressed", "false");
        desired.push(node);
      }
      const keep = new Set(desired);
      for (const child of [...this.root.children])
        if (!keep.has(child as HTMLElement)) child.remove();
      desired.forEach((node, i) => {
        if (this.root.children[i] !== node)
          this.root.insertBefore(node, this.root.children[i] ?? null);
      });
      this.nodes = desired;
      this.values = [...values];
      this.marked.clear();
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
  }
}
