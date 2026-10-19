import { BoardView } from "./board-view";
import { createSolver } from "./solver";
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
  daily,
  today,
  days,
  trophy,
  FIRST_MONTH,
  puzzleSession,
  availableDay,
  type Puzzle,
} from "./puzzles";
import { fresh, readProgress, type Progress } from "./progress";
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
  saveFailed = false;
let settings = {
  theme: "light",
  sound: false,
  vibration: false,
  tutorialDone: false,
};
let lastStored: string | null = null,
  storageConflict = false;
const solve = createSolver();
let saveQueue = Promise.resolve(),
  hintIndex = 0,
  lesson = -1,
  lessonBoard: number[] = [],
  lessonPhase = 0;
let audio: AudioContext | undefined;
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
  `<main class="game"><header><button id="menu" class="plain" aria-label="Открыть меню"><span class="menu-lines"></span></button><div class="brand">семечки</div><button id="book-top" class="plain" aria-label="Открыть тетрадь">▦</button></header><section class="game-meta"><span id="mode">Классическая партия</span><span><strong id="remaining">28</strong> <span id="noun">цифр</span></span></section><div id="page-progress" hidden></div><section id="lesson" hidden><div class="lesson-top"><span id="lesson-step"></span><button id="skip" class="text-button">Пропустить</button></div><h1 id="lesson-title"></h1><p id="lesson-text"></p><button id="lesson-next" class="primary" hidden>Дальше</button></section><div id="viewport" tabindex="0" aria-label="Игровое поле с вертикальной прокруткой"><div id="board-wrap"><div id="board" role="group" aria-label="Цифры игрового поля"></div><svg id="paths" aria-hidden="true"></svg></div><div id="win" hidden><span class="win-symbol">✓</span><h1>Все пары найдены</h1><details class="result-details"><summary>Итоги партии</summary><p id="win-stats"></p></details><div id="award" hidden></div><button id="play-again" class="primary">Ещё партия</button></div></div><div class="status-wrap"><button id="hint-jump" class="text-button" hidden></button><p id="status" role="status" aria-live="polite"></p><button id="recover-task" class="text-button" hidden></button><button id="restart-task" class="text-button" hidden>Начать задачу заново</button><button id="retry-save" class="text-button" hidden>Повторить сохранение</button></div><footer><button id="undo" class="action">${icon("undo")}<span>Отмена</span></button><button id="hint" class="action">${icon("hint")}<span>Подсказка</span></button><button id="add" class="action">${icon("add")}<span id="add-label">Добавить</span></button></footer></main><dialog id="dialog" aria-label="Меню Семечек"><div class="dialog-head"><h2>Семечки</h2><button id="close" class="plain" aria-label="Закрыть меню">×</button></div><div id="menu-content"><div class="home-title"><svg class="seed-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="M29 40C8 40 8 20 24 5c12 16 16 30 5 35Z"/><path d="M35 39c-3-15 5-25 24-26-1 20-9 30-24 26Z"/><path class="seed-line" d="m24 15 4 20m24-15-12 14"/></svg><h1>семечки</h1></div><button id="resume" class="primary">Продолжить игру</button><p id="resume-context"></p><nav class="mode-nav"><button id="classic-mode" class="mode-link"><span>Классика<small>Очистите поле от цифр</small></span><span aria-hidden="true">↗</span></button><button id="book-mode" class="mode-link"><span>Тетрадь<small>24 небольшие задачи</small></span><span aria-hidden="true">↗</span></button><button id="daily-mode" class="mode-link"><span>Задача дня<small>Календарь задач</small></span><span aria-hidden="true">↗</span></button></nav><div class="home-links"><button id="trophies-mode" class="text-button">Коллекция</button><button id="learn" class="text-button">Как играть</button><button id="settings-open" class="text-button">Настройки</button></div></div><section id="settings-panel" hidden><button id="settings-back" class="text-button">← Меню</button><h2>Настройки</h2><div class="settings"><label>Тёмная тема<input id="dark" type="checkbox"></label><label>Звук<input id="sound" type="checkbox"></label><label>Вибрация<input id="vibration" type="checkbox"></label></div><button id="new" class="secondary">Начать текущую партию заново</button><p class="intro">Прогресс сохраняется автоматически.</p></section><div id="confirm-content" hidden><p>Начать новую партию? Текущее поле и история отмены будут заменены.</p><button id="confirm-new" class="primary">Начать заново</button><button id="cancel-new" class="secondary">Оставить текущую</button></div><section id="collection" hidden></section></dialog>`;
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
document.querySelector(".game")!.prepend(notice);
$("load-latest").onclick = () => location.reload();
function showSaveState() {
  const parent = dialog.open ? dialog : document.querySelector(".game")!;
  if (notice.parentElement !== parent) parent.prepend(notice);
  notice.hidden = !saveFailed;
  $("save-warning").textContent = storageConflict
    ? "В другой вкладке есть более новое сохранение. Оно защищено от перезаписи."
    : "Не удалось сохранить партию. Не закрывайте игру — повторите сохранение.";
  $("load-latest").hidden = !storageConflict;
  $("retry-save").hidden = !saveFailed || storageConflict;
}
function save() {
  if (storageConflict) return;
  if (lesson < 0) session.current.scroll = viewport.scrollTop;
  progress.sessions[progress.active] = session;
  const bundle = JSON.stringify(progress),
    prefs = JSON.stringify(settings);
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (storageConflict) return;
      try {
        await platform.saveState(PROGRESS, bundle, lastStored, SETTINGS, prefs);
        lastStored = bundle;
        const recovered = saveFailed;
        saveFailed = false;
        showSaveState();
        if (recovered) message("Партия сохранена");
      } catch (error) {
        storageConflict = error instanceof platform.SaveConflict;
        saveFailed = true;
        showSaveState();
        message($("save-warning").textContent!);
      }
    });
}
function applyTheme() {
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
  applyTheme();
  save();
}
function feedback() {
  if (settings.vibration) void platform.haptic().catch(() => {});
  if (settings.sound) {
    try {
      audio ??= new AudioContext();
      void audio.resume();
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(220 + Math.random() * 35, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audio.currentTime + 0.08);
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
      osc.start();
      osc.stop(audio.currentTime + 0.12);
    } catch {
      /* Audio is optional. */
    }
  }
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
  return $("board").querySelector<HTMLElement>(`[data-index="${i}"]`);
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
function complete() {
  if (progress.active === "classic" || progress.done.includes(progress.active))
    return;
  progress.done.push(progress.active);
  save();
}
function renderWin() {
  const id = progress.active;
  $("win-stats").textContent =
    `Пар убрано: ${session.current.moves} · Добавлений: ${session.current.additions} · Подсказок: ${progress.hints[id] ?? 0}`;
  const i = notebook.findIndex((p) => p.id === id);
  $("play-again").textContent =
    i >= 0 && i < 23
      ? "Следующая задача"
      : i === 23
        ? "К тетради"
        : id.startsWith("daily")
          ? "К календарю"
          : "Ещё партия";
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
        : `Страница ${page + 1} · ${n} из 6`;
  }
  if (id.startsWith("daily")) {
    const m = id.slice(9, 16),
      t = trophy(m, progress.done);
    award.hidden = false;
    award.textContent = `${t.count} из ${days(m).length} дней · ${["Первый трофей — за 7 задач", "Бронзовый трофей", "Серебряный трофей", "Золотой трофей"][t.tier]}`;
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
  const taskIndex = notebook.findIndex((p) => p.id === progress.active);
  const marks = $("page-progress");
  marks.hidden = lesson >= 0 || taskIndex < 0;
  if (taskIndex >= 0) {
    const pageIndex = Math.floor(taskIndex / 6);
    marks.innerHTML = `<span>Страница ${pageIndex + 1}</span><div>${notebook
      .slice(pageIndex * 6, pageIndex * 6 + 6)
      .map(
        (p) =>
          `<i class="${progress.done.includes(p.id) ? "finished" : p.id === progress.active ? "current" : ""}">${progress.done.includes(p.id) ? "✓" : ""}</i>`,
      )
      .join("")}</div>`;
    marks.setAttribute(
      "aria-label",
      `Страница ${pageIndex + 1}, задача ${(taskIndex % 6) + 1} из 6`,
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
          ? `Тетрадь · задача ${notebook.findIndex((p) => p.id === progress.active) + 1}`
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
      count === 0
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
function clearSelection() {
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
  $("lesson").hidden = true;
  clearSelection();
  render();
  viewport.scrollTop = session.current.scroll;
  save();
  platform.gameplay(true);
}
async function choose(i: number) {
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
  for (const old of positions.values()) {
    const node = cell(old);
    if (node) oldRects.set(node, node.getBoundingClientRect());
  }
  const previousHeight = $("board").getBoundingClientRect().height;
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
    for (const [node, rect] of oldRects) {
      if (!node.isConnected) continue;
      const dy = rect.top - node.getBoundingClientRect().top;
      if (Math.abs(dy) > 1)
        motion(node, [{ translate: `0 ${dy}px` }, { translate: "0 0" }], 170);
    }
    const height = $("board").getBoundingClientRect().height;
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
function hint() {
  if (busy || paused || lesson >= 0) return;
  const available = availablePairs(board());
  if (progress.active !== "classic") {
    const advice = solve(board());
    if (advice.kind === "dead") {
      let recovery = -1;
      for (let i = session.history.length - 1; i >= 0; i--) {
        if (solve(session.history[i].board).kind === "move") {
          recovery = i;
          break;
        }
      }
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
          "Из этой позиции решения нет. Можно вернуться к решаемому полю.",
        );
      } else message("Из этой позиции решения нет. Начните задачу заново.");
      return;
    }
    if (advice.kind !== "move") {
      message(
        "Не удалось быстро найти надёжный ход. Попробуйте отменить последний.",
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
$("play-again").onclick = () => {
  const i = notebook.findIndex((p) => p.id === progress.active);
  if (i >= 0 && i < 23) switchGame(notebook[i + 1].id);
  else if (i === 23) openCollection("book");
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
  platform.gameplay(!paused && !dialog.open && occupied(board()) > 0);
  if (paused) {
    save();
    void audio?.suspend();
  }
});
window.addEventListener("pagehide", save);
async function boot() {
  let warning = "";
  try {
    const bundle = await platform.read(PROGRESS);
    lastStored = bundle;
    if (bundle) {
      progress = readProgress(bundle, () => {
        warning =
          "Повреждённую партию не удалось восстановить. Остальной прогресс сохранён.";
      });
      session = progress.sessions[progress.active];
    } else {
      const stored = await platform.read(KEY);
      if (stored) session = decode(stored);
      progress.sessions.classic = session;
    }
  } catch {
    warning = "Сохранение не удалось прочитать. Открыта новая партия.";
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
  applyTheme();
  $<HTMLInputElement>("sound").checked = settings.sound;
  $<HTMLInputElement>("vibration").checked = settings.vibration;
  render();
  viewport.scrollTop = session.current.scroll;
  try {
    await platform.initPlatform(
      () => {
        paused = true;
        platform.gameplay(false);
        void audio?.suspend();
        save();
      },
      () => {
        paused = false;
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
      platform.gameplay(active && !dialog.open && occupied(board()) > 0);
      if (!active) {
        save();
        void audio?.suspend();
      }
    })
    .catch(() => {});
  void platform.listenBack(() => navigateBack(true)).catch(() => {});
  if (!settings.tutorialDone) startLesson(true);
  else openMenu();
  platform.ready();
  platform.gameplay(!dialog.open);
  if (warning) message(warning);
}
function teach(id: string, text: string) {
  if (progress.seen.includes(id)) return;
  progress.seen.push(id);
  message(text);
  save();
}
function switchGame(id: string) {
  if (busy) return;
  if (id.startsWith("daily") && !availableDay(id.slice(9))) return;
  if (lesson < 0) session.current.scroll = viewport.scrollTop;
  progress.sessions[progress.active] = session;
  progress.active = id;
  const p = activePuzzle();
  session = progress.sessions[id] ?? (p ? puzzleSession(p) : newSession());
  if (p && !occupied(session.current.board)) {
    session = puzzleSession(p);
    progress.hints[id] = 0;
  }
  lesson = -1;
  $("lesson").hidden = true;
  clearSelection();
  closeMenu();
  render();
  viewport.scrollTop = session.current.scroll;
  save();
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
function openCollection(kind: "book" | "calendar" | "trophies") {
  if (busy) return;
  openMenu();
  dialog.dataset.screen = kind;
  $("menu-content").hidden = true;
  const panel = $("collection");
  panel.hidden = false;
  let html = '<button class="text-button" id="collection-back">← Меню</button>';
  if (kind === "book") {
    html += '<h2>Тетрадь</h2><p class="intro">24 небольшие задачи.</p>';
    for (let p = 0; p < 4; p++) {
      const group = notebook.slice(p * 6, p * 6 + 6),
        n = group.filter((x) => progress.done.includes(x.id)).length;
      html += `<section class="book-page ${n === 6 ? "page-done" : group.some((x) => x.id === progress.active) ? "page-current" : ""}"><div class="page-heading"><h3>Страница ${p + 1}</h3><span>${n}/6</span></div><div class="task-grid">${group.map((x) => `<button class="task ${progress.done.includes(x.id) ? "done" : ""}" data-game="${x.id}" ${x.id === progress.active ? 'aria-current="true"' : ""} aria-label="Задача ${notebook.indexOf(x) + 1}${progress.done.includes(x.id) ? ", решена" : ""}">${notebook.indexOf(x) + 1}${progress.done.includes(x.id) ? "<small>✓</small>" : ""}</button>`).join("")}</div>${n === 6 ? '<p class="stamp">Завершено ✓</p>' : ""}</section>`;
    }
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
    html += `<h2>Задача дня</h2><div class="month-nav"><button id="prev-month" aria-label="Предыдущий месяц" ${calendarMonth <= FIRST_MONTH ? "disabled" : ""}>‹</button><h3>${monthName(calendarMonth)}</h3><button id="next-month" aria-label="Следующий месяц" ${calendarMonth >= today().slice(0, 7) ? "disabled" : ""}>›</button></div><div class="calendar">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((x) => `<span>${x}</span>`).join("")}${"<i></i>".repeat(weekday)}${days(
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
    for (const m of months().reverse()) {
      const t = trophy(m, progress.done);
      html += `<button class="trophy tier-${t.tier}" data-month="${m}"><span class="medal">${emblem(m)}</span><span><strong>${monthName(m)}</strong><small>${["Пока не получен", "Бронза", "Серебро", "Золото"][t.tier]} · ${t.count}/${days(m).length}</small></span></button>`;
    }
  }
  panel.innerHTML = html;
  $("collection-back").onclick = openMenu;
  $("collection-back").focus({ preventScroll: true });
  panel.querySelectorAll<HTMLElement>("[data-game]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.game!;
        switchGame(id);
        if (!occupied(session.current.board)) reset();
      }),
  );
  panel.querySelectorAll<HTMLElement>("[data-month]").forEach(
    (b) =>
      (b.onclick = () => {
        calendarMonth = b.dataset.month!;
        openCollection("calendar");
      }),
  );
  if (kind === "calendar") {
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
      if (!occupied(session.current.board)) reset();
    };
  }
  motion(panel, [
    { opacity: 0, transform: "translateY(6px)" },
    { opacity: 1, transform: "translateY(0)" },
  ]);
}
$("classic-mode").onclick = () => switchGame("classic");
$("book-mode").onclick = () => openCollection("book");
$("daily-mode").onclick = () => {
  calendarMonth = today().slice(0, 7);
  openCollection("calendar");
};
$("trophies-mode").onclick = () => openCollection("trophies");
void boot();
