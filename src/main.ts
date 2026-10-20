import { jars, collectPair, jarState, jarNames, jarColors } from "./jars";
import { volumeOf, volumeTasks, chapterNames } from "./notebooks";
import { playSound, suspendSound } from "./sound";
import { SeedFlight } from "./seed-flight";
import { BoardView } from "./board-view";
import { requestAdvice } from "./advice-client";
import { emblem } from "./trophies";
import "./style.css";
import {
  WIDTH,
  MAX_CELLS,
  classic,
  occupied,
  pairs,
  checkPair,
  removePair,
  addNumbers,
  newSession,
  commit,
  undo,
  decode,
  type Session,
  type Connection,
} from "./core";
import {
  notebook,
  loadNotebook,
  nextTask,
  daily,
  today,
  days,
  trophy,
  FIRST_MONTH,
  puzzleSession,
  availableDay,
  type Puzzle,
} from "./puzzles";
import {
  fresh,
  readProgress,
  FutureProgress,
  metadata,
  startAttempt,
  recordCompletion,
  type Progress,
} from "./progress";
import * as platform from "./platform";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const KEY = "seeds-bits.session.v1",
  SETTINGS = "seeds-bits.settings.v1";
const PROGRESS = "seeds-bits.progress.v2";
let progress: Progress = fresh(),
  shortLesson = false,
  calendarMonth = today().slice(0, 7);
let session: Session = newSession(),
  selected = -1,
  highlight: Connection | null = null,
  busy = false,
  paused = false,
  saveFailed = false,
  saveRecovered = false;
let settings = {
  theme: "light",
  sound: false,
  vibration: false,
  tutorialDone: false,
};
let lastStored: string | null = null,
  storageConflict = false,
  futureSave = false,
  switching = false,
  recoveryAvailable = false;
let hintGeneration = 0;
let hintPending = false;
let readWarning = "";
const settingsDirty: Record<string, unknown> = {};
let saveQueue = Promise.resolve(),
  hintIndex = 0,
  lesson = -1,
  lessonBoard: number[] = [],
  lessonPhase = 0;
let jarShelfPage = 0;
let selectedVolume = 0,
  bookFilter = "all",
  trophyYear = today().slice(0, 4);
let visualSeeds: number | undefined;
let completedJar: { index: number; until: number } | undefined;
const flights = new SeedFlight();
const lessons = [
  {
    title: "Одинаковые цифры",
    text: "Нажмите на две четвёрки. Одинаковые цифры составляют пару.",
    cells: [4, 4],
    pair: [0, 1],
  },
  {
    title: "В сумме — десять",
    text: "Теперь соедините 3 и 7. Они тоже составляют пару.",
    cells: [3, 7],
    pair: [0, 1],
  },
  {
    title: "Через пустые клетки",
    text: "Пустые клетки не мешают. Соедините две двойки.",
    cells: [2, 0, 0, 2],
    pair: [0, 3],
  },
  {
    title: "По диагонали",
    text: "Соедините 8 и 2 по диагонали через пустую клетку.",
    cells: [8, ...Array(19).fill(0), 2],
    pair: [0, 20],
  },
  {
    title: "Из строки в строку",
    text: "Конец строки продолжается в начале следующей. Соедините 6 и 4.",
    cells: [...Array(8).fill(0), 6, 4],
    pair: [8, 9],
  },
  {
    title: "Добавить и отменить",
    text: "Пар нет. Нажмите «Добавить», затем «Отмена»: поле вернётся к прежнему виду.",
    cells: [1, 2],
    pair: [],
  },
];
const icons = {
  undo: '<path d="M8 5 3 10l5 5M3 10h10a7 7 0 1 1-6 11"/>',
  hint: '<path d="M9 20h6m-5 4h4M8 16a8 8 0 1 1 8 0c-1 1-1 3-1 4H9c0-1 0-3-1-4Z"/>',
  add: '<path d="M14 3v22M3 14h22"/>',
};
const icon = (name: keyof typeof icons) =>
  `<svg viewBox="0 0 28 28" aria-hidden="true">${icons[name]}</svg>`;
$("app").innerHTML =
  `<main class="game"><header><button id="menu" class="plain" aria-label="Открыть меню"><span class="menu-lines"></span></button><div class="brand">семечки</div><button id="book-top" class="plain" aria-label="Открыть тетрадь">▦</button></header><button id="jar-meter" class="jar-meter" hidden aria-label="Коллекция баночек"><span id="jar-glass" class="jar-glass"><span class="jar-fill"></span><span class="jar-lid"></span></span><span class="jar-caption"><strong id="jar-name"></strong><span id="jar-percent"></span></span></button><section class="game-meta"><span id="mode">Классическая партия</span><span><strong id="remaining">28</strong> <span id="noun">цифр</span></span></section><div id="page-progress" hidden></div><section id="lesson" hidden><div class="lesson-top"><span id="lesson-step"></span><button id="skip" class="text-button">Пропустить</button></div><h1 id="lesson-title"></h1><p id="lesson-text"></p><button id="lesson-next" class="primary" hidden>Дальше</button></section><div id="viewport" tabindex="0" aria-label="Игровое поле с вертикальной прокруткой"><div id="board-wrap"><div id="board" role="group" aria-label="Цифры игрового поля"></div><svg id="paths" aria-hidden="true"></svg></div><div id="win" hidden><span class="win-symbol">✓</span><h1>Все пары найдены</h1><details class="result-details"><summary>Итоги партии</summary><p id="win-stats"></p></details><div id="award" hidden></div><p id="completion-status"></p><button id="play-again" class="primary">Ещё партия</button></div></div><div class="status-wrap"><button id="hint-jump" class="text-button" hidden></button><p id="status" role="status" aria-live="polite"></p><button id="recover-task" class="text-button" hidden></button><button id="restart-task" class="text-button" hidden>Начать задачу заново</button><button id="retry-save" class="text-button" hidden>Повторить сохранение</button></div><footer><button id="undo" class="action">${icon("undo")}<span>Отмена</span></button><button id="hint" class="action">${icon("hint")}<span>Подсказка</span></button><button id="add" class="action">${icon("add")}<span id="add-label">Добавить</span></button></footer></main><dialog id="dialog" aria-label="Меню Семечек"><div class="dialog-head"><h2>Семечки</h2><button id="close" class="plain" aria-label="Закрыть меню">×</button></div><div id="menu-content"><div class="home-title"><svg class="seed-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="M29 40C8 40 8 20 24 5c12 16 16 30 5 35Z"/><path d="M35 39c-3-15 5-25 24-26-1 20-9 30-24 26Z"/><path class="seed-line" d="m24 15 4 20m24-15-12 14"/></svg><h1>семечки</h1></div><button id="resume" class="primary">Продолжить игру</button><p id="resume-context"></p><nav class="mode-nav"><button id="classic-mode" class="mode-link"><span>Классика<small>Очистите поле от цифр</small></span><span aria-hidden="true">↗</span></button><button id="book-mode" class="mode-link"><span>Тетрадь<small><span id="book-count">24 небольшие задачи</span></small></span><span aria-hidden="true">↗</span></button><button id="daily-mode" class="mode-link"><span>Задача дня<small><span id="daily-state">Начать</span></small></span><span aria-hidden="true">↗</span></button></nav><button id="calendar-open" class="secondary">▦ Календарь</button><div class="home-links"><button id="progress-open" class="text-button">Мой прогресс</button><button id="trophies-mode" class="text-button">Коллекция</button><button id="learn" class="text-button">Как играть</button><button id="settings-open" class="text-button">Настройки</button></div></div><section id="settings-panel" hidden><button id="settings-back" class="text-button">← Меню</button><h2>Настройки</h2><div class="settings"><label>Тёмная тема<input id="dark" type="checkbox"></label><label>Звук<input id="sound" type="checkbox"></label><label>Вибрация<input id="vibration" type="checkbox"></label></div><button id="new" class="secondary">Начать текущую партию заново</button><p class="intro">Прогресс сохраняется автоматически.</p></section><div id="confirm-content" hidden><p>Начать новую партию? Текущее поле и история отмены будут заменены.</p><button id="confirm-new" class="primary">Начать заново</button><button id="cancel-new" class="secondary">Оставить текущую</button></div><section id="collection" hidden></section></dialog>`;
document.querySelector("header")!.insertBefore($("jar-meter"), $("book-top"));
const boardView = new BoardView($("board"));
const dialog = $<HTMLDialogElement>("dialog"),
  viewport = $("viewport");
$("app").inert = true;
function board() {
  return lesson >= 0 ? lessonBoard : session.current.board;
}
let pairBoard: readonly number[] | undefined;
let pairCache: Connection[] = [];
function availablePairs(values: readonly number[]) {
  if (pairBoard !== values) {
    pairBoard = values;
    pairCache = pairs(values);
  }
  return pairCache;
}
function message(text: string) {
  $("status").textContent = text;
}
const notice = document.createElement("aside");
notice.id = "save-notice";
notice.setAttribute("role", "status");
notice.hidden = true;
notice.innerHTML =
  '<p id="save-warning"></p><button id="load-latest" class="text-button" hidden>Загрузить сохранённую партию</button>';
notice.append($("retry-save"));
const readNotice = document.createElement("aside");
readNotice.id = "read-notice";
readNotice.setAttribute("role", "alert");
readNotice.hidden = true;
const readText = document.createElement("p"),
  dismissRead = document.createElement("button");
dismissRead.className = "text-button";
dismissRead.textContent = "Понятно";
dismissRead.onclick = () => {
  readWarning = "";
  showSaveState();
};
const restoreRead = document.createElement("button");
restoreRead.id = "restore-backup";
restoreRead.className = "text-button";
restoreRead.textContent = "Восстановить резервную копию";
restoreRead.onclick = async () => {
  if (busy || futureSave) return;
  busy = true;
  restoreRead.disabled = true;
  try {
    const raw = await platform.read(PROGRESS + ".recovery");
    if (!raw) throw Error("Missing backup");
    const restored = readProgress(raw);
    // Compare-and-swap protects newer data written by another tab.
    await platform.saveState(
      PROGRESS,
      JSON.stringify(restored),
      lastStored,
      SETTINGS,
      JSON.stringify(settings),
      {},
    );
    location.reload();
  } catch {
    readWarning =
      "Не удалось восстановить копию. Текущая партия сохранена без изменений.";
    showSaveState();
  } finally {
    busy = false;
    restoreRead.disabled = false;
  }
};
readNotice.append(readText, restoreRead, dismissRead);
document.querySelector(".game")!.prepend(notice);
$("load-latest").onclick = () => location.reload();
function showSaveState() {
  const parent = dialog.open ? dialog : document.querySelector(".game")!;
  if (notice.parentElement !== parent) parent.prepend(notice);
  if (readNotice.parentElement !== parent) parent.prepend(readNotice);
  readNotice.hidden = !readWarning;
  restoreRead.hidden = !recoveryAvailable || futureSave;
  dismissRead.hidden = futureSave;
  readText.textContent = readWarning;
  notice.hidden = !saveFailed;
  $("save-warning").textContent = storageConflict
    ? "В другой вкладке есть более новое сохранение. Оно защищено от перезаписи."
    : "Не удалось сохранить партию. Не закрывайте игру — повторите сохранение.";
  $("load-latest").hidden = !storageConflict;
  $("retry-save").hidden = !saveFailed || storageConflict;
}
function save(state = progress, game = session) {
  if (storageConflict || futureSave || (switching && state === progress))
    return;
  metadata(state);
  if (lesson < 0 && !busy) game.current.scroll = viewport.scrollTop;
  state.sessions[state.active] = game;
  const bundle = JSON.stringify(state),
    prefs = JSON.stringify(settings);
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (storageConflict || futureSave) return;
      try {
        const patch = { ...settingsDirty };
        const merged = await platform.saveState(
          PROGRESS,
          bundle,
          lastStored,
          SETTINGS,
          prefs,
          patch,
        );
        for (const key of Object.keys(patch))
          if (settingsDirty[key] === patch[key]) delete settingsDirty[key];
        applySettings(merged);
        lastStored = bundle;
        const recovered = saveFailed;
        saveFailed = false;
        showSaveState();
        if (recovered) {
          saveRecovered = true;
          message("Партия сохранена");
        }
      } catch (error) {
        storageConflict = error instanceof platform.SaveConflict;
        saveFailed = true;
        showSaveState();
        message($("save-warning").textContent!);
      }
    });
  return saveQueue;
}
function applySettings(incoming: Record<string, unknown>) {
  for (const key of ["theme", "sound", "vibration", "tutorialDone"] as const) {
    if (Object.hasOwn(settingsDirty, key)) continue;
    if (key === "theme")
      settings.theme = incoming.theme === "dark" ? "dark" : "light";
    else settings[key] = incoming[key] === true;
  }
  applyTheme();
  $<HTMLInputElement>("sound").checked = settings.sound;
  $<HTMLInputElement>("vibration").checked = settings.vibration;
}
window.addEventListener("storage", (event) => {
  if (event.key !== SETTINGS || !event.newValue) return;
  try {
    applySettings(JSON.parse(event.newValue));
  } catch {
    /* Preserve the current valid settings. */
  }
});
function applyTheme() {
  if (document.documentElement.dataset.theme === settings.theme) return;
  document.documentElement.dataset.theme = settings.theme;
  $<HTMLInputElement>("dark").checked = settings.theme === "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      settings.theme === "dark" ? "#202724" : "#fafbf9",
    );
}
function setTheme(dark: boolean) {
  settings.theme = dark ? "dark" : "light";
  settingsDirty.theme = settings.theme;
  applyTheme();
  save();
}
function feedback() {
  if (settings.vibration) void platform.haptic().catch(() => {});
  playSound("pair", settings.sound);
}
function drawPath(path: Connection | null) {
  $("paths").innerHTML = "";
  if (path?.kind === "reading") {
    const w = $("board").clientWidth / 9;
    $("paths").innerHTML =
      `<path d="M${w * 9 - 9},${Math.floor(path.a / 9) * w + w * 0.8}h6m-3,-3l3,3 -3,3 M9,${Math.floor(path.b / 9) * w + w * 0.8}H3m3,-3l-3,3 3,3"/>`;
  }
  updateJump();
}
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function motion(el: Element | null, frames: Keyframe[], duration = 160) {
  if (el && !reduced()) el.animate(frames, { duration, easing: "ease-out" });
}
function cell(i: number) {
  return boardView.cell(i);
}
function updateJump() {
  const button = $("hint-jump");
  button.hidden = true;
  if (!highlight) return;
  const rect = viewport.getBoundingClientRect();
  const other =
    selected === highlight.a
      ? highlight.b
      : selected === highlight.b
        ? highlight.a
        : highlight.b;
  const c = cell(other)?.getBoundingClientRect();
  if (!c) return;
  if (c.top < rect.top || c.bottom > rect.bottom) {
    button.hidden = false;
    button.textContent =
      c.top < rect.top ? "↑ Вторая цифра выше" : "↓ Вторая цифра ниже";
    button.onclick = () =>
      cell(other)?.scrollIntoView({
        block: "center",
        behavior: reduced() ? "instant" : "smooth",
      });
  }
}
function digitWord(n: number) {
  return n % 10 === 1 && n % 100 !== 11
    ? "цифра"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "цифры"
      : "цифр";
}
function activePuzzle(): Puzzle | undefined {
  return (
    notebook.find((p) => p.id === progress.active) ??
    (progress.active.startsWith("daily-v1-")
      ? daily(progress.active.slice(9))
      : undefined)
  );
}
let earnedAward = "";
function complete() {
  const id = progress.active,
    month = id.slice(9, 16);
  const before = id.startsWith("daily-v1-")
    ? trophy(month, progress.done).tier
    : 0;
  recordCompletion(progress, id);
  const after = id.startsWith("daily-v1-")
    ? trophy(month, progress.done).tier
    : 0;
  earnedAward =
    after > before
      ? `${["", "Бронза", "Серебро", "Золото"][after]} за ${monthName(month)}`
      : "";
}
function renderWin() {
  const id = progress.active;
  $("win-stats").textContent =
    `Пар убрано: ${session.current.moves} · Добавлений: ${session.current.additions} · Подсказок: ${progress.hints[id] ?? 0}`;
  const i = notebook.findIndex((p) => p.id === id);
  const next = nextTask(id, progress.done);
  $("play-again").textContent = next
    ? i >= 0 && volumeOf(next) !== volumeOf(id)
      ? "Следующая тетрадь"
      : "Следующая задача"
    : i >= 0
      ? "К тетради"
      : id.startsWith("daily")
        ? "К календарю"
        : "Ещё партия";
  $("completion-status").textContent =
    i >= 0 &&
    volumeTasks(volumeOf(id)).every((p) => progress.done.includes(p.id))
      ? "Тетрадь пройдена"
      : next
        ? ""
        : i >= 0
          ? "Тетрадь пройдена"
          : id.startsWith("daily")
            ? "Все доступные дни решены"
            : "";
  const award = $("award");
  award.hidden = true;
  if (i >= 0) {
    const page = Math.floor(i / 6);
    const n = notebook
      .slice(page * 6, page * 6 + 6)
      .filter((p) => progress.done.includes(p.id)).length;
    award.hidden = false;
    award.textContent =
      n === 6
        ? `✓ Страница ${page + 1} завершена`
        : `Страница ${(page % 4) + 1} · ${n} из 6`;
  }
  if (id.startsWith("daily")) {
    const m = id.slice(9, 16),
      t = trophy(m, progress.done);
    award.hidden = false;
    award.textContent = `${earnedAward ? earnedAward + " · " : ""}${t.count} из ${days(m).length} дней · ${["Первый трофей — за 7 задач", "Бронзовый трофей", "Серебряный трофей", "Золотой трофей"][t.tier]}`;
  }
}
function render() {
  $("recover-task").hidden = true;
  const focusedIndex = document.activeElement?.closest("#board")
    ? (document.activeElement as HTMLElement).dataset.index
    : undefined;
  $<HTMLButtonElement>("lesson-next").disabled = busy;
  $<HTMLButtonElement>("skip").disabled = busy;
  const values = board(),
    count = occupied(values),
    available = availablePairs(values);
  document
    .querySelector(".game")!
    .classList.toggle(
      "compact-game",
      lesson < 0 && progress.active !== "classic",
    );
  $("add").hidden = lesson < 0 && progress.active !== "classic";
  renderJar();
  const taskIndex = notebook.findIndex((p) => p.id === progress.active);
  const marks = $("page-progress");
  marks.hidden = lesson >= 0 || taskIndex < 0;
  if (taskIndex >= 0) {
    const pageIndex = Math.floor(taskIndex / 6);
    marks.innerHTML = `<span>Тетрадь ${Math.floor(taskIndex / 24) + 1} · стр. ${(pageIndex % 4) + 1}</span><div>${notebook
      .slice(pageIndex * 6, pageIndex * 6 + 6)
      .map(
        (p) =>
          `<i class="${progress.done.includes(p.id) ? "finished" : p.id === progress.active ? "current" : ""}">${progress.done.includes(p.id) ? "✓" : ""}</i>`,
      )
      .join("")}</div>`;
    marks.setAttribute(
      "aria-label",
      `Тетрадь ${Math.floor(taskIndex / 24) + 1} · стр. ${(pageIndex % 4) + 1}, задача ${(taskIndex % 6) + 1} из 6`,
    );
  }
  $("restart-task").hidden =
    lesson >= 0 ||
    progress.active === "classic" ||
    !count ||
    available.length > 0;
  $("remaining").textContent = String(count);
  $("noun").textContent = digitWord(count);
  $("mode").textContent =
    lesson >= 0
      ? "Как играть"
      : progress.active === "classic"
        ? "Классика"
        : progress.active.startsWith("book")
          ? volumeOf(progress.active) === 0
            ? `Тетрадь · задача ${Number(progress.active.slice(8))}`
            : `Тетрадь ${volumeOf(progress.active) + 1} · задача ${((Number(progress.active.slice(8)) - 1) % 24) + 1}`
          : `Задача дня · ${progress.active.slice(9).split("-").reverse().join(".")}`;
  boardView.render(values, selected, highlight);
  $("win").hidden = count > 0 || lesson >= 0;
  if (!count && lesson < 0) renderWin();
  $("board-wrap").hidden = count === 0;
  $<HTMLButtonElement>("undo").disabled =
    busy ||
    (lesson >= 0
      ? !(lesson === 5 && lessonPhase === 1)
      : !session.history.length);
  $<HTMLButtonElement>("hint").disabled =
    busy ||
    lesson >= 0 ||
    hintPending ||
    !count ||
    (progress.active === "classic" && !available.length);
  $("add").setAttribute(
    "aria-disabled",
    String(
      busy ||
        !count ||
        available.length > 0 ||
        (lesson >= 0 && lesson !== 5) ||
        (lesson < 0 && progress.active !== "classic"),
    ),
  );
  $("add-label").textContent =
    progress.active !== "classic" && lesson < 0
      ? "Добавить"
      : available.length || !count
        ? "Добавить"
        : `Добавить ${count}`;
  $("add").classList.toggle(
    "ready",
    !available.length &&
      count > 0 &&
      (progress.active === "classic" || lesson === 5),
  );
  if (lesson < 0 && !saveFailed)
    message(
      saveRecovered
        ? "Партия сохранена"
        : count === 0
          ? "Партия завершена"
          : available.length
            ? highlight
              ? "Соедините две отмеченные цифры"
              : "Одинаковые цифры или сумма 10"
            : progress.active === "classic"
              ? "Пар нет. Добавьте оставшиеся цифры."
              : "Пар нет. Отмените ход или начните задачу заново.",
    );
  drawPath(highlight);
  if (focusedIndex !== undefined) {
    const target = $("board").querySelector<HTMLElement>(
      `button[data-index="${focusedIndex}"]`,
    );
    (
      target ??
      $("board").querySelector<HTMLElement>("button") ??
      (lesson >= 0 ? $("lesson-next") : $("play-again"))
    ).focus({ preventScroll: true });
  }
}
function cancelHint() {
  hintGeneration++;
  hintPending = false;
}
function clearSelection() {
  cancelHint();
  selected = -1;
  highlight = null;
}
function startLesson(short = false) {
  shortLesson = short;
  if (busy) return;
  session.current.scroll = viewport.scrollTop;
  lesson = 0;
  loadLesson();
  closeMenu();
}
function loadLesson() {
  lessonBoard = [...lessons[lesson].cells];
  lessonPhase = 0;
  clearSelection();
  $("lesson").hidden = false;
  $("lesson-step").textContent =
    `${lesson + 1} / ${shortLesson ? 2 : lessons.length}`;
  $("lesson-title").textContent = lessons[lesson].title;
  $("lesson-text").textContent =
    lessons[lesson].text +
    (shortLesson && lesson === 1
      ? " На большом поле соединяйте по горизонтали, вертикали или диагонали: другие цифры между ними мешают, пустые клетки — нет."
      : "");
  $("lesson-next").hidden = true;
  viewport.scrollTop = 0;
  render();
  message("Попробуйте на маленьком поле");
}
function finishLesson() {
  if (busy) return;
  lesson = -1;
  settings.tutorialDone = true;
  settingsDirty.tutorialDone = true;
  $("lesson").hidden = true;
  clearSelection();
  render();
  viewport.scrollTop = session.current.scroll;
  save();
  platform.gameplay(true);
}
async function choose(i: number) {
  cancelHint();
  saveRecovered = false;
  if (busy || paused || dialog.open) return;
  const values = board();
  if (!values[i] || selected === i) {
    clearSelection();
    render();
    return;
  }
  if (lesson >= 0 && lessonPhase === 2) return;
  if (selected < 0) {
    selected = i;
    playSound("select", settings.sound);
    if (highlight && i !== highlight.a && i !== highlight.b) highlight = null;
    render();
    motion(cell(i), [{ transform: "scale(.92)" }, { transform: "scale(1)" }]);
    return;
  }
  const a = selected,
    result = checkPair(values, a, i);
  if (!result.ok) {
    selected = i;
    highlight = null;
    render();
    motion(cell(a), [{ background: "#dba5a5" }, { background: "transparent" }]);
    motion(cell(i), [
      { transform: "translateX(-3px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(0)" },
    ]);
    message(
      {
        same: "Выберите другую цифру",
        empty: "Здесь нет цифры",
        value: "Нужны одинаковые цифры или сумма 10",
        blocked: "Между цифрами есть препятствие",
        direction: "Соединяйте по прямой или по порядку чтения",
      }[result.reason],
    );
    return;
  }
  if (lesson === 5) {
    message("Сначала попробуйте «Добавить», затем «Отмена»");
    return;
  }
  const flightRects = [cell(a), cell(i)]
    .filter(Boolean)
    .map((n) => n!.getBoundingClientRect());
  busy = true;
  highlight = result.path;
  render();
  feedback();
  for (const n of [a, i]) cell(n)?.classList.add("erasing");
  const oldLength = values.length,
    next = removePair(values, a, i);
  // Commit the accepted move before awaiting a decorative animation.
  if (lesson < 0) {
    session = commit(session, next, "pair", viewport.scrollTop);
    hintIndex = 0;
    if (progress.active === "classic") {
      const gain = collectPair(progress, session.current.moves);
      if (gain)
        flights.fly(flightRects, $("jar-glass"), () => {
          const before = jarState(visualSeeds ?? 0);
          visualSeeds = Math.min(jars(progress).seeds, (visualSeeds ?? 0) + 1);
          const after = jarState(visualSeeds);
          if (after.index > before.index) {
            completedJar = {
              index: before.index,
              until: performance.now() + 650,
            };
            setTimeout(() => renderJar(), 660);
          }
          renderJar();
          if (!dialog.open && !paused) {
            playSound(
              after.index > before.index
                ? "full"
                : Math.floor(after.percent / 25) >
                    Math.floor(before.percent / 25)
                  ? "milestone"
                  : "land",
              settings.sound,
            );
            motion(
              $("jar-glass"),
              [
                { transform: "rotate(-3deg) scale(1.05)" },
                { transform: "rotate(2deg)" },
                { transform: "none" },
              ],
              after.index > before.index ? 420 : 180,
            );
          }
        });
    }
    if (!occupied(next)) complete();
    save();
  }
  await new Promise((r) => setTimeout(r, reduced() ? 0 : 100));
  const blank = [...values];
  blank[a] = blank[i] = 0;
  const positions = new Map<number, number>();
  let offset = 0;
  for (let row = 0; row < blank.length; row += 9) {
    if (!blank.slice(row, row + 9).some(Boolean)) {
      offset += 9;
      continue;
    }
    for (let c = row; c < Math.min(row + 9, blank.length); c++)
      positions.set(c - offset, c);
  }
  const oldRects = new Map<HTMLElement, DOMRect>();
  const boardRect = $("board").getBoundingClientRect();
  const previousHeight = boardRect.height;
  if (next.length < oldLength && !reduced()) {
    const viewRect = viewport.getBoundingClientRect();
    const rowHeight = boardRect.width / WIDTH;
    const firstRow = Math.max(
      0,
      Math.floor((viewRect.top - boardRect.top) / rowHeight) - 1,
    );
    const lastRow =
      Math.ceil((viewRect.bottom - boardRect.top) / rowHeight) + 1;
    for (const [nextIndex, oldIndex] of positions) {
      const oldRow = Math.floor(oldIndex / WIDTH),
        nextRow = Math.floor(nextIndex / WIDTH);
      if (
        (oldRow < firstRow || oldRow > lastRow) &&
        (nextRow < firstRow || nextRow > lastRow)
      )
        continue;
      const node = cell(oldIndex);
      if (node) oldRects.set(node, node.getBoundingClientRect());
    }
  }
  const hadBoardFocus = $("board").contains(document.activeElement);
  boardView.remap(positions);
  if (lesson >= 0) {
    lessonBoard = next;
    lessonPhase = 2;
    $("lesson-next").hidden = false;
    $("lesson-next").textContent =
      lesson === 5 || (shortLesson && lesson === 1) ? "Начать игру" : "Дальше";
  }
  clearSelection();
  busy = false;
  render();
  if (hadBoardFocus && !$("board").contains(document.activeElement))
    (
      $("board").querySelector<HTMLElement>("button") ??
      (lesson >= 0 ? $("lesson-next") : $("play-again"))
    ).focus({ preventScroll: true });
  if (next.length < oldLength && !reduced()) {
    // Read every destination before starting animations; interleaving them forces
    // layout once per cell on long boards.
    const movements = [...oldRects]
      .filter(([node]) => node.isConnected)
      .map(([node, rect]) => ({
        node,
        dy: rect.top - node.getBoundingClientRect().top,
      }));
    const height = $("board").getBoundingClientRect().height;
    for (const { node, dy } of movements) {
      if (Math.abs(dy) > 1)
        motion(node, [{ translate: `0 ${dy}px` }, { translate: "0 0" }], 170);
    }
    motion(
      $("board"),
      [{ height: `${previousHeight}px` }, { height: `${height}px` }],
      170,
    );
  }
  if (lesson >= 0) message("Получилось!");
  else if (occupied(next) && result.path.kind === "reading")
    teach(
      "reading",
      "Конец строки продолжается в начале следующей. Пустоты не мешают.",
    );
  else if (
    occupied(next) &&
    Math.abs((a % 9) - (i % 9)) ===
      Math.abs(Math.floor(a / 9) - Math.floor(i / 9))
  )
    teach("diagonal", "По диагонали тоже можно: если между цифрами пусто.");
  else if (occupied(next) && Math.abs(a - i) > 9)
    teach("gaps", "Пустые клетки между цифрами не мешают соединению.");
  if (!occupied(board()) && lesson < 0) platform.gameplay(false);
}
function add() {
  saveRecovered = false;
  if (busy || paused) return;
  const values = board();
  if (lesson >= 0 && lesson !== 5) return;
  if (!occupied(values)) return;
  if (lesson < 0 && progress.active !== "classic") {
    message(
      "В короткой задаче цифры не добавляются. Есть решение из начальной позиции: используйте отмену.",
    );
    return;
  }
  if (availablePairs(values).length) {
    message("На поле ещё есть пары. Можно воспользоваться подсказкой.");
    return;
  }
  try {
    const next = addNumbers(values);
    if (lesson === 5) {
      lessonBoard = next;
      lessonPhase = 1;
      message("Цифры добавлены. Теперь нажмите «Отмена».");
    } else {
      session = commit(session, next, "add", viewport.scrollTop);
      save();
    }
    clearSelection();
    render();
    cell(values.length)?.scrollIntoView({
      block: "center",
      behavior: reduced() ? "instant" : "smooth",
    });
    for (let j = values.length; j < next.length; j++)
      motion(
        cell(j),
        [
          { background: "var(--selected)", opacity: 0.3 },
          { background: "transparent", opacity: 1 },
        ],
        240,
      );
    if (lesson === 5) message("Теперь нажмите «Отмена»");
  } catch {
    message(
      `Поле достигло предела прототипа (${MAX_CELLS} клеток). Отмените ходы или начните новую партию. Это не поражение.`,
    );
  }
}
function undoAction() {
  saveRecovered = false;
  if (busy || paused) return;
  if (lesson === 5 && lessonPhase === 1) {
    lessonBoard = [...lessons[5].cells];
    lessonPhase = 2;
    $("lesson-next").hidden = false;
    $("lesson-next").textContent = "Начать игру";
    render();
    message("Поле восстановлено. Вы готовы!");
    return;
  }
  if (lesson >= 0) return;
  const before = [...session.current.board];
  session = undo(session);
  clearSelection();
  render();
  viewport.scrollTop = session.current.scroll;
  session.current.board.forEach((v, i) => {
    if (v && v !== before[i])
      motion(
        cell(i),
        [{ background: "var(--selected)" }, { background: "transparent" }],
        220,
      );
  });
  save();
  platform.gameplay(occupied(board()) > 0);
}
async function hint() {
  saveRecovered = false;
  if (busy || paused || lesson >= 0 || hintPending) return;
  const available = availablePairs(board());
  if (progress.active !== "classic") {
    const generation = ++hintGeneration,
      originalBoard = board(),
      originalSession = session;
    hintPending = true;
    $<HTMLButtonElement>("hint").disabled = true;
    message("Ищу подсказку…");
    const result = await requestAdvice(
      originalBoard,
      session.history,
      activePuzzle()!,
    );
    if (
      generation !== hintGeneration ||
      board() !== originalBoard ||
      session !== originalSession ||
      lesson >= 0 ||
      dialog.open ||
      paused
    )
      return;
    hintPending = false;
    $<HTMLButtonElement>("hint").disabled = false;
    const { advice, recovery } = result;
    if (
      advice.kind === "dead" ||
      (advice.kind === "unknown" && recovery >= 0)
    ) {
      if (recovery >= 0) {
        const index = recovery;
        $("recover-task").hidden = false;
        $("recover-task").textContent = `Вернуться к решаемому полю`;
        $("recover-task").onclick = () => {
          session = {
            rules: 1,
            current: session.history[index],
            history: session.history.slice(0, index),
          };
          clearSelection();
          render();
          viewport.scrollTop = session.current.scroll;
          save();
          hint();
        };
        message(
          advice.kind === "dead"
            ? "Из этой позиции решения нет. Можно вернуться к решаемому полю."
            : "Этот путь пока не удалось проверить. Можно вернуться к проверенному решению.",
        );
      } else message("Из этой позиции решения нет. Начните задачу заново.");
      return;
    }
    if (advice.kind !== "move") {
      message(
        session.history.length
          ? "Не удалось найти подсказку. Можно отменить последний ход или продолжить самостоятельно."
          : "Не удалось найти подсказку. Попробуйте ещё раз или продолжите самостоятельно.",
      );
      return;
    }
    highlight = advice.pair;
  } else {
    if (!available.length) return;
    highlight = available[hintIndex++ % available.length];
  }
  progress.hints[progress.active] = (progress.hints[progress.active] ?? 0) + 1;
  save();
  selected = -1;
  render();
  const top = Math.min(highlight.a, highlight.b);
  $("board")
    .querySelector(`[data-index="${top}"]`)
    ?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const ca = cell(highlight.a),
    cb = cell(highlight.b);
  if (
    ca &&
    cb &&
    Math.abs(cb.offsetTop - ca.offsetTop) + ca.offsetHeight <=
      viewport.clientHeight
  ) {
    viewport.scrollTo({
      top: Math.max(
        0,
        (ca.offsetTop + cb.offsetTop) / 2 -
          viewport.clientHeight / 2 +
          ca.offsetHeight / 2,
      ),
      behavior: reduced() ? "instant" : "smooth",
    });
  }
  message(
    highlight.kind === "reading"
      ? "Допустимая пара: конец строки → начало следующей"
      : "Допустимая пара — соедините выделенные цифры",
  );
}
function closeMenu() {
  dialog.close();
  render();
  showSaveState();
  document.body.classList.remove("navigation-open");
  platform.gameplay(!paused && occupied(board()) > 0);
}
function navigateBack(native = false): boolean {
  if (busy) return true;
  if (dialog.open) {
    if ($("menu-content").hidden) openMenu();
    else if (native) return false;
    else closeMenu();
  } else if (lesson >= 0) finishLesson();
  else openMenu();
  return true;
}
function openMenu() {
  if (busy) return;
  flights.clear();
  updateHome();
  cancelHint();
  if (!busy) render();
  document.body.classList.add("navigation-open");
  dialog.dataset.screen = "home";
  $("settings-panel").hidden = true;
  $("resume-context").textContent = $("mode").textContent;
  $("resume").textContent = occupied(board())
    ? session.history.length
      ? "Продолжить игру"
      : "Играть"
    : "Посмотреть результат";
  $("collection").hidden = true;
  $("menu-content").hidden = false;
  $("confirm-content").hidden = true;
  if (!dialog.open) dialog.showModal();
  showSaveState();
  $("resume").focus({ preventScroll: true });
  platform.gameplay(false);
}
function reset() {
  if (busy || saveFailed) return;
  earnedAward = "";
  startAttempt(progress, progress.active);
  saveRecovered = false;
  session = activePuzzle() ? puzzleSession(activePuzzle()!) : newSession();
  progress.hints[progress.active] = 0;
  clearSelection();
  if (lesson >= 0) {
    lesson = -1;
    $("lesson").hidden = true;
  }
  viewport.scrollTop = 0;
  closeMenu();
  render();
  save();
}
$("board").addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
  if (target) void choose(Number(target.dataset.index));
});
$("board").addEventListener("keydown", (e) => {
  const k = e.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return;
  e.preventDefault();
  const start = Number((e.target as HTMLElement).dataset.index);
  const step =
    k === "ArrowLeft"
      ? -1
      : k === "ArrowRight"
        ? 1
        : k === "ArrowUp"
          ? -WIDTH
          : WIDTH;
  for (let i = start + step; i >= 0 && i < board().length; i += step)
    if (board()[i]) {
      ($("board").querySelector(`[data-index="${i}"]`) as HTMLElement)?.focus();
      break;
    }
});
$("undo").onclick = undoAction;
$("hint").onclick = hint;
$("add").onclick = add;
$("menu").onclick = openMenu;
$("close").onclick = closeMenu;
$("resume").onclick = closeMenu;
$("book-top").onclick = () => openCollection("book");
$("new").onclick = () => {
  if (!session.history.length || !occupied(session.current.board)) {
    reset();
    return;
  }
  $("menu-content").hidden = true;
  $("settings-panel").hidden = true;
  $("confirm-content").hidden = false;
};
$("cancel-new").onclick = openMenu;
$("settings-open").onclick = () => {
  $("menu-content").hidden = true;
  $("settings-panel").hidden = false;
  dialog.dataset.screen = "settings";
  $("settings-back").focus();
};
$("settings-back").onclick = openMenu;
$("confirm-new").onclick = reset;
$("restart-task").onclick = () => {
  openMenu();
  $("new").click();
};
$("play-again").onclick = async () => {
  if (busy) return;
  busy = true;
  $<HTMLButtonElement>("play-again").disabled = true;
  await save();
  busy = false;
  $<HTMLButtonElement>("play-again").disabled = false;
  if (saveFailed) return;
  const next = nextTask(progress.active, progress.done);
  if (next) await switchGame(next);
  else if (progress.active.startsWith("book")) openCollection("book");
  else if (progress.active.startsWith("daily")) openCollection("calendar");
  else reset();
};
$("learn").onclick = () => startLesson();
$("skip").onclick = finishLesson;
$("lesson-next").onclick = () => {
  if (lesson === 5 || (shortLesson && lesson === 1)) finishLesson();
  else {
    lesson++;
    loadLesson();
  }
};
$("dark").onchange = () => setTheme($<HTMLInputElement>("dark").checked);
for (const key of ["sound", "vibration"] as const)
  $(key).onchange = () => {
    settings[key] = $<HTMLInputElement>(key).checked;
    settingsDirty[key] = settings[key];
    save();
  };
$("retry-save").onclick = () => {
  save();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dialog.open) {
    e.preventDefault();
    navigateBack();
  }
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  navigateBack();
});
let scrollTimer: ReturnType<typeof setTimeout>;
viewport.addEventListener("scroll", () => {
  updateJump();
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (lesson < 0) save();
  }, 200);
});
window.addEventListener("resize", () => drawPath(highlight));
document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
  if (paused) flights.clear();
  cancelHint();
  if (!busy) render();
  platform.gameplay(!paused && !dialog.open && occupied(board()) > 0);
  if (paused) {
    if (!busy) save();
    suspendSound();
  }
});
window.addEventListener("pagehide", () => {
  if (!busy) save();
});
async function boot() {
  let warning = "";
  try {
    const bundle = await platform.read(PROGRESS);
    lastStored = bundle;
    if (bundle) {
      try {
        progress = readProgress(bundle, () => {
          warning =
            "Часть сохранения повреждена. Исправные партии и отметки задач восстановлены.";
          readWarning = warning;
        });
      } catch (error) {
        try {
          await platform.write(PROGRESS + ".recovery", bundle);
        } catch {
          /* Warning remains visible even when backup storage is unavailable. */
        }
        throw error;
      }
      if (readWarning) {
        try {
          await platform.write(PROGRESS + ".recovery", bundle);
        } catch {
          /* Keep the recovery notice. */
        }
      }
      session = progress.sessions[progress.active];
    } else {
      const stored = await platform.read(KEY);
      if (stored) session = decode(stored);
      progress.sessions.classic = session;
    }
  } catch (error) {
    futureSave = error instanceof FutureProgress;
    warning = futureSave
      ? "Сохранение создано более новой версией игры. Обновите игру. Запись отключена, исходный прогресс защищён."
      : "Сохранение не удалось прочитать. Открыта новая партия.";
    readWarning = warning;
  }
  try {
    const raw = await platform.read(SETTINGS);
    if (raw) {
      const s = JSON.parse(raw);
      settings = {
        theme: s.theme === "dark" ? "dark" : "light",
        sound: s.sound === true,
        vibration: s.vibration === true,
        tutorialDone: s.tutorialDone === true,
      };
    }
  } catch {
    /* Defaults remain usable. */
  }
  try {
    recoveryAvailable = Boolean(await platform.read(PROGRESS + ".recovery"));
  } catch {}
  if (recoveryAvailable && !readWarning)
    readWarning =
      "Доступна резервная копия. Восстановление заменит текущий прогресс данными копии.";
  if (progress.active.startsWith("book") && volumeOf(progress.active) > 0) {
    try {
      await loadNotebook();
    } catch {
      readWarning =
        "Сохранённое поле доступно. Чтобы вернуть подсказки, попробуйте открыть эту тетрадь заново.";
    }
  }
  metadata(progress);
  jars(progress);
  visualSeeds = jars(progress).seeds;
  selectedVolume = progress.active.startsWith("book")
    ? volumeOf(progress.active)
    : 0;
  applyTheme();
  $<HTMLInputElement>("sound").checked = settings.sound;
  $<HTMLInputElement>("vibration").checked = settings.vibration;
  render();
  viewport.scrollTop = session.current.scroll;
  try {
    await platform.initPlatform(
      () => {
        paused = true;
        cancelHint();
        if (!busy) render();
        platform.gameplay(false);
        suspendSound();
        if (!busy) save();
      },
      () => {
        paused = false;
        if (!busy) render();
        platform.gameplay(!dialog.open && occupied(board()) > 0);
      },
    );
  } catch {
    warning = "Сервис площадки недоступен. Можно играть без него.";
  }
  $("app").inert = false;
  void platform
    .listenAppState((active) => {
      paused = !active;
      cancelHint();
      if (!busy) render();
      platform.gameplay(active && !dialog.open && occupied(board()) > 0);
      if (!active) {
        if (!busy) save();
        suspendSound();
      }
    })
    .catch(() => {});
  void platform.listenBack(() => navigateBack(true)).catch(() => {});
  if (!settings.tutorialDone) startLesson(true);
  else openMenu();
  platform.ready();
  platform.gameplay(!dialog.open);
  if (warning) message(warning);
  showSaveState();
}
function teach(id: string, text: string) {
  if (progress.seen.includes(id)) return;
  progress.seen.push(id);
  message(text);
  save();
}
async function switchGame(id: string) {
  earnedAward = "";
  saveRecovered = false;
  if (busy || futureSave || storageConflict) return;
  if (id.startsWith("daily") && !availableDay(id.slice(9))) return;
  if (id.startsWith("book") && volumeOf(id) > 0) {
    busy = true;
    dialog.inert = true;
    const loading = document.createElement("p");
    loading.setAttribute("role", "status");
    loading.textContent = "Открываю тетрадь…";
    $("collection").prepend(loading);
    try {
      await loadNotebook();
    } catch {
      message("Не удалось открыть тетрадь. Попробуйте ещё раз.");
      return;
    } finally {
      busy = false;
      dialog.inert = false;
    }
  }

  if (lesson < 0 && !busy) session.current.scroll = viewport.scrollTop;
  progress.sessions[progress.active] = session;
  flights.clear();
  const candidate = structuredClone(progress);
  if (
    progress.active !== id &&
    progress.active !== "classic" &&
    !occupied(session.current.board)
  )
    candidate.sessions[progress.active].history = [];

  candidate.active = id;
  const p =
    notebook.find((p) => p.id === id) ??
    (id.startsWith("daily-v1-") ? daily(id.slice(9)) : undefined);
  if (!candidate.sessions[id]) startAttempt(candidate, id);
  let nextSession =
    candidate.sessions[id] ?? (p ? puzzleSession(p) : newSession());
  if (p && !occupied(nextSession.current.board)) {
    startAttempt(candidate, id);
    nextSession = puzzleSession(p);
    candidate.hints[id] = 0;
  }
  // Publish the new mode only after its complete snapshot has been persisted.
  busy = true;
  switching = true;
  dialog.inert = true;
  await save(candidate, nextSession);
  switching = false;
  dialog.inert = false;
  busy = false;
  if (saveFailed || futureSave) return;
  progress = candidate;
  session = nextSession;
  if (id.startsWith("book")) selectedVolume = volumeOf(id);
  lesson = -1;
  $("lesson").hidden = true;
  clearSelection();
  closeMenu();
  render();
  viewport.scrollTop = session.current.scroll;
}
const months = () => {
  const result: string[] = [];
  const end = today().slice(0, 7);
  let m = FIRST_MONTH;
  while (m <= end && result.length < 1200) {
    result.push(m);
    const [y, n] = m.split("-").map(Number);
    m = n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, "0")}`;
  }
  return result;
};
const monthName = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString(
    "ru",
    { month: "long", year: "numeric" },
  );
function openCollection(kind: "book" | "calendar" | "trophies" | "progress") {
  if (busy) return;
  openMenu();
  dialog.dataset.screen = kind;
  $("menu-content").hidden = true;
  const panel = $("collection");
  panel.hidden = false;
  let html = '<button class="text-button" id="collection-back">← Меню</button>';
  if (kind === "progress") {
    const m = metadata(progress);
    const completedBook = notebook.filter((p) =>
      progress.done.includes(p.id),
    ).length;
    const completedDaily = progress.done.filter(
      (id) =>
        id.startsWith("daily-v1-") && availableDay(id.slice(9), "9999-12-31"),
    ).length;
    html += `<h2>Мой прогресс</h2><dl class="progress-stats"><div><dt>Тетрадь</dt><dd>${completedBook} из ${notebook.length}</dd></div><div><dt>Решено дейликов</dt><dd>${completedDaily}</dd></div><div><dt>Завершено партий</dt><dd>${m.completed}</dd></div><div><dt>Без подсказок</dt><dd>${m.unassisted}</dd></div></dl><p class="fine">Партии и прохождения без подсказок считаются с ${new Date(m.since).toLocaleDateString("ru")}. Старые отметки задач сохранены.</p><button id="progress-trophies" class="secondary">Коллекция</button><p class="fine">Прогресс сохраняется на этом устройстве.</p>`;
  } else if (kind === "book") {
    const finished = new Set(progress.done);
    const status = (v: number) => {
      const tasks = volumeTasks(v),
        n = tasks.filter((p) => finished.has(p.id)).length;
      return {
        n,
        started:
          n > 0 || tasks.some((p) => progress.sessions[p.id]?.history.length),
      };
    };
    const allowed = (v: number) =>
      bookFilter === "all" ||
      (bookFilter === "done"
        ? status(v).n === 24
        : bookFilter === "new"
          ? !status(v).started
          : status(v).started && status(v).n < 24);
    const candidates = Array.from({ length: 100 }, (_, i) => i).filter(allowed);
    if (!candidates.includes(selectedVolume) && candidates.length)
      selectedVolume = candidates[0];
    const chapter = Math.floor(selectedVolume / 10),
      stats = status(selectedVolume);
    html += `<h2>Тетради</h2><p class="intro">100 тетрадей · 2400 задач</p><div class="archive-controls"><label>Раздел<select id="book-chapter">${chapterNames.map((n, i) => `<option value="${i}" ${i === chapter ? "selected" : ""}>${i + 1}. ${n}</option>`).join("")}</select></label><label>Показать<select id="book-filter">${[
      ["all", "Все"],
      ["new", "Не начаты"],
      ["active", "В процессе"],
      ["done", "Пройдены"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${bookFilter === v ? "selected" : ""}>${t}</option>`,
      )
      .join("")}</select></label></div><div class="volume-shelf">${candidates
      .filter((v) => Math.floor(v / 10) === chapter)
      .map(
        (v) =>
          `<button class="volume-cover ${v === selectedVolume ? "current" : ""}" data-volume="${v}" style="--cover-hue:${(v * 37) % 360}" aria-label="Тетрадь ${v + 1}, ${status(v).n} из 24"><strong>${v + 1}</strong><small>${status(v).n}/24</small></button>`,
      )
      .join("")}</div>`;
    if (candidates.length) {
      const tasks = volumeTasks(selectedVolume);
      const continuing =
        tasks.find(
          (p) => progress.sessions[p.id]?.history.length && !finished.has(p.id),
        ) ??
        tasks.find((p) => !finished.has(p.id)) ??
        tasks[0];
      html += `<div class="volume-heading"><h3>Тетрадь ${selectedVolume + 1}</h3><span>${stats.n}/24</span></div><button class="secondary" id="continue-book" data-continue="${continuing.id}">${stats.n === 24 ? "Повторить" : "Продолжить тетрадь"}</button>`;
      for (let page = 0; page < 4; page++) {
        const group = tasks.slice(page * 6, page * 6 + 6),
          n = group.filter((p) => finished.has(p.id)).length;
        html += `<section class="book-page ${n === 6 ? "page-done" : ""}"><div class="page-heading"><h3>Страница ${page + 1}</h3><span>${n}/6</span></div><div class="task-grid">${group.map((p, i) => `<button class="task ${finished.has(p.id) ? "done" : ""}" data-game="${p.id}" ${p.id === progress.active ? 'aria-current="true"' : ""} aria-label="Задача ${selectedVolume * 24 + page * 6 + i + 1}${finished.has(p.id) ? ", решена" : ""}">${page * 6 + i + 1}${finished.has(p.id) ? "<small>✓</small>" : ""}</button>`).join("")}</div>${n === 6 ? '<p class="stamp">Завершено ✓</p>' : ""}</section>`;
      }
    } else html += "<p>Пока нет тетрадей с таким статусом.</p>";
  } else if (kind === "calendar") {
    if (calendarMonth > today().slice(0, 7))
      calendarMonth = today().slice(0, 7);
    const t = trophy(calendarMonth, progress.done),
      weekday =
        (new Date(
          Number(calendarMonth.slice(0, 4)),
          Number(calendarMonth.slice(5)) - 1,
          1,
        ).getDay() +
          6) %
        7;
    html += `<h2>Задача дня</h2>${calendarControls()}<div class="month-nav"><button id="prev-month" aria-label="Предыдущий месяц" ${calendarMonth <= FIRST_MONTH ? "disabled" : ""}>‹</button><h3>${monthName(calendarMonth)}</h3><button id="next-month" aria-label="Следующий месяц" ${calendarMonth >= today().slice(0, 7) ? "disabled" : ""}>›</button></div><div class="calendar">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((x) => `<span>${x}</span>`).join("")}${"<i></i>".repeat(weekday)}${days(
      calendarMonth,
    )
      .map(
        (d) =>
          `<button class="task ${progress.done.includes("daily-v1-" + d) ? "done" : ""} ${d === today() ? "today" : ""}" data-game="daily-v1-${d}" ${!availableDay(d) ? "disabled" : ""} aria-label="${d}${progress.done.includes("daily-v1-" + d) ? ", решена" : ""}">${Number(d.slice(-2))}${progress.done.includes("daily-v1-" + d) ? "<small>✓</small>" : ""}</button>`,
      )
      .join(
        "",
      )}</div><p>${t.count} из ${days(calendarMonth).length} задач решено</p><p class="intro">Любой прошедший день можно решить позже. Здесь не нужно успевать.</p><button class="primary" id="today-task">${progress.done.includes("daily-v1-" + today()) ? "Повторить сегодняшнюю" : "Играть сегодня"}</button><p class="fine">Трофеи: 7 задач · 14 задач · весь месяц</p>`;
  } else {
    html +=
      '<h2>Мои трофеи</h2><p class="intro">Один трофей месяца: бронза за 7 задач, серебро за 14, золото за весь месяц.</p>';
    const j = jarState(jars(progress).seeds);
    jarShelfPage = Math.min(
      jarShelfPage,
      Math.max(0, Math.ceil(j.index / 12) - 1),
    );
    const shelfEnd = j.index - jarShelfPage * 12,
      shelfStart = Math.max(0, shelfEnd - 12);
    html += `<section class="jar-collection"><h3>Баночки классики</h3><p>${j.index} собрано · ${jars(progress).seeds} семечек</p><p class="fine">Следующая: ${j.name} · ${j.filled}/${j.capacity}. Две семечки за продвижение. После отмены начисление возобновится, когда вы пройдёте дальше прежнего хода.</p><div class="jar-shelf">${Array.from(
      { length: shelfEnd - shelfStart },
      (_, n) => {
        const i = shelfStart + n;
        return `<div class="jar-keepsake" style="--jar-color:${jarColors[i % 6]};--fill:100%"><span class="jar-glass"><span class="jar-fill"></span><span class="jar-lid"></span></span><small>${jarNames[i % 6]} · ${i + 1}</small></div>`;
      },
    ).join(
      "",
    )}</div><div class="month-nav"><button id="older-jars" ${shelfStart === 0 ? "disabled" : ""}>Раньше</button><span>${j.index ? `${shelfStart + 1}–${shelfEnd}` : "Пока пусто"}</span><button id="newer-jars" ${jarShelfPage === 0 ? "disabled" : ""}>Новее</button></div><p class="fine">Семечки и очищенные поля считаются с начала коллекции.</p><p>Полностью очищено полей: ${jars(progress).wins}</p><p class="fine">${jars(progress).wins >= 100 ? "Мастер · 100 полей" : jars(progress).wins >= 25 ? "Знаток · 25 полей" : jars(progress).wins >= 5 ? "Уверенный старт · 5 полей" : "Первая отметка мастерства — за 5 очищенных полей"}</p></section>`;
    html += `<label class="year-picker">Год трофеев<select id="trophy-year">${years()
      .map((y) => `<option ${y === trophyYear ? "selected" : ""}>${y}</option>`)
      .join("")}</select></label>`;
    for (const m of months()
      .filter((m) => m.startsWith(trophyYear))
      .reverse()) {
      const t = trophy(m, progress.done);
      html += `<button class="trophy tier-${t.tier}" data-month="${m}"><span class="medal">${emblem(m)}</span><span><strong>${monthName(m)}</strong><small>${["Пока не получен", "Бронза", "Серебро", "Золото"][t.tier]} · ${t.count}/${days(m).length}</small></span></button>`;
    }
  }
  panel.innerHTML = html;
  if (kind === "progress")
    $("progress-trophies").onclick = () => openCollection("trophies");
  $("collection-back").onclick = openMenu;
  $("collection-back").focus({ preventScroll: true });
  panel.querySelectorAll<HTMLElement>("[data-game]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.game!;
        switchGame(id);
      }),
  );
  panel.querySelectorAll<HTMLElement>("[data-month]").forEach(
    (b) =>
      (b.onclick = () => {
        calendarMonth = b.dataset.month!;
        openCollection("calendar");
      }),
  );
  if (kind === "book") {
    if ($("continue-book"))
      $("continue-book").onclick = () =>
        switchGame($("continue-book").dataset.continue!);
    $("book-filter").onchange = () => {
      bookFilter = $<HTMLSelectElement>("book-filter").value;
      openCollection("book");
    };
    $("book-chapter").onchange = () => {
      selectedVolume = Number($<HTMLSelectElement>("book-chapter").value) * 10;
      bookFilter = "all";
      openCollection("book");
    };
    panel.querySelectorAll<HTMLElement>("[data-volume]").forEach(
      (b) =>
        (b.onclick = () => {
          selectedVolume = Number(b.dataset.volume);
          openCollection("book");
        }),
    );
  }
  if (kind === "trophies") {
    $("older-jars").onclick = () => {
      jarShelfPage++;
      openCollection("trophies");
    };
    $("newer-jars").onclick = () => {
      jarShelfPage--;
      openCollection("trophies");
    };
    $("trophy-year").onchange = () => {
      trophyYear = $<HTMLSelectElement>("trophy-year").value;
      openCollection("trophies");
    };
  }
  if (kind === "calendar") {
    $("calendar-year").onchange = () => {
      calendarMonth =
        $<HTMLSelectElement>("calendar-year").value + calendarMonth.slice(4);
      openCollection("calendar");
    };
    $("calendar-month").onchange = () => {
      calendarMonth =
        calendarMonth.slice(0, 4) +
        "-" +
        $<HTMLSelectElement>("calendar-month").value;
      openCollection("calendar");
    };
    for (const [id, delta] of [
      ["prev-month", -1],
      ["next-month", 1],
    ] as const)
      $(id).onclick = () => {
        const d = new Date(
          Number(calendarMonth.slice(0, 4)),
          Number(calendarMonth.slice(5)) - 1 + delta,
          1,
        );
        calendarMonth = today(d).slice(0, 7);
        openCollection("calendar");
      };
    $("today-task").onclick = () => {
      switchGame(daily(today()).id);
    };
  }
  motion(panel, [
    { opacity: 0, transform: "translateY(6px)" },
    { opacity: 1, transform: "translateY(0)" },
  ]);
}
$("classic-mode").onclick = () => switchGame("classic");
$("book-mode").onclick = () => openCollection("book");
$("daily-mode").onclick = () => switchGame(daily(today()).id);
$("calendar-open").onclick = () => {
  calendarMonth = today().slice(0, 7);
  openCollection("calendar");
};
$("progress-open").onclick = () => openCollection("progress");
function updateHome() {
  $("book-count").textContent =
    `${notebook.filter((p) => progress.done.includes(p.id)).length} из ${notebook.length} решено`;
  const id = `daily-v1-${today()}`;
  $("daily-state").textContent = progress.done.includes(id)
    ? "Решено · повторить"
    : progress.sessions[id]?.history.length
      ? "Продолжить"
      : "Начать";
}
let displayedDate = today();
function refreshDate() {
  if (displayedDate === today() || busy) return;
  displayedDate = today();
  updateHome();
  if (dialog.open && dialog.dataset.screen === "calendar") {
    const focused = document.activeElement as HTMLElement | null;
    const game = focused?.dataset.game,
      id = focused?.id;
    const scroll = dialog.scrollTop;
    openCollection("calendar");
    const target = game
      ? dialog.querySelector<HTMLElement>(`[data-game="${game}"]`)
      : id
        ? document.getElementById(id)
        : null;
    if (target && !(target as HTMLButtonElement).disabled)
      target.focus({ preventScroll: true });
    dialog.scrollTop = scroll;
  }
  if (!occupied(board())) renderWin();
}
setInterval(refreshDate, 1000);
window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", refreshDate);
$("trophies-mode").onclick = () => openCollection("trophies");
void boot();

function renderJar() {
  const meter = $("jar-meter");
  meter.hidden = lesson >= 0 || progress.active !== "classic";
  (document.querySelector("header .brand") as HTMLElement).hidden =
    !meter.hidden;
  if (meter.hidden) return;
  visualSeeds ??= jars(progress).seeds;
  const j = jarState(visualSeeds);
  const celebrating = completedJar && performance.now() < completedJar.until;
  if (celebrating) {
    j.index = completedJar!.index;
    j.percent = 100;
    j.name = jarNames[j.index % 6];
    j.color = jarColors[j.index % 6];
  }
  meter.style.setProperty("--jar-color", j.color);
  meter.style.setProperty("--fill", `${j.percent}%`);
  $("jar-name").textContent = `${j.name} · ${j.index + 1}`;
  $("jar-percent").textContent = celebrating
    ? "100% · собрана ✓"
    : `${j.percent}% · ${j.filled}/${j.capacity}`;
  meter.setAttribute(
    "aria-label",
    `Баночка ${j.index + 1}, заполнено ${j.percent} процентов. Открыть коллекцию`,
  );
}
$("jar-meter").onclick = () => openCollection("trophies");

function years() {
  return Array.from(
    { length: Math.max(0, Number(today().slice(0, 4)) - 2025 + 1) },
    (_, i) => String(2025 + i),
  );
}
function calendarControls() {
  return `<div class="archive-controls"><label>Год<select id="calendar-year">${years()
    .map(
      (y) =>
        `<option ${calendarMonth.startsWith(y) ? "selected" : ""}>${y}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Месяц<select id="calendar-month">${Array.from(
    { length: 12 },
    (_, i) => String(i + 1).padStart(2, "0"),
  )
    .filter((m) => calendarMonth.slice(0, 4) + "-" + m <= today().slice(0, 7))
    .map(
      (m) =>
        `<option value="${m}" ${calendarMonth.slice(5) === m ? "selected" : ""}>${monthName("2025-" + m).split(" ")[0]}</option>`,
    )
    .join("")}</select></label></div>`;
}
