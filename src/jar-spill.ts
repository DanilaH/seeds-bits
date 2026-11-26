import {OwnedDomMotion} from "./vendor/mini-games-kit/owned-dom-motion";

/** Finite closing accent on the jar that actually received the seeds. No grant. */
export class JarSpill {
  private layer?: HTMLElement;
  private owner = new OwnedDomMotion();
  play(glass: HTMLElement): Promise<void> {
    this.clear();
    if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return Promise.resolve();
    const box = glass.getBoundingClientRect();
    if (!box.width || !box.height) return Promise.resolve();
    const layer = document.createElement("div");
    layer.id = "jar-spill";
    layer.dataset.target = glass.id;
    layer.setAttribute("aria-hidden", "true");
    this.layer = layer;
    document.body.append(layer);
    const animations: Animation[] = [];
    const animate = (node: Element | null, frames: Keyframe[], duration: number) => {
      const a = this.owner.animate(node, frames, {duration, easing:"ease-out"});
      if (a) animations.push(a);
    };
    animate(glass, [{transform:"scale(1)"},{transform:"scale(1.07,.96)",offset:.35},{transform:"scale(1)"}],520);
    animate(glass.querySelector(".jar-lid"),[
      {transform:"translateY(-5px) rotate(-6deg)"},
      {transform:"translateY(1px) rotate(1deg)",offset:.55},
      {transform:"none"},
    ],380);
    const color = getComputedStyle(glass).getPropertyValue("--jar-color") || "#b58b51";
    for (let i=0;i<12;i++) {
      const grain = document.createElement("i");
      grain.className = "jar-spill-grain";
      grain.style.setProperty("--grain-size",`${4+i%3}px`);
      grain.style.background = color;
      layer.append(grain);
      const x=box.x+box.width/2,y=box.y+box.height*.25,a=i*Math.PI*2/12;
      animate(grain,[
        {transform:`translate(${x}px,${y}px) scale(.4)`,opacity:0},
        {opacity:.9,offset:.2},
        {transform:`translate(${x+Math.cos(a)*52}px,${y+Math.sin(a)*40+12}px) rotate(${i*39}deg)`,opacity:0},
      ],480+i%3*30);
    }
    return Promise.allSettled(animations.map(a=>a.finished)).then(()=>{
      layer.remove();
      if (this.layer===layer) this.layer=undefined;
    });
  }
  clear() {
    this.owner.cancelAll();
    this.layer?.remove();
    this.layer=undefined;
  }
}
