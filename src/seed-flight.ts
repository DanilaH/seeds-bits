/** Bounded transform animations: no full-screen canvas, per-frame JS or layout reads. */
export class SeedFlight {
  private layer = document.createElement("div");
  private active = new Map<HTMLElement, () => void>();
  constructor() {
    this.layer.id = "seed-flights";
    this.layer.setAttribute("aria-hidden", "true");
    document.body.append(this.layer);
  }
  fly(rects: DOMRect[], target: HTMLElement, land: () => void) {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.hidden
    ) {
      rects.forEach(land);
      return;
    }
    const box = target.getBoundingClientRect(),
      tx = box.left + box.width / 2,
      ty = box.top + box.height * 0.55;
    for (const [i, r] of rects.entries()) {
      if (this.active.size >= 12) {
        land();
        continue;
      }
      const x = Math.max(8, Math.min(innerWidth - 8, r.left + r.width / 2));
      const y = Math.max(8, Math.min(innerHeight - 8, r.top + r.height / 2));
      const side = x < tx ? -1 : 1;
      const cx = Math.max(
        8,
        Math.min(
          innerWidth - 8,
          (x + tx) / 2 + side * (24 + Math.random() * 45),
        ),
      );
      const cy = Math.max(12, Math.min(y, ty) - 20 - Math.random() * 40);
      const seed = document.createElement("i");
      seed.className = "flying-seed";

      this.layer.append(seed);
      const duration =
        420 + Math.min(220, Math.abs(y - ty) * 0.3) + Math.random() * 70;
      const frames = Array.from({ length: 33 }, (_, step) => {
        const t = step / 32,
          px = (1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t * t * tx,
          py = (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * ty;
        const angle =
          (Math.atan2(
            2 * (1 - t) * (cy - y) + 2 * t * (ty - cy),
            2 * (1 - t) * (cx - x) + 2 * t * (tx - cx),
          ) *
            180) /
          Math.PI;
        return {
          transform: `translate3d(${px - 30}px,${py - 3}px,0) rotate(${angle}deg)`,
          opacity: Math.min(1, t * 12),
          offset: t,
        };
      });
      const animation = seed.animate(frames, {
        duration,
        delay: i * 55,
        easing: "cubic-bezier(.3,.05,.65,1)",
        fill: "both",
      });
      const finish = () => {
        if (!this.active.delete(seed)) return;
        animation.cancel();
        seed.remove();
        land();
      };
      this.active.set(seed, finish);
      animation.onfinish = finish;
    }
  }
  clear() {
    for (const finish of [...this.active.values()]) finish();
  }
}
