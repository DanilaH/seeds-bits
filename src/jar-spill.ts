import {OwnedDomMotion} from "./vendor/mini-games-kit/owned-dom-motion";

/** One owned, finite spill on the visible, durably earned jar. No grant. */
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
    const large = box.height >= 60;
    const bounce = large ? 8 : 5;
    animate(glass, [
      {transform:"none"},
      {transform:"scale(1.13,.87) translateY(2px)",offset:.14},
      {transform:`translateY(-${bounce}px) scale(.93,1.1) rotate(-6deg)`,offset:.34},
      {transform:"scale(1.06,.96) rotate(4deg)",offset:.58},
      {transform:"rotate(-2deg)",offset:.78},
      {transform:"none"},
    ],680);
    animate(glass.querySelector(".jar-lid"),[
      {transform:"none"},
      {transform:`translateY(-${large ? 13 : 8}px) rotate(-13deg)`,offset:.3},
      {transform:"translateY(-3px) rotate(7deg)",offset:.65},
      {transform:"none"},
    ],660);
    const color = getComputedStyle(glass).getPropertyValue("--jar-color") || "#b58b51";
    layer.style.setProperty("--spill-color",color);
    // All trajectories stop above the native banner, outside the playable web
    // area if there is no banner. Nothing touches SDK geometry or input.
    const banner = document.querySelector("#ad-space")?.getBoundingClientRect();
    const floor = banner && banner.height > 0 ? banner.top - 4 : innerHeight + 14;
    const originX=box.x+box.width/2, originY=Math.max(9,box.y+box.height*.06);
    for (let i=0;i<24;i++) {
      const grain = document.createElement("i");
      grain.className = "jar-spill-grain";
      grain.dataset.shape=i%6===0?"glint":"seed";
      grain.style.setProperty("--grain-size",`${(large?5:4)+i%3}px`);
      layer.append(grain);
      const side=i%2?1:-1, x=originX+side*box.width*.15;
      const lift=(large?130:105)+Math.random()*65, gravity=1100+Math.random()*260;
      const seconds=(lift+Math.sqrt(lift*lift+2*gravity*Math.max(20,floor-originY)))/gravity;
      const room=Math.max(0,side<0?x-8:innerWidth-x-8);
      const spread=Math.min(room,innerWidth*.55)*(.4+Math.random()*.55);
      const spin=side*(210+Math.random()*370);
      const frames=Array.from({length:33},(_,step)=>{
        const t=step/32, elapsed=seconds*t;
        return {transform:`translate3d(${x+side*spread*t**1.45}px,${originY-lift*elapsed+gravity*elapsed**2/2}px,0) rotate(${i*17+spin*t}deg)`,
          opacity:Math.min(.98,t*24,(1-t)*9),offset:t};
      });
      const a=this.owner.animate(grain,frames,{duration:seconds*1000,delay:70+i%3*45+Math.floor(i/3)*5,easing:"linear",fill:"both"});
      if(a)animations.push(a);
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
