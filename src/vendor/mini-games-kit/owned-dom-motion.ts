export interface OwnedDomMotionPolicy {
  /** Host policy: false cancels overlapping old effects without playing a new one. */
  enabled?: boolean;
  /** Fresh effects keep their authored start by default; replacements sample the visible state. */
  fromCurrent?: 'replace' | 'always';
  /** Presentation only. Cancelled/replaced effects never call this handler. */
  onFinish?: () => void;
}

interface OwnedEffect {
  target: Element;
  properties: ReadonlySet<string>;
  release: () => void;
}

const metadata = new Set(['offset', 'computedOffset', 'easing', 'composite']);
const cssName = (name: string): string => name.startsWith('--') ? name
  : name === 'cssFloat' ? 'float' : name === 'cssOffset' ? 'offset'
    : (/^(webkit|moz|ms|o)[A-Z]/.test(name) ? '-' : '')
      + name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const animationName = (name: string): string => name.startsWith('--') ? name
  : name === 'float' ? 'cssFloat' : name === 'offset' ? 'cssOffset'
    : name.replace(/^-(webkit|moz|ms|o)-/, '$1-')
      .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** Own a finite set of DOM/WAAPI effects. No global listeners, preferences or game state. */
export class OwnedDomMotion {
  private readonly active = new Map<Animation, OwnedEffect>();
  private readonly propertySchemas = new WeakMap<Document, {
    style: CSSStyleDeclaration;
    names: Map<string, readonly string[]>;
  }>();

  private properties(effect: KeyframeEffect, document: Document): Set<string> {
    let schema = this.propertySchemas.get(document);
    if (!schema) {
      schema = {style: document.createElementNS('http://www.w3.org/1999/xhtml', 'span').style, names: new Map()};
      this.propertySchemas.set(document, schema);
    }
    const result = new Set<string>();
    for (const frame of effect.getKeyframes()) {
      for (const name of Object.keys(frame)) {
        if (metadata.has(name)) continue;
        let expanded = schema.names.get(name);
        if (!expanded) {
          schema.style.cssText = '';
          // A var()-backed shorthand can survive getKeyframes() unexpanded.
          // Expand its property names with a neutral CSS-wide value instead;
          // authored values remain in the real effect, never in this probe.
          schema.style.setProperty(cssName(name), 'initial');
          expanded = name.startsWith('--') ? [name] : Array.from(schema.style, animationName);
          schema.names.set(name, expanded);
        }
        for (const property of expanded) result.add(property);
      }
    }
    return result;
  }

  public animate(
    target: Element | null,
    frames: readonly Keyframe[],
    timing: number | KeyframeEffectOptions,
    policy: OwnedDomMotionPolicy = {},
  ): Animation | null {
    if (!target) return null;
    if (frames.length < 2) throw new TypeError('OwnedDomMotion needs at least two explicit keyframes');
    if (typeof timing !== 'number' && (timing.fill === 'forwards' || timing.fill === 'both')) {
      throw new TypeError('OwnedDomMotion needs non-persisting fill; set final state in CSS');
    }
    if (!target.isConnected) {
      this.cancel(target);
      return null;
    }
    const view = target.ownerDocument.defaultView;
    if (!view) return null;
    // Let the browser normalize aliases/shorthands before deciding ownership.
    // An invalid replacement must not cancel the current effect.
    const effect = new view.KeyframeEffect(target, frames.map(frame => ({...frame})), timing);
    if (effect.composite !== 'replace' || effect.getKeyframes().some(frame =>
      frame.composite !== 'auto' && frame.composite !== 'replace',
    ) || (effect as KeyframeEffect & {iterationComposite?: string}).iterationComposite === 'accumulate') {
      throw new TypeError('OwnedDomMotion supports replace compositing only');
    }
    const properties = this.properties(effect, target.ownerDocument);
    if (!properties.size) return null;
    const previous: Array<[Animation, OwnedEffect]> = [];
    for (const [animation, owner] of this.active) {
      if (animation.playState === 'idle') {
        owner.release();
      } else if (owner.target === target && [...properties].some(p => owner.properties.has(p))) {
        // Include finished effects whose finish event is still queued. Only an
        // overlapping replacement suppresses their completion, not unrelated work.
        previous.push([animation, owner]);
      }
    }
    if (policy.enabled !== false && (previous.length || policy.fromCurrent === 'always')) {
      // Read once, while the old effect still owns its visible value.
      const visible = view.getComputedStyle(target);
      const start: Keyframe = {};
      for (const property of properties) start[property] = visible.getPropertyValue(cssName(property));
      const first = frames[0]!;
      const firstMetadata = Object.fromEntries(Object.entries(first)
        .filter(([key]) => key === 'offset' || key === 'easing' || key === 'composite'));
      effect.setKeyframes(first.offset != null && first.offset > 0
        ? [{...start, offset: 0}, ...frames.map(frame => ({...frame}))]
        : [{...firstMetadata, ...start}, ...frames.slice(1).map(frame => ({...frame}))]);
    }
    for (const [animation, owner] of previous) {
      owner.release();
      animation.cancel();
    }
    if (policy.enabled === false) return null;
    const animation = new view.Animation(effect, target.ownerDocument.timeline);
    const release = () => {
      this.active.delete(animation);
      animation.removeEventListener('finish', finish);
      animation.removeEventListener('cancel', release);
    };
    const finish = () => {
      if (!this.active.has(animation)) return;
      release(); // Release before a finish handler starts the next effect.
      if (target.isConnected) policy.onFinish?.();
    };
    this.active.set(animation, {target, properties, release});
    animation.addEventListener('finish', finish);
    animation.addEventListener('cancel', release);
    try {
      animation.play();
    } catch (error) {
      release();
      animation.cancel();
      throw error;
    }
    return animation;
  }

  /** Explicit object removal/remapping; independent targets keep their effects. */
  public cancel(target: Element): void {
    for (const [animation, owner] of this.active) {
      if (owner.target !== target) continue;
      owner.release();
      animation.cancel();
    }
  }

  /** Call on navigation, background, reduced-motion change or scope teardown. Reusable afterwards. */
  public cancelAll(): void {
    for (const [animation, owner] of this.active) {
      owner.release();
      animation.cancel();
    }
  }
}
