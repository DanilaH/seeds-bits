import { read } from "./platform";
import { checkPair, pairs } from "./core";
import { saveLab } from "./lab-storage";
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
import { requestShuffle } from "./shuffle-lab-client";
import {
  SHUFFLE_KEY,
  freshShuffle,
  readShuffle,
  restartShuffle,
  shuffleIntent,
  applyShuffle,
  undoShuffle,
  canReplayShuffle,
  mockShuffleReceipt,
  storeShuffleEarned,
  grantShuffleEarned,
  shuffleCount,
  shufflePair,
  type ShuffleLab,
  type ShuffleIntent,
} from "./shuffle-lab";
const cells = (board: readonly number[], marked: readonly number[] = []) =>
  board
    .map(
      (n, i) =>
        `<span class="${marked.includes(i) ? "lab-guided" : ""}">${n || ""}</span>`,
    )
    .join("");
export async function openShuffle(
  dialog: HTMLDialogElement,
  onBusy: (busy: boolean) => void,
  feedback: LabFeedback = () => {},
) {
  let p: ShuffleLab,
    stored: string | null = null,
    busy = false,
    note = "",
    selected = -1,
    intent: ShuffleIntent | undefined;
  try {
    stored = await read(SHUFFLE_KEY);
    p = stored ? readShuffle(stored) : freshShuffle();
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
  function lock(value: boolean) {
    busy = value;
    onBusy(value);
    if (value)
      dialog
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((n) => (n.disabled = true));
  }
  async function write(
    q: ShuffleLab,
    kind?: "shuffle" | "undo" | "pair",
    removed: readonly number[] = [],
  ) {
    if (busy) return false;
    const root = dialog.querySelector<HTMLElement>("#shuffle-board"),
      frame = root ? captureHelpFrame(root) : undefined,
      scroll = dialog.scrollTop;
    lock(true);
    let saved = false;
    try {
      const raw = JSON.stringify(q);
      await saveLab(SHUFFLE_KEY, raw, stored);
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
      lock(false);
      render();
      dialog.scrollTop = scroll;
      if (saved && kind && dialog.open && dialog.dataset.labScene === scene) {
        const root = dialog.querySelector<HTMLElement>("#shuffle-board");
        if (root && frame) {
          frame.root = root;
          presentHelpChange(
            frame,
            kind,
            removed,
            kind === "shuffle" ? (p.entitlement?.proof.pair ?? []) : [],
          );
        }
        feedback(kind);
      }
    }
  }
  function render() {
    if (dialog.dataset.labScene !== scene) return;
    const board = p.session.current.board,
      replay = canReplayShuffle(p),
      guided =
        p.entitlement &&
        board.join(",") === p.entitlement.proof.after.join(",") &&
        checkPair(board, ...p.entitlement.proof.pair).ok
          ? p.entitlement.proof.pair
          : [];
    const status =
      note ||
      (!shuffleCount(p)
        ? "Поле очищено!"
        : p.pending
          ? "Награда ждёт восстановления"
          : replay
            ? "Ту же перестановку можно повторить"
            : guided.length
              ? "Соедините отмеченную пару"
              : pairs(board).length
                ? "Убирайте пары"
                : "Пар нет — соберите остатки");
    dialog.innerHTML = `${labHeading("Собрать остатки")}${labTag}<div class="lab-meta"><span>Очистите поле</span><strong id="shuffle-count">Цифр: ${shuffleCount(p)}</strong>${p.credit ? '<span class="lab-stock">1 заряд в запасе</span>' : ""}</div><div id="shuffle-board" class="lab-board">${labCells(board, "data-shuffle-index", guided)}</div><p id="lab-status" role="status">${status}</p><div class="lab-actions"><button id="shuffle-preview" ${(p.entitlement && !replay) || p.pending ? "disabled" : ""}>${replay ? "Повторить" : "Собрать"}</button><button id="lab-undo" ${p.session.history.length ? "" : "disabled"}>Отмена</button><button id="lab-restart">Сначала</button></div>${p.pending ? '<button id="lab-recover" class="secondary">Восстановить награду</button>' : ""}${labHelp("Переставляет те же цифры и убирает пустоты. Результат виден до применения. Одно новое применение на попытку. Отмена возвращает поле; повтор этого результата бесплатный.")}`;
    fitLabActions(dialog);
    dialog.querySelector<HTMLButtonElement>("#lab-close")!.onclick = () =>
      dialog.close();
    for (const cell of dialog.querySelectorAll<HTMLButtonElement>(
      "[data-shuffle-index]",
    ))
      cell.onclick = async () => {
        if (busy) return;
        const i = Number(cell.dataset.shuffleIndex);
        clearHelpEffects();
        if (selected < 0) {
          selected = i;
          cell.classList.add("selected");
          feedback("select");
          return;
        }
        const a = selected;
        selected = -1;
        if (checkPair(board, a, i).ok)
          await write(shufflePair(p, a, i, dialog.scrollTop), "pair", [a, i]);
        else {
          note = "Эта пара не подходит";
          feedback("reject");
          render();
        }
      };
    dialog.querySelector<HTMLButtonElement>("#lab-undo")!.onclick = () =>
      void write(undoShuffle(p), "undo");
    dialog.querySelector<HTMLButtonElement>("#lab-restart")!.onclick = () =>
      void write(restartShuffle(p));
    dialog
      .querySelector<HTMLButtonElement>("#lab-recover")
      ?.addEventListener("click", () => void write(grantShuffleEarned(p)));
    dialog.querySelector<HTMLButtonElement>("#shuffle-preview")!.onclick =
      async () => {
        if (busy) return;
        if (replay) intent = p.entitlement;
        else {
          lock(true);
          const search = requestShuffle(board),
            result = await search.result;
          lock(false);
          if (!dialog.open || dialog.dataset.labScene !== scene) return;
          if (result.status !== "found" || !result.proof) {
            note =
              result.status === "unknown"
                ? "Не успели проверить. Ничего не потрачено."
                : "Подходящей перестановки нет";
            render();
            return;
          }
          intent = shuffleIntent(p, result.proof);
        }
        preview();
      };
  }
  function preview() {
    if (!intent) return;
    const i = intent,
      free = Boolean(p.entitlement),
      price = free
        ? "Повтор бесплатно"
        : p.credit
          ? "Из запаса: 1 заряд"
          : !p.demoUsed
            ? "Первый раз бесплатно"
            : "Видео → 1 перестановка";
    dialog.innerHTML = `${labHeading("Собрать остатки", "shuffle-cancel")}${labTag}<div id="shuffle-comparison"><section><strong>До</strong><div class="lab-board shuffle-grid">${cells(i.proof.before)}</div></section><section><strong>После · те же ${i.proof.after.length} цифр</strong><div class="lab-board shuffle-grid">${cells(i.proof.after, i.proof.pair)}</div></section></div><div class="offer-terms"><strong>${price}</strong><span>Отмена вернёт поле · повтор бесплатно</span></div><div class="lab-confirm-actions"><button id="shuffle-confirm" class="primary">${free ? "Повторить бесплатно" : p.credit || !p.demoUsed ? "Собрать" : "Смотреть видео"}</button><button id="shuffle-dismiss" class="secondary">Не сейчас</button></div>`;
    for (const id of ["shuffle-cancel", "shuffle-dismiss"])
      dialog.querySelector<HTMLButtonElement>("#" + id)!.onclick = () => {
        intent = undefined;
        render();
      };
    dialog.querySelector<HTMLButtonElement>("#shuffle-confirm")!.onclick =
      async () => {
        if (busy) return;
        const scroll = dialog.scrollTop;
        // Keep a real old-board snapshot while the confirmed fixed result is saved.
        const oldFrame = captureHelpFrameFromPreview();
        const apply = async () => {
          try {
            const saved = await write(applyShuffle(p, i, scroll), "shuffle");
            if (saved && oldFrame) {
              const root = dialog.querySelector<HTMLElement>("#shuffle-board");
              if (root) {
                oldFrame.root = root;
                presentHelpChange(oldFrame, "shuffle", [], i.proof.pair);
              }
            }
          } catch {
            note = "Позиция изменилась. Заряд на месте.";
            render();
          }
        };
        if (free || p.credit || !p.demoUsed) {
          await apply();
          return;
        }
        const receipt = mockShuffleReceipt(p, i);
        dialog.innerHTML = `${labHeading("Тестовое видео", "lab-mock-close")}${labTag}<div class="lab-mock-reward">1 перестановка</div><div class="lab-confirm-actions"><button id="lab-earn" class="primary">Получить заряд</button><button id="lab-dismiss" class="secondary">Не сейчас</button></div>`;
        for (const id of ["lab-dismiss", "lab-mock-close"])
          dialog.querySelector<HTMLButtonElement>("#" + id)!.onclick = render;
        dialog.querySelector<HTMLButtonElement>("#lab-earn")!.onclick =
          async () => {
            if (busy) return;
            if (!(await write(storeShuffleEarned(p, receipt)))) return;
            if (!(await write(grantShuffleEarned(p)))) return;
            await apply();
          };
      };
  }
  function captureHelpFrameFromPreview() {
    const before = dialog.querySelector<HTMLElement>(
      "#shuffle-comparison section .lab-board",
    );
    if (!before || !intent) return;
    const frame = {
      root: before,
      values: [...intent.proof.before],
      viewport: { width: innerWidth, height: innerHeight },
      digits: [...before.children].flatMap((n, index) =>
        n.textContent?.trim()
          ? [
              {
                index,
                value: n.textContent.trim(),
                rect: n.getBoundingClientRect(),
              },
            ]
          : [],
      ),
    };
    return frame;
  }
  render();
  dialog.showModal();
  if (p.pending) await write(grantShuffleEarned(p));
}
