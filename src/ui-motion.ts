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
        panel?.getAnimations().forEach((a) => a.cancel());
        panel?.animate(
          [
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 140, easing: "ease-out" },
        );
      } else if (!open && wasOpen) {
        document
          .querySelector(".game")
          ?.animate([{ opacity: 0.78 }, { opacity: 1 }], {
            duration: 100,
            easing: "ease-out",
          });
      }
    }
    screen = next;
    wasOpen = open;
  });
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ["open", "data-screen"],
  });
  return clear;
}
