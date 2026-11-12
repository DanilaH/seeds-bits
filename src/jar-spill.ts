/** One saved jar milestone: transform-only grains, no reward state or frame loop. */
export class JarSpill {
  private layer: HTMLElement | undefined;
  private animations: Animation[] = [];

  constructor() {
    window.addEventListener("resize", () => this.clear());
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.(
      "change",
      () => this.clear(),
    );
  }

  play(glass: HTMLElement) {
    this.clear();
    if (
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const box = glass.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight)
      return;
    const layer = document.createElement("div");
    layer.id = "jar-spill";
    layer.setAttribute("aria-hidden", "true");
    layer.style.setProperty(
      "--spill-color",
      getComputedStyle(glass).getPropertyValue("--jar-color").trim() ||
        "#b58b51",
    );
    this.layer = layer;
    document.body.append(layer);
    this.animations.push(
      glass.animate(
        [
          { transform: "rotate(0) translateY(0)" },
          { transform: "rotate(-8deg) translateY(-2px)", offset: 0.14 },
          { transform: "rotate(7deg) translateY(-1px)", offset: 0.32 },
          { transform: "rotate(-5deg) translateY(0)", offset: 0.5 },
          { transform: "rotate(3deg)", offset: 0.68 },
          { transform: "rotate(-1deg)", offset: 0.84 },
          { transform: "rotate(0) translateY(0)" },
        ],
        { duration: 620, easing: "ease-in-out" },
      ),
    );
    const lid = glass.querySelector(".jar-lid");
    if (lid)
      this.animations.push(
        lid.animate(
          [
            { transform: "translateY(0) rotate(0)" },
            { transform: "translateY(-5px) rotate(-7deg)", offset: 0.18 },
            { transform: "translateY(-4px) rotate(5deg)", offset: 0.55 },
            { transform: "translateY(0) rotate(0)" },
          ],
          { duration: 590, easing: "ease-in-out" },
        ),
      );

    const originX = box.left + box.width / 2;
    const originY = Math.max(8, box.top - 2);
    let remaining = 24;
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement("i");
      piece.className = "jar-spill-grain";
      piece.dataset.shape = i % 4 === 0 ? "glint" : "seed";
      piece.style.setProperty("--grain-size", `${4 + (i % 3)}px`);
      layer.append(piece);

      const side = i % 2 ? 1 : -1;
      const x = originX + side * box.width * 0.18;
      const y = originY + (i % 3);
      const lift = 95 + Math.random() * 75;
      const gravity = 1050 + Math.random() * 350;
      const distance = innerHeight + 14 - y;
      const seconds =
        (lift + Math.sqrt(lift * lift + 2 * gravity * distance)) / gravity;
      const room = Math.max(0, side < 0 ? x - 8 : innerWidth - x - 8);
      const spread =
        Math.min(room, innerWidth * 0.62) * (0.35 + Math.random() * 0.6);
      const spin = side * (180 + Math.random() * 390);
      const tilt = Math.random() * 90;
      const frames = Array.from({ length: 33 }, (_, step) => {
        const t = step / 32;
        const elapsed = seconds * t;
        // Start as a narrow spill, then fan out below the header caption.
        const px = x + side * spread * t ** 1.8;
        const py = y - lift * elapsed + (gravity * elapsed * elapsed) / 2;
        return {
          transform: `translate3d(${px}px,${py}px,0) rotate(${tilt + spin * t}deg) scaleX(${0.75 + Math.abs(Math.cos(t * Math.PI * 2 + i)) * 0.25})`,
          opacity: Math.min(0.95, t * 22, (1 - t) * 7),
          offset: t,
        };
      });
      const animation = piece.animate(frames, {
        duration: seconds * 1000,
        delay: 75 + (i % 3) * 90 + Math.floor(i / 3) * 6,
        easing: "linear",
        fill: "both",
      });
      this.animations.push(animation);
      animation.onfinish = () => {
        piece.remove();
        if (--remaining === 0 && this.layer === layer) this.clear();
      };
    }
  }

  clear() {
    for (const animation of this.animations) {
      animation.onfinish = null;
      animation.cancel();
    }
    this.animations = [];
    this.layer?.remove();
    this.layer = undefined;
  }
}
