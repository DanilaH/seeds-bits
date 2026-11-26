import {OwnedDomMotion} from "./vendor/mini-games-kit/owned-dom-motion";
const owner = new OwnedDomMotion();
export function clearInterfaceMotion() { owner.cancelAll(); }
/** The semantic page is already installed. Local page fades retain every hit rectangle. */
export function presentMenuChange(node: Element | null, kind: "open"|"back"|"page"|"modal"|"route" = "page") {
  if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const opening=kind==="open",back=kind==="back";
  const animation=owner.animate(node,[
    {opacity:opening?.9:.86,transform:opening?"perspective(900px) rotateY(4deg) scale(.99)":kind==="modal"?"translateY(6px) scale(.985)":kind==="route"||back?`translateY(${back?-3:4}px)`:"none"},
    {opacity:1,transform:"none"},
  ],{duration:opening?200:back?120:kind==="modal"?170:140,easing:"cubic-bezier(.2,.8,.3,1)"});
  if (animation) animation.id=`menu-${kind}`;
}
/** Pointer feedback does not own activation: scrolling/cancellation never clicks a control. */
export function installInterfaceMotion(
  onActivate: (control: HTMLElement) => void,
  blocked: () => boolean,
) {
  let pressed: HTMLButtonElement | null = null,
    origin = { x: 0, y: 0 },
    pointer = -1;
  const clear = () => {
    pressed?.classList.remove("is-pressed");
    pressed = null;
    pointer = -1;
  };
  document.addEventListener(
    "pointerdown",
    (event) => {
      clear();
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button",
      );
      if (
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true" ||
        blocked() ||
        event.button !== 0
      )
        return;
      pressed = button;
      pointer = event.pointerId;
      origin = { x: event.clientX, y: event.clientY };
      button.classList.add("is-pressed");
    },
    { passive: true },
  );
  document.addEventListener(
    "pointermove",
    (event) => {
      if (
        event.pointerId === pointer &&
        Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10
      )
        clear();
    },
    { passive: true },
  );
  document.addEventListener("pointerup", clear, { passive: true });
  document.addEventListener("pointercancel", clear, { passive: true });
  document.addEventListener("scroll", clear, { passive: true, capture: true });
  window.addEventListener("blur", clear);
  window.addEventListener("resize", clear);
  window.addEventListener("pagehide", clear);
  document.addEventListener("visibilitychange", clear);
  document.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button",
      );
      if (
        button &&
        !button.disabled &&
        button.getAttribute("aria-disabled") !== "true" &&
        !blocked() &&
        !button.closest("#board") &&
        !["undo", "hint", "add"].includes(button.id)
      )
        onActivate(button);
    },
    true,
  );
  document.addEventListener("change", (event) => {
    const control = event.target as HTMLElement;
    if (!blocked() && control.matches("select, #reminders, #reminder-time"))
      onActivate(control);
  });
  const dialog = document.getElementById("dialog") as HTMLDialogElement;
  let screen = dialog.dataset.screen,
    wasOpen = dialog.open;
  const observer = new MutationObserver(() => {
    const open = dialog.open,
      next = dialog.dataset.screen;
    if (
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !document.hidden &&
      !blocked()
    ) {
      if (open && wasOpen && next !== screen) {
        const panel = document.getElementById(
          next === "home"
            ? "menu-content"
            : next === "settings"
              ? "settings-panel"
              : next === "confirm"
                ? "confirm-content"
                : "collection",
        );
        clearInterfaceMotion();
        const paper=panel?.querySelector(".quiet-book-page");
        presentMenuChange(paper??panel??null,next==="home"?"back":paper?"open":"route");
      } else if (!open && wasOpen) {
        clearInterfaceMotion();
      }
    }
    screen = next;
    wasOpen = open;
  });
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ["open", "data-screen"],
  });
  for (const sheet of document.querySelectorAll<HTMLDialogElement>("dialog:not(#dialog)")) {
    const watch = new MutationObserver(()=>{
      owner.cancel(sheet);
      if (sheet.open && !blocked()) presentMenuChange(sheet,"modal");
    });
    watch.observe(sheet,{attributes:true,attributeFilter:["open"]});
  }
  for (const event of ["visibilitychange","pagehide","resize"]) window.addEventListener(event,clearInterfaceMotion);
  document.addEventListener("visibilitychange",clearInterfaceMotion);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change",clearInterfaceMotion);
  return clear;
}
