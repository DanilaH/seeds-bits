// Acceptance-only: a screenshot cannot attest an older native draw revision.
// This fixture is portrait API35 with visible Android status/navigation bars.
const keys=['view','request','measuredRevision','screenLeft','screenTop','width','height',
  'rootX','rootY','rootWidth','rootHeight','rootPaddingTop','rootPaddingBottom',
  'windowX','windowY','windowWidth','windowHeight','windowPaddingTop','windowPaddingBottom',
  'webX','webY','webWidth','webHeight'];
export function portraitBannerPaintMatches(before,after) {
  const ready=p=>p?.phase==='draw'&&p.loaded>0&&p.visible&&
    !p.hostLayoutPending&&!p.rootLayoutPending&&p.left===p.hostLeft&&p.top===p.hostTop&&
    p.windowPaddingTop>0&&p.windowPaddingBottom>0&&
    p.rootY+p.rootHeight===p.windowY+p.windowHeight-p.windowPaddingBottom&&
    p.screenLeft>=p.webX&&p.screenTop>=p.webY&&
    p.screenLeft+p.width<=p.webX+p.webWidth&&p.screenTop+p.height<=p.webY+p.webHeight;
  return Boolean(ready(before)&&ready(after)&&keys.every(k=>before[k]===after[k]));
}
