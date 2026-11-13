import { read } from "./platform";
import { saveLab } from "./lab-storage";
import { checkPair, occupied, pairs } from "./core";
import {
  captureHelpFrame,
  presentHelpChange,
  clearHelpEffects,
} from "./help-presentation";
import {
  fitLabActions,
  labHeading,
  labTag,
  labCells,
  labHelp,
  type LabFeedback,
} from "./help-lab-views";
import {
  TRIAL_KEY,
  trialTasks,
  freshTrials,
  startTrial,
  trialPair,
  trialAdd,
  trialUndo,
  trialStopped,
  trialBonusProof,
  mockTrialReceipt,
  storeTrialEarned,
  grantTrialEarned,
  applyTrialBonus,
  readTrials,
  type Trials,
} from "./trials-lab";
import "./help-lab.css";
const dialog = document.createElement("dialog");
dialog.id = "help-lab";
dialog.className = "help-lab";
document.body.append(dialog);
let busy = false;
export function closeHelpLab() {
  if (!dialog.open) return false;
  if (!busy) dialog.close();
  return true;
}
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeHelpLab();
});
dialog.addEventListener("close", () => clearHelpEffects());
export function installHelpLab(
  profile: string,
  parent: HTMLElement,
  feedback: LabFeedback = () => {},
) {
  const labs =
    profile === "all"
      ? ["trials", "shuffle"]
      : [profile].filter((p) => p === "trials" || p === "shuffle");
  for (const lab of labs) {
    const entry = document.createElement("button");
    entry.id = profile === "all" ? `qa-${lab}-lab` : "qa-lab";
    entry.className = "secondary";
    entry.textContent =
      lab === "trials" ? "QA: Испытания" : "QA: Собрать остатки";
    parent.append(entry);
    entry.onclick = () => {
      if (lab === "trials") void openTrials(feedback);
      else
        void import("./shuffle-lab-ui").then((m) =>
          m.openShuffle(
            dialog,
            (value) => {
              busy = value;
            },
            feedback,
          ),
        );
    };
  }
}
async function openTrials(feedback: LabFeedback) {
  let p: Trials,
    stored: string | null = null,
    selected = -1,
    note = "";
  try {
    stored = await read(TRIAL_KEY);
    p = stored ? readTrials(stored) : freshTrials();
  } catch {
    dialog.innerHTML =
      labHeading("Сохранение защищено") +
      "<p>Эта версия не прочитана. Данные на месте.</p>";
    fitLabActions(dialog);
    dialog.querySelector<HTMLButtonElement>("#lab-close")!.onclick = () =>
      dialog.close();
    dialog.showModal();
    return;
  }
  const scene = crypto.randomUUID();
  dialog.dataset.labScene = scene;
  async function write(
    q: Trials,
    kind?: "pair" | "add" | "undo",
    removed: readonly number[] = [],
    nextPair: readonly number[] = [],
  ) {
    if (busy) return false;
    const root = dialog.querySelector<HTMLElement>("#lab-board"),
      frame = root ? captureHelpFrame(root) : undefined;
    const scroll = dialog.scrollTop;
    busy = true;
    dialog
      .querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button,select")
      .forEach((n) => (n.disabled = true));
    let saved = false;
    try {
      const raw = JSON.stringify(q);
      await saveLab(TRIAL_KEY, raw, stored);
      stored = raw;
      p = q;
      selected = -1;
      note = "";
      saved = true;
      return true;
    } catch {
      note = "Не сохранено. Попробуйте ещё раз.";
      return false;
    } finally {
      busy = false;
      render();
      dialog.scrollTop = scroll;
      if (
        saved &&
        kind &&
        frame &&
        dialog.open &&
        dialog.dataset.labScene === scene
      ) {
        const root = dialog.querySelector<HTMLElement>("#lab-board");
        if (root) {
          frame.root = root;
          presentHelpChange(frame, kind, removed, nextPair);
        }
        feedback(kind);
      }
    }
  }
  async function recover() {
    if (p.pending) await write(grantTrialEarned(p));
  }
  function render() {
    if (dialog.dataset.labScene !== scene) return;
    const board = p.session.current.board,
      win = !occupied(board),
      available = pairs(board),
      proof = trialBonusProof(p),
      replay = Boolean(
        p.entitlement &&
        board.join(",") === p.entitlement.before.join(",") &&
        p.session.current.additions === 2,
      );
    const canAdd =
      !win && !available.length && (p.session.current.additions < 2 || replay);
    const status =
      note ||
      (p.pending
        ? "Награда ждёт восстановления"
        : win
          ? "Поле очищено!"
          : trialStopped(p)
            ? replay
              ? "Добавление можно повторить"
              : "Нет пар и добавлений"
            : available.length
              ? "Убирайте пары"
              : "Пар нет — добавьте цифры");
    dialog.innerHTML = `${labHeading("Испытания")}${labTag}<div class="lab-task-row"><label for="lab-task">Задание</label><select id="lab-task">${trialTasks.map((t) => `<option value="${t.id}" ${t.id === p.task ? "selected" : ""}>${t.name}</option>`).join("")}</select></div><div class="lab-meta"><span>Очистите поле</span><strong id="lab-budget">Добавлений: ${Math.max(0, 2 - p.session.current.additions)}${replay ? " +1 повтор" : ""}</strong>${p.bonus ? '<span class="lab-stock">+1 в запасе</span>' : ""}</div><div id="lab-board" class="lab-board">${labCells(board, "data-lab-index")}</div><p id="lab-status" role="status" class="${win ? "lab-success" : ""}">${status}</p><div class="lab-actions"><button id="lab-undo" ${p.session.history.length ? "" : "disabled"}>Отмена</button><button id="lab-add" class="${canAdd ? "lab-next" : ""}" ${canAdd ? "" : "disabled"}>Добавить${replay ? "<small>повтор бесплатно</small>" : ""}</button><button id="lab-restart">Сначала</button></div>${proof && !p.pending && (!p.rewardClaimed || p.bonus) ? `<button id="lab-bonus" class="primary">${p.bonus ? "Добавить · из запаса" : "Видео · +1 добавление"}</button>` : ""}${p.pending ? '<button id="lab-recover" class="secondary">Восстановить награду</button>' : ""}${labHelp("Есть два добавления. Когда пар нет, кнопка «Добавить» подсветится. За видео — одно дополнительное добавление на попытку. Отмена вернёт поле, повтор того же добавления бесплатный.")}`;
    fitLabActions(dialog);
    dialog.querySelector<HTMLButtonElement>("#lab-close")!.onclick = () =>
      closeHelpLab();
    dialog.querySelector<HTMLSelectElement>("#lab-task")!.onchange = (e) =>
      void write(startTrial(p, (e.target as HTMLSelectElement).value));
    dialog.querySelector<HTMLButtonElement>("#lab-restart")!.onclick = () =>
      void write(startTrial(p, p.task));
    dialog.querySelector<HTMLButtonElement>("#lab-undo")!.onclick = () =>
      void write(trialUndo(p), "undo");
    dialog.querySelector<HTMLButtonElement>("#lab-add")!.onclick = () => {
      try {
        void write(trialAdd(p, dialog.scrollTop), "add");
      } catch {
        note = "Сейчас добавить нельзя";
        render();
      }
    };
    dialog
      .querySelector<HTMLButtonElement>("#lab-recover")
      ?.addEventListener("click", () => void recover());
    for (const button of dialog.querySelectorAll<HTMLButtonElement>(
      "[data-lab-index]",
    ))
      button.onclick = async () => {
        if (busy) return;
        const i = Number(button.dataset.labIndex);
        clearHelpEffects();
        if (selected < 0) {
          selected = i;
          button.classList.add("selected");
          feedback("select");
          return;
        }
        const a = selected;
        selected = -1;
        if (checkPair(board, a, i).ok)
          await write(trialPair(p, a, i, dialog.scrollTop), "pair", [a, i]);
        else {
          note = "Эта пара не подходит";
          feedback("reject");
          render();
        }
      };
    dialog
      .querySelector<HTMLButtonElement>("#lab-bonus")
      ?.addEventListener("click", async () => {
        if (busy || !proof) return;
        if (p.bonus) {
          await write(
            applyTrialBonus(p, dialog.scrollTop),
            "add",
            [],
            proof.pair,
          );
          return;
        }
        const receipt = mockTrialReceipt(p);
        dialog.innerHTML = `${labHeading("Тестовое видео", "lab-mock-close")}${labTag}<div class="lab-mock-reward">+1 добавление</div><div class="lab-confirm-actions"><button id="lab-earn" class="primary">Получить +1</button><button id="lab-dismiss" class="secondary">Не сейчас</button></div>`;
        for (const id of ["lab-dismiss", "lab-mock-close"])
          dialog.querySelector<HTMLButtonElement>("#" + id)!.onclick = () =>
            render();
        dialog.querySelector<HTMLButtonElement>("#lab-earn")!.onclick =
          async () => {
            if (busy) return;
            if (!(await write(storeTrialEarned(p, receipt)))) return;
            if (!(await write(grantTrialEarned(p)))) return;
            if (
              p.attempt === receipt.attempt &&
              p.session.current.board.join(",") ===
                receipt.proof.before.join(",")
            )
              await write(
                applyTrialBonus(p, dialog.scrollTop),
                "add",
                [],
                receipt.proof.pair,
              );
          };
      });
  }
  render();
  dialog.showModal();
  await recover();
}
