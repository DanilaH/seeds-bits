// Read-only browser probe: retain computed surfaces and the active author rules.
// A legacy filename alone is not a defect; role and visible output are reviewed.
export function inspectQuietStyle() {
  const selectors = [
    '.game', '.game-actions footer', '#ad-space', '#dialog', '#collection', '.collection-tabs', '.book-sections', '.book-ranges',
    '.quiet-book-page', '.calendar-layout', '.progress-hero', '.progress-stats', '.month-hero', '.past-months',
    '.settings-basics', '.settings-rows', '.settings-reserve', '#reminder-settings', '#confirm-content',
    '#language-sheet', '#language-options', '#classic-new-sheet', '#classic-new-close', '#hint-offer', '.hint-copy',
    '.classic-difficulty-option', '.classic-level-current', '.medal-receipt', '.next-medal', '#read-notice', '#save-notice',
    '#lesson-text', '#no-moves-card', '#win', '#result-actions',
  ];
  const properties = ['color', 'background-color', 'background-image', 'border-top-color', 'border-top-width',
    'border-right-width', 'border-bottom-width', 'border-radius', 'box-shadow', 'outline-color', 'height',
    'min-height', 'max-height', 'position', 'top', 'bottom', 'padding-top', 'padding-bottom', 'overflow-y'];
  const rules = [];
  function visit(list, source) {
    for (const rule of list) {
      if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue;
      if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) continue;
      if (rule instanceof CSSStyleRule) rules.push({selector: rule.selectorText, style: rule.style, source});
      else if (rule.cssRules) visit(rule.cssRules, source);
    }
  }
  for (const sheet of document.styleSheets) {
    try { visit(sheet.cssRules, (sheet.ownerNode?.dataset?.viteDevId || sheet.href || 'inline').replace(/^.*\/src\//, 'src/')); } catch {}
  }
  const visible = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
  const entries = [];
  for (const selector of selectors) for (const e of document.querySelectorAll(selector)) {
    if (!visible(e)) continue;
    const style = getComputedStyle(e), r = e.getBoundingClientRect();
    const matches = [];
    for (const rule of rules) {
      try { if (!e.matches(rule.selector)) continue; } catch { continue; }
      const declarations = Object.fromEntries(['color','background','background-color','background-image','border','border-color','border-width','border-radius','box-shadow','height','min-height','max-height','inset','top','bottom'].map(p => [p, rule.style.getPropertyValue(p)]).filter(([,v]) => v));
      if (Object.keys(declarations).length) matches.push({source: rule.source, selector: rule.selector, declarations});
    }
    entries.push({selector, id: e.id, class: e.className, text: e.textContent.trim().slice(0, 90),
      rect: {x:r.x,y:r.y,width:r.width,height:r.height}, computed: Object.fromEntries(properties.map(p => [p, style.getPropertyValue(p)])),
      backdrop: e.matches('dialog[open]') ? getComputedStyle(e,'::backdrop').backgroundColor : null, matches});
  }
  return entries;
}
