type Point = { x: number; y: number };
type Flight = {
  from: Point;
  control: Point;
  to: Point;
  start: number;
  duration: number;
  land: () => void;
};
/** One decorative canvas; bounded particles and no layout reads in the frame loop. */
export class SeedFlight {
  private canvas = document.createElement("canvas");
  private flights: Flight[] = [];
  private frame = 0;
  constructor() {
    this.canvas.id = "seed-flights";
    this.canvas.setAttribute("aria-hidden", "true");
    document.body.append(this.canvas);
  }
  fly(rects: DOMRect[], target: HTMLElement, land: () => void) {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.hidden
    ) {
      rects.forEach(land);
      return;
    }
    const r = target.getBoundingClientRect(),
      to = { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
    this.canvas.width = innerWidth * devicePixelRatio;
    this.canvas.height = innerHeight * devicePixelRatio;
    for (const [i, r] of rects.entries()) {
      if (this.flights.length >= 12) {
        land();
        continue;
      }
      const from = {
        x: Math.max(8, Math.min(innerWidth - 8, r.left + r.width / 2)),
        y: Math.max(8, Math.min(innerHeight - 8, r.top + r.height / 2)),
      };
      const side = from.x < to.x ? -1 : 1;
      this.flights.push({
        from,
        to,
        control: {
          x: Math.max(
            8,
            Math.min(
              innerWidth - 8,
              (from.x + to.x) / 2 + side * (24 + Math.random() * 45),
            ),
          ),
          y: Math.max(12, Math.min(from.y, to.y) - 20 - Math.random() * 40),
        },
        start: performance.now() + i * 55,
        duration:
          420 +
          Math.min(220, Math.abs(from.y - to.y) * 0.3) +
          Math.random() * 70,
        land,
      });
    }
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  }
  clear() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const old = this.flights;
    this.flights = [];
    old.forEach((f) => f.land());
    this.canvas
      .getContext("2d")
      ?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  private draw = (now: number) => {
    const ctx = this.canvas.getContext("2d")!;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const point = (f: Flight, t: number) => ({
      x:
        (1 - t) ** 2 * f.from.x +
        2 * (1 - t) * t * f.control.x +
        t * t * f.to.x,
      y:
        (1 - t) ** 2 * f.from.y +
        2 * (1 - t) * t * f.control.y +
        t * t * f.to.y,
    });
    const pending: Flight[] = [];
    for (const f of this.flights) {
      const t = Math.max(0, Math.min(1, (now - f.start) / f.duration));
      if (now < f.start) {
        pending.push(f);
        continue;
      }
      if (t >= 1) {
        f.land();
        continue;
      }
      pending.push(f);
      for (let j = 7; j >= 0; j--) {
        const p = point(f, Math.max(0, t - j * 0.018));
        ctx.globalAlpha = (1 - j / 8) * 0.7;
        ctx.fillStyle = "#bd975c";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, j ? 2 : 3.2, j ? 2 : 4.6, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.flights = pending;
    this.frame = pending.length ? requestAnimationFrame(this.draw) : 0;
  };
}
