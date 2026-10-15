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
import * as platform from "./platform";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const KEY = "seeds-bits.session.v1",
  SETTINGS = "seeds-bits.settings.v1";
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
  `<main class="game"><header><button id="menu" class="plain" aria-label="Открыть меню"><span class="menu-lines"></span></button><div class="brand">семечки<span>ИГРА С ЧИСЛАМИ</span></div><button id="theme" class="plain" aria-label="Переключить тему">◐</button></header><section class="game-meta"><span id="mode">Классическая партия</span><span><strong id="remaining">28</strong> цифр</span></section><section id="lesson" hidden><div class="lesson-top"><span id="lesson-step"></span><button id="skip" class="text-button">Пропустить</button></div><h1 id="lesson-title"></h1><p id="lesson-text"></p><button id="lesson-next" class="primary" hidden>Дальше</button></section><div id="viewport" tabindex="0" aria-label="Игровое поле с вертикальной прокруткой"><div id="board-wrap"><div id="board" role="group" aria-label="Цифры игрового поля"></div><svg id="paths" aria-hidden="true"></svg></div><div id="win" hidden><span class="win-symbol">✳</span><h1>Чистое поле.</h1><p>Все пары найдены. Хорошая работа.</p><button id="play-again" class="primary">Ещё партия</button></div></div><div class="status-wrap"><p id="status" role="status" aria-live="polite"></p><button id="retry-save" class="text-button" hidden>Повторить сохранение</button></div><footer><button id="undo" class="action">${icon("undo")}<span>Отмена</span></button><button id="hint" class="action">${icon("hint")}<span>Подсказка</span></button><button id="add" class="action">${icon("add")}<span id="add-label">Добавить</span></button></footer></main><dialog id="dialog"><div class="dialog-head"><h2>Семечки</h2><button id="close" class="plain" aria-label="Закрыть меню">×</button></div><div id="menu-content"><button id="resume" class="primary">Продолжить игру</button><button id="new" class="secondary">Новая игра</button><button id="learn" class="secondary">Как играть</button><div class="settings"><label>Тёмная тема<input id="dark" type="checkbox"></label><label>Звук<input id="sound" type="checkbox"></label><label>Вибрация<input id="vibration" type="checkbox"></label></div><p class="fine">Без спешки. Без ограничения ходов.<br>Прототип · правила 0.1</p></div><div id="confirm-content" hidden><p>Начать новую партию? Текущее поле и история отмены будут заменены.</p><button id="confirm-new" class="primary">Начать заново</button><button id="cancel-new" class="secondary">Оставить текущую</button></div></dialog>`;
const dialog = $<HTMLDialogElement>("dialog"),
  viewport = $("viewport");
$("app").inert = true;
function board() {
  return lesson >= 0 ? lessonBoard : session.current.board;
}
function message(text: string) {
  $("status").textContent = text;
}
function save() {
  if (lesson < 0) session.current.scroll = viewport.scrollTop;
  const data = JSON.stringify(session),
    prefs = JSON.stringify(settings);
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      try {
        await platform.write(KEY, data);
        await platform.write(SETTINGS, prefs);
        saveFailed = false;
        $("retry-save").hidden = true;
      } catch {
        saveFailed = true;
        $("retry-save").hidden = false;
        message(
          "Не удалось сохранить партию. Не закрывайте игру — повторите сохранение.",
        );
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
      settings.theme === "dark" ? "#171e25" : "#f6f7f4",
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
      osc.frequency.setValueAtTime(660, audio.currentTime);
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
  const svg = $("paths");
  svg.innerHTML = "";
  if (!path) return;
  const w = $("board").clientWidth / WIDTH;
  const point = (i: number) => [
    (i % WIDTH) * w + w / 2,
    Math.floor(i / WIDTH) * w + w / 2,
  ];
  const a = point(path.a),
    b = point(path.b);
  let d = `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
  if (path.kind === "reading") {
    const [lo, hi] = [Math.min(path.a, path.b), Math.max(path.a, path.b)],
      p = point(lo),
      q = point(hi);
    d = `M${p[0]},${p[1]} H${w * WIDTH - 2} M2,${q[1]} H${q[0]}`;
  }
  svg.innerHTML = `<path d="${d}"/><circle cx="${a[0]}" cy="${a[1]}" r="3"/><circle cx="${b[0]}" cy="${b[1]}" r="3"/>`;
}
function render() {
  const values = board(),
    count = occupied(values),
    available = pairs(values);
  $("remaining").textContent = String(count);
  $("mode").textContent =
    lesson >= 0 ? "Знакомство с игрой" : "Классическая партия";
  $("board").innerHTML = Array.from(
    { length: Math.ceil(values.length / WIDTH) * WIDTH },
    (_, i) =>
      values[i]
        ? `<button class="cell${i === selected ? " selected" : ""}${highlight && (i === highlight.a || i === highlight.b) ? " hinted" : ""}" data-index="${i}" aria-label="${values[i]}, строка ${Math.floor(i / WIDTH) + 1}, столбец ${(i % WIDTH) + 1}" aria-pressed="${i === selected}">${values[i]}</button>`
        : `<span class="cell empty" data-index="${i}" aria-hidden="true"></span>`,
  ).join("");
  $("win").hidden = count > 0 || lesson >= 0;
  $("board-wrap").hidden = count === 0;
  $<HTMLButtonElement>("undo").disabled =
    busy ||
    (lesson >= 0
      ? !(lesson === 5 && lessonPhase === 1)
      : !session.history.length);
  $<HTMLButtonElement>("hint").disabled =
    busy || lesson >= 0 || !available.length;
  $("add").setAttribute(
    "aria-disabled",
    String(
      busy || !count || available.length > 0 || (lesson >= 0 && lesson !== 5),
    ),
  );
  $("add-label").textContent =
    available.length || !count ? "Добавить" : `Добавить ${count}`;
  if (lesson < 0 && !saveFailed)
    message(
      count === 0
        ? "Партия завершена"
        : available.length
          ? "Одинаковые цифры или сумма 10"
          : "Пар нет. Добавьте оставшиеся цифры.",
    );
  drawPath(highlight);
}
function clearSelection() {
  selected = -1;
  highlight = null;
}
function startLesson() {
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
  $("lesson-step").textContent = `${lesson + 1} / ${lessons.length}`;
  $("lesson-title").textContent = lessons[lesson].title;
  $("lesson-text").textContent = lessons[lesson].text;
  $("lesson-next").hidden = true;
  viewport.scrollTop = 0;
  render();
  message("Попробуйте на маленьком поле");
}
function finishLesson() {
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
    highlight = null;
    render();
    return;
  }
  const a = selected,
    result = checkPair(values, a, i);
  if (!result.ok) {
    selected = i;
    highlight = null;
    render();
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
  await new Promise((r) => setTimeout(r, 160));
  const oldLength = values.length,
    next = removePair(values, a, i);
  if (lesson >= 0) {
    lessonBoard = next;
    lessonPhase = 2;
    $("lesson-next").hidden = false;
    $("lesson-next").textContent = lesson === 5 ? "Начать игру" : "Дальше";
  } else {
    session = commit(session, next, "pair", viewport.scrollTop);
    hintIndex = 0;
    save();
  }
  clearSelection();
  render();
  if (next.length < oldLength) {
    $("board").classList.add("settling");
    await new Promise((r) => setTimeout(r, 150));
    $("board").classList.remove("settling");
  }
  busy = false;
  render();
  if (lesson >= 0) message("Получилось!");
  if (!occupied(board()) && lesson < 0) platform.gameplay(false);
}
function add() {
  if (busy || paused) return;
  const values = board();
  if (lesson >= 0 && lesson !== 5) return;
  if (!occupied(values)) return;
  if (pairs(values).length) {
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
    viewport.scrollTop = viewport.scrollHeight;
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
  session = undo(session);
  clearSelection();
  render();
  viewport.scrollTop = session.current.scroll;
  save();
  platform.gameplay(occupied(board()) > 0);
}
function hint() {
  if (busy || paused || lesson >= 0) return;
  const available = pairs(board());
  if (!available.length) return;
  highlight = available[hintIndex++ % available.length];
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
  message(
    highlight.kind === "reading"
      ? "Допустимая пара: конец строки → начало следующей"
      : "Допустимая пара — соедините выделенные цифры",
  );
}
function closeMenu() {
  dialog.close();
  platform.gameplay(!paused && occupied(board()) > 0);
}
function openMenu() {
  if (busy) return;
  $("menu-content").hidden = false;
  $("confirm-content").hidden = true;
  dialog.showModal();
  platform.gameplay(false);
}
function reset() {
  session = newSession();
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
$("theme").onclick = () => setTheme(settings.theme !== "dark");
$("new").onclick = () => {
  $("menu-content").hidden = true;
  $("confirm-content").hidden = false;
};
$("cancel-new").onclick = () => {
  $("menu-content").hidden = false;
  $("confirm-content").hidden = true;
};
$("confirm-new").onclick = reset;
$("play-again").onclick = reset;
$("learn").onclick = startLesson;
$("skip").onclick = finishLesson;
$("lesson-next").onclick = () => {
  if (lesson === 5) finishLesson();
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
dialog.addEventListener("cancel", () => platform.gameplay(!paused));
let scrollTimer: ReturnType<typeof setTimeout>;
viewport.addEventListener("scroll", () => {
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
    const stored = await platform.read(KEY);
    if (stored) session = decode(stored);
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
  if (!settings.tutorialDone) startLesson();
  platform.ready();
  platform.gameplay(true);
  if (warning) message(warning);
}
void boot();
