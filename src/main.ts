import {captureHelpFrame,presentHelpChange,presentHelpStep,clearHelpEffects,helpEffectEpoch} from "./help-presentation";
import {installHelpLab,closeHelpLab} from "./help-lab-ui";
import {requestHelp} from "./help-client";
import {helpIntent, applyMagnet, storedHelp, provenMagnet, nextMagnetApplication, applyPlan, planPosition, planBoards} from "./help-actions";
import {removePair as proofRemovePair} from "./core";
import {helpFlags, helpPaused, qaProfile, assignHelp} from "./help-config";
import {receiptProduct, sameBoard, freezeIntent, type HelpIntent, type HelpProduct} from "./help-contract";
import { dailyRun, streakReward } from "./daily-run";
import { hintExplanation } from "./hint-explanation";
import { readClassicDeals, restartClassic } from "./classic-deals";
import {
  CLASSIC_DEFAULT,
  CLASSIC_MIN,
  CLASSIC_MAX,
  classicDifficultyNames,
  newClassicRun,
  readClassicRun,
  takeGeneratedClassic,
  type ClassicDifficulty,
} from "./classic-generator";
import {
  enqueueAnalytics,
  acknowledgeAnalytics,
  CommittedAnalytics,
} from "./analytics";
import {
  engagementBridge,
  experience,
  reviewEligible,
  requestNotificationPermission,
} from "./engagement";
import {
  initializeMonetization,
  monetized,
  adActive,
  showAd,
  syncBanner,
  track,
  bridge as adsBridge,
  type RewardReceipt,
  rewardedReadiness,
  refreshRewarded,
} from "./monetization";
import {
  hintAttempt,
  hintKey,
  hintsLeft,
  spendHint,
  grantReward,
} from "./hint-budget";
import { jars, collectPair, jarState, jarNames, jarColors } from "./jars";
import { volumeOf, volumeTasks, chapterNames } from "./notebooks";
import { playSound, suspendSound, blockSound } from "./sound";
import { SeedFlight } from "./seed-flight";
import { JarSpill } from "./jar-spill";
import { icon } from "./icons";
import { installInterfaceMotion } from "./ui-motion";
import type { HapticCue } from "./haptics";
import {
  createValueTransferPlan,
  valueAfterVisualArrival,
} from "./vendor/mini-games-kit/value-transfer";
import { BoardView } from "./board-view";
import { requestAdvice } from "./advice-client";
import { trophyMark, celebrateTrophy } from "./trophies";
import "./style.css";
import "./ui-polish.css";
import "./ui-adaptation.css";
import {
  resultKind,
  resultArtwork,
  celebrateResult,
} from "./result-presentation";
import {
  WIDTH,
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
  helpProfile,
  cloneProgress,
  readProgress,
  serializeProgress,
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
  vibration: true,
  tutorialDone: false,
  reminders: true,
  reminderTime: "12:30",
};
let lastStored: string | null = null,
  storageConflict = false,
  futureSave = false,
  switching = false,
  recoveryAvailable = false;
let hintGeneration = 0;
let hintPending = false;
let helpSearchStop = () => {};
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
let bootComplete = false,
  reviewPreparing = false;
let engagementAvailable = false,
  engagementActive = false,
  notificationGranted = false,
  notificationRequestPending = false,
  notificationSaving = false,
  pendingDailyOpen = false,
  skipNextInterstitial = false;
let lastExternalAt = -Infinity,
  lastInputAt = 0,
  activeTick = performance.now(),
  activeSinceSave = 0;
let visualSeeds: number | undefined;
let completedJar:
  { index: number; capacity: number; until: number } | undefined;
let clearContact = () => {};
let clearTrophyCelebration = () => {};
let clearResultCelebration = () => {};
let resultArtKey = "";
let fullJarTimer: ReturnType<typeof setTimeout> | undefined;
let boardRevealTimer: ReturnType<typeof setTimeout> | undefined;
let boardRevealCancel: (() => void) | undefined;
let pendingResult:
  { session: Session; rects: DOMRect[]; saved: boolean } | undefined;
const removedPairs = new WeakMap<number[], readonly [number, number]>();
const flights = new SeedFlight();
const jarSpill = new JarSpill();
let presentationRevision = 0;
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
$("app").innerHTML =
  `<main class="game"><header><button id="menu" class="plain" aria-label="Открыть меню">${icon("menu")}</button><div class="brand">семечки</div><button id="book-top" class="plain" aria-label="Открыть тетрадь">${icon("book")}</button></header><button id="jar-meter" class="jar-meter" hidden aria-label="Коллекция баночек"><span id="jar-glass" class="jar-glass"><span class="jar-fill"></span><span class="jar-lid"></span></span><span class="jar-caption"><strong id="jar-name"></strong><span class="jar-level"><span id="jar-percent"></span><span id="jar-collected" aria-hidden="true">${icon("check")}</span></span></span></button><section class="game-meta"><span id="mode">Классическая партия</span><span><strong id="remaining">28</strong> <span id="noun">цифр</span></span></section><div id="page-progress" hidden></div><section id="lesson" hidden><div class="lesson-top"><span id="lesson-step"></span><button id="skip" class="text-button">Пропустить</button></div><h1 id="lesson-title"></h1><p id="lesson-text"></p><button id="lesson-next" class="primary" hidden>Дальше</button></section><div id="viewport" tabindex="0" aria-label="Игровое поле с вертикальной прокруткой"><div id="board-wrap"><div id="board" role="group" aria-label="Цифры игрового поля"></div><svg id="paths" aria-hidden="true"></svg></div><div id="win" hidden><span class="win-symbol" aria-hidden="true">${icon("check")}</span><h1>Все пары найдены</h1><section class="result-details" aria-label="Итоги партии"><p id="win-stats"></p></section><div id="award" hidden></div><p id="completion-status"></p><p id="result-gains" role="status"></p><button id="result-reminder" class="text-button" hidden>Напоминать о задаче дня</button><button id="try-notebook" class="secondary" hidden>Короткая задача</button><button id="play-again" class="primary">Ещё партия</button></div></div><div class="status-wrap"><button id="hint-jump" class="text-button" hidden></button><p id="status" role="status" aria-live="polite"></p><button id="recover-task" class="text-button" hidden></button><button id="restart-task" class="text-button" hidden>Начать задачу заново</button><button id="retry-save" class="text-button" hidden>Повторить сохранение</button></div><footer><button id="undo" class="action">${icon("undo")}<span>Отмена</span></button><button id="hint" class="action">${icon("hint")}<span id="hint-label"><span class="action-label">Подсказка</span><span id="hint-count" class="action-count" aria-hidden="true"></span></span></button><button id="add" class="action">${icon("add")}<span id="add-label"><span class="action-label">Добавить</span><span id="add-count" class="action-count" aria-hidden="true"></span></span></button></footer></main><dialog id="dialog" aria-label="Меню Семечек"><div class="dialog-head"><h2>Семечки</h2><button id="close" class="plain" aria-label="Закрыть меню">${icon("close")}</button></div><div id="menu-content"><div class="home-title"><svg class="seed-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="M29 40C8 40 8 20 24 5c12 16 16 30 5 35Z"/><path d="M35 39c-3-15 5-25 24-26-1 20-9 30-24 26Z"/><path class="seed-line" d="m24 15 4 20m24-15-12 14"/></svg><h1>семечки</h1></div><button id="resume" class="primary">Продолжить игру</button><p id="resume-context"></p><nav class="mode-nav"><button id="classic-mode" class="mode-link"><span>Классика<small>Очистите поле от цифр</small></span><span aria-hidden="true">${icon("arrow")}</span></button><button id="book-mode" class="mode-link"><span>Тетради<small><span id="book-count">24 небольшие задачи</span></small></span><span aria-hidden="true">${icon("arrow")}</span></button><button id="daily-mode" class="mode-link"><span>Задача дня<small><span id="daily-state">Начать</span></small><small id="daily-series" hidden></small></span><span aria-hidden="true">${icon("arrow")}</span></button></nav><button id="calendar-open" class="archive-link">Другие дни ${icon("arrow")}</button><div class="home-links"><button id="progress-open" class="text-button">Прогресс</button><button id="learn" class="text-button">Как играть</button><button id="settings-open" class="text-button">Настройки</button></div></div><section id="settings-panel" hidden><div class="screen-heading"><button id="settings-back" class="text-button" aria-label="Назад">${icon("back")}</button><h2>Настройки</h2></div><div class="settings"><label>Тёмная тема<input id="dark" type="checkbox"></label><label>Звук<input id="sound" type="checkbox"></label><label>Вибрация<input id="vibration" type="checkbox"></label></div><section id="reminder-settings" hidden><label class="reminder-toggle">Напоминать о задаче дня<input id="reminders" type="checkbox"></label><label class="reminder-time">Напоминать около<input id="reminder-time" type="time" value="12:30"></label><p id="reminder-permission" class="fine" role="status"></p><button id="notification-permission-request" class="text-button" hidden>Разрешить уведомления</button><button id="notification-system-settings" class="text-button" hidden>Настройки уведомлений Android</button><p class="fine">По местному времени, если задача ещё не решена.</p></section><p id="hint-wallet" class="fine"></p><button id="new" class="secondary restart-action">Начать текущую партию заново</button><p class="intro">Прогресс сохраняется автоматически.</p><button id="privacy-open" class="text-button">Конфиденциальность</button></section><div id="confirm-content" hidden><p>Начать новую партию? Текущее поле и история отмены будут заменены.</p><button id="confirm-new" class="primary">Начать заново</button><button id="cancel-new" class="secondary">Оставить текущую</button></div><section id="collection" hidden></section></dialog>`;
// Keep the primary result action ahead of the optional reminder.
$("play-again").after($("result-reminder"));
const resultNext = document.createElement("div");
resultNext.id = "result-next";
resultNext.className = "result-next";
resultNext.setAttribute("role", "group");
resultNext.setAttribute("aria-label", "Следующая партия");
$("play-again").before(resultNext);
resultNext.innerHTML =
  '<button id="classic-easier" class="difficulty-easier" hidden>Легче</button><button id="classic-harder" class="difficulty-harder" hidden>Сложнее</button>';
$("classic-harder").before($("play-again"));
const difficultyCaption = document.createElement("p");
difficultyCaption.id = "classic-difficulty";
difficultyCaption.hidden = true;
resultNext.before(difficultyCaption);
const resultDock = document.createElement("section");
resultDock.id = "result-actions";
resultDock.hidden = true;
resultDock.setAttribute("aria-label", "Продолжение игры");
resultDock.append(
  difficultyCaption,
  resultNext,
  $("try-notebook"),
  $("result-reminder"),
);
document.querySelector(".game")!.append(resultDock);
const gameDifficulty = document.createElement("small");
gameDifficulty.id = "game-difficulty";
const modeDescription = document.createElement("span");
modeDescription.className = "mode-description";
$("mode").before(modeDescription);
modeDescription.append($("mode"), gameDifficulty);
const resultTitle = document.querySelector<HTMLElement>("#win h1")!;
const resultSubtitle = document.createElement("p");
resultSubtitle.id = "result-subtitle";
resultTitle.after(resultSubtitle);
const choiceFits = new WeakMap<HTMLElement, { base: string; fitted: string }>();
const choiceObserver = new ResizeObserver(() => scheduleActionLayout());
function prepareResultLabels() {
  for (const button of resultNext.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    if (button.firstElementChild) continue;
    const label = document.createElement("span");
    label.className = "choice-label";
    label.textContent = button.textContent;
    button.replaceChildren(label);
    choiceObserver.observe(label);
  }
}
function fitResultLabels() {
  if (resultDock.hidden || !resultNext.classList.contains("is-classic")) return;
  for (const label of resultNext.querySelectorAll<HTMLElement>(
    ".choice-label",
  )) {
    const button = label.parentElement!;
    if (button.hidden) continue;
    const previous = choiceFits.get(label);
    const base =
      previous && label.style.fontSize === previous.fitted
        ? previous.base
        : label.style.fontSize;
    label.style.fontSize = base;
    const style = getComputedStyle(button);
    const available =
      button.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) -
      2;
    const range = document.createRange();
    range.selectNodeContents(label);
    const width = range.getBoundingClientRect().width;
    if (width > available && available > 0)
      label.style.fontSize = `${Math.max(10, (parseFloat(getComputedStyle(label).fontSize) * available) / width)}px`;
    choiceFits.set(label, { base, fitted: label.style.fontSize });
  }
}
// Home has its own composition; the same controls keep their navigation handlers.
const homeLayout = document.createElement("div");
homeLayout.className = "home-layout";
const homeCurrent = document.createElement("section");
homeCurrent.className = "home-current";
homeCurrent.setAttribute("aria-labelledby", "home-game-title");
homeCurrent.innerHTML =
  '<p class="home-eyebrow" id="home-eyebrow"></p><h2 id="home-game-title"></h2><p id="home-difficulty" hidden></p>';
const homeGoal = document.createElement("div");
homeGoal.id = "home-goal";
$("new").className = "text-button restart-action";
const classicActions = document.createElement("div");
classicActions.className = "classic-actions";
classicActions.innerHTML =
  '<button id="next-classic" class="text-button" hidden>Новая партия</button><button id="menu-easier" class="text-button" hidden>Новая партия полегче</button>';
classicActions.prepend($("new"));
homeCurrent.append($("resume-context"), homeGoal, $("resume"), classicActions);
const homeModes = document.createElement("section");
homeModes.className = "home-modes";
homeModes.setAttribute("aria-label", "Режимы игры");
homeModes.append(document.querySelector(".mode-nav")!, $("calendar-open"));
homeLayout.append(homeCurrent, homeModes);
$("menu-content").insertBefore(
  homeLayout,
  document.querySelector(".home-links"),
);
const settingsBasics = document.createElement("section");
settingsBasics.className = "settings-basics";
for (const node of [...$("settings-panel").children])
  if (!node.matches(".screen-heading,#reminder-settings"))
    settingsBasics.append(node);
$("settings-panel").insertBefore(settingsBasics, $("reminder-settings"));
for (const id of ["dark", "sound", "vibration", "reminders"])
  $(id).setAttribute("role", "switch");
let enteredGame = false;
document.querySelector("header")!.insertBefore($("jar-meter"), $("book-top"));
const gameTop = document.createElement("div");
gameTop.className = "game-top";
gameTop.append(
  document.querySelector("header")!,
  document.querySelector(".game-meta")!,
  $("page-progress"),
);
document.querySelector(".game")!.insertBefore(gameTop, $("lesson"));
const gameActions = document.createElement("div");
gameActions.className = "game-actions";
gameActions.append(
  document.querySelector(".status-wrap")!,
  document.querySelector("footer")!,
);
document.querySelector(".game")!.insertBefore(gameActions, resultDock);
const magnetButton = document.createElement("button");
magnetButton.id = "magnet"; magnetButton.className = "action"; magnetButton.hidden = true;
magnetButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v9a7 7 0 0 0 14 0V4h-4v9a3 3 0 0 1-6 0V4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 8h4m6 0h4" stroke="currentColor" stroke-width="1.7"/></svg><span class="action-label">Магнит</span><small id="magnet-count" class="action-count" aria-hidden="true"></small>';
$("add").before(magnetButton);
magnetButton.onclick = () => void openMagnet();
const planButton = document.createElement("button");planButton.id="plan";planButton.className="action";planButton.hidden=true;
planButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h12M8 12h12M8 19h12" stroke="currentColor" fill="none" stroke-width="1.7"/><circle cx="3" cy="5" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="19" r="1.5" fill="currentColor"/></svg><span class="action-label">План</span><small id="plan-count" class="action-count" aria-hidden="true"></small>';
$("add").before(planButton);planButton.onclick=()=>void openPlan();
let planHighlighted=false;
const planRail=document.createElement("div");planRail.id="plan-rail";planRail.hidden=true;
$("status").before(planRail);
let planVisualKey="";
const resultAssistance = document.createElement("p"); resultAssistance.id = "result-assistance"; resultAssistance.className = "fine";
$("win-stats").after(resultAssistance);
const boardView = new BoardView($("board"));
const dialog = $<HTMLDialogElement>("dialog"),
  viewport = $("viewport");
const dialogHeader = dialog.querySelector<HTMLElement>(".dialog-head")!;
const settingsHeading =
  $("settings-panel").querySelector<HTMLElement>(".screen-heading")!;
const confirmHeading = document.createElement("div");
confirmHeading.className = "screen-heading";
confirmHeading.innerHTML = `<button id="confirm-back" class="text-button" aria-label="Назад">${icon("back")}</button><h2>Начать заново?</h2>`;
$("confirm-content").prepend(confirmHeading);
$("confirm-back").onclick = returnToPrevious;
function dialogScroller(): HTMLElement {
  return (
    dialog.querySelector<HTMLElement>(".dialog-scroll:not([hidden])") ?? dialog
  );
}
for (const id of ["settings-panel", "collection", "confirm-content"])
  $(id).classList.add("dialog-scroll");
function releaseDialogHeading() {
  const current = dialogHeader.querySelector<HTMLElement>(".screen-heading");
  if (current === settingsHeading) $("settings-panel").prepend(current);
  else if (current === confirmHeading) $("confirm-content").prepend(current);
  else current?.remove();
}
function pinDialogHeading(panel: HTMLElement) {
  releaseDialogHeading();
  const heading = panel.querySelector<HTMLElement>(".screen-heading");
  if (heading) dialogHeader.prepend(heading);
  dialog.scrollTop = 0;
  showSaveState();
}
// Use measured text, including Android's text zoom, to choose an action layout.
let actionsFrame = 0;
function scheduleActionLayout() {
  cancelAnimationFrame(actionsFrame);
  actionsFrame = requestAnimationFrame(() => {
    fitResultLabels();
    const footer = document.querySelector<HTMLElement>("footer")!;
    const actions = [...footer.querySelectorAll<HTMLElement>(".action")].filter(
      (b) => getComputedStyle(b).display !== "none" && !b.hidden,
    );
    footer.style.setProperty("--help-actions",String(actions.length));
    const hasAssist=actions.some(button=>button.id==="magnet"||button.id==="plan");
    let widest = 44;
    const required = actions.reduce(
      (width, button) => {
        const label =
          button.querySelector<HTMLElement>(".action-label") ??
          button.querySelector<HTMLElement>("span")!;
        const range=document.createRange();range.selectNodeContents(label);
        let needed=Math.max(44,range.getBoundingClientRect().width+6);
        if(hasAssist){
          // New four-action toolbars need unwrapped labels. Preserve the established
          // three-action sidebar measurement so ordinary landscape keeps its height.
          const probe=document.createElement("span");probe.textContent=label.textContent;
          Object.assign(probe.style,{position:"fixed",visibility:"hidden",whiteSpace:"nowrap",width:"max-content",maxWidth:"none",font:getComputedStyle(label).font,letterSpacing:getComputedStyle(label).letterSpacing});
          button.append(probe);range.selectNodeContents(probe);
          needed=Math.max(44,range.getBoundingClientRect().width+12);probe.remove();
        }
        widest = Math.max(widest, needed);
        return width + needed;
      },
      Math.max(0, actions.length - 1) * 2,
    );
    const landscape = matchMedia(
      "(orientation: landscape) and (min-width: 540px)",
    ).matches;
    const game = document.querySelector<HTMLElement>(".game")!;
    // Compare with the stable sidebar width, not a footer that widens after docking.
    const sideWidth = gameTop.clientWidth;
    const dock =
      landscape &&
      innerHeight <= 420 &&
      !game.classList.contains("is-result") &&
      actions.length > 0 &&
      (required > sideWidth ||
        (actions.length === 2 && widest > (sideWidth - 2) / 2));
    game.classList.toggle("docked-actions", dock);
    const status = document.querySelector<HTMLElement>(".status-wrap")!;
    const statusParent = dock ? gameTop : gameActions;
    if (status.parentElement !== statusParent) {
      if (dock) statusParent.append(status);
      else statusParent.prepend(status);
    }
    const availableWidth = dock ? game.clientWidth - 32 : footer.clientWidth;
    footer.style.setProperty("--assist-columns",actions.length>4&&widest+12<=(availableWidth-12)/3?"3":widest+12>(availableWidth-8)/2?"1":"2");
    game.classList.toggle(
      "stacked-actions",
      actions.length > 0 &&
        (required > availableWidth ||
          ((!landscape || hasAssist) &&
            widest >
              (availableWidth - Math.max(0, actions.length - 1) * 2) /
                actions.length)),
    );
    const win = $("win");
    const viewport = $("viewport");
    const classicResult = !win.hidden && win.dataset.resultKind === "classic";
    win.classList.toggle(
      "compact-result",
      classicResult && viewport.clientHeight < 440,
    );
    win.classList.remove("minimal-result");
    if (classicResult && win.scrollHeight > viewport.clientHeight + 1)
      win.classList.add("minimal-result");
  });
}
const actionObserver = new ResizeObserver(scheduleActionLayout);
actionObserver.observe(document.querySelector("footer")!);
actionObserver.observe($("viewport"));
actionObserver.observe($("win-stats"));
document
  .querySelectorAll("footer .action span")
  .forEach((label) => actionObserver.observe(label));
window.addEventListener("resize", scheduleActionLayout);
void document.fonts.ready.then(scheduleActionLayout);
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
function restorable(raw: string | null): boolean {
  if (!raw) return false;
  try {
    readProgress(raw);
    return true;
  } catch {
    return false;
  }
}
async function preserveUnreadSave(raw: string) {
  const previous = await platform.read(PROGRESS + ".recovery");
  await platform.write(
    PROGRESS + (restorable(previous) ? ".damaged" : ".recovery"),
    raw,
  );
}
restoreRead.onclick = async () => {
  if (busy || futureSave) return;
  busy = true;
  restoreRead.disabled = true;
  let validCopy = false;
  try {
    const raw = await platform.read(PROGRESS + ".recovery");
    if (!raw) throw Error("Missing backup");
    const restored = readProgress(raw);
    validCopy = true;
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
    if (!validCopy) recoveryAvailable = false;
    readWarning = validCopy
      ? "Не удалось сохранить восстановленную партию. Текущая партия не изменена. Попробуйте ещё раз."
      : "Копия повреждена и не подходит для восстановления. Текущая партия не изменена.";
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
  const parent = dialog.open
    ? dialogScroller()
    : document.querySelector(".game")!;
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
  if (storageConflict && !futureSave && Object.keys(settingsDirty).length) {
    const patch = { ...settingsDirty };
    return platform
      .writeSettingsPatch(SETTINGS, JSON.stringify(settings), patch)
      .then((merged) => {
        if (merged) applySettings(merged);
        for (const key of Object.keys(patch))
          if (settingsDirty[key] === patch[key]) delete settingsDirty[key];
      })
      .catch(() => {});
  }
  if (storageConflict || futureSave || (switching && state === progress))
    return;
  metadata(state);
  if (lesson < 0 && !busy) game.current.scroll = viewport.scrollTop;
  state.sessions[state.active] = game;
  const committedEvents = [...(metadata(state).analytics ?? [])];
  const bundle = serializeProgress(state),
    prefs = JSON.stringify(settings),
    patch = { ...settingsDirty };
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (storageConflict || futureSave) return;
      try {
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
        if (pendingResult?.session === game) pendingResult.saved = true;
        lastStored = bundle;
        // Dispatch only events contained in this successfully written snapshot.
        // A crash before the next cleanup write can replay IDs; native deduplicates.
        if (adsBridge)
          void committedAnalytics.publish(committedEvents, (id) => {
            acknowledgeAnalytics(metadata(state), id);
            if (state !== progress)
              acknowledgeAnalytics(metadata(progress), id);
          });
        const recovered = saveFailed;
        saveFailed = false;
        showSaveState();
        if (lesson < 0 && !occupied(board())) {
          renderWin();
          maybeCelebrateResult();
          if (recovered) setTimeout(() => void tryResultEngagement(), 1500);
        }
        if (recovered) {
          track("save_recovered", { stage: "persist" });
          saveRecovered = true;
          message("Партия сохранена");
        }
      } catch (error) {
        storageConflict = error instanceof platform.SaveConflict;
        if (!saveFailed)
          track("save_error", {
            conflict: storageConflict,
            stage: "persist",
            reason: platform.saveErrorReason(error),
          });
        saveFailed = true;
        showSaveState();
        if (lesson < 0 && !occupied(board())) renderWin();
        message($("save-warning").textContent!);
      }
    });
  return saveQueue;
}
function applySettings(incoming: Record<string, unknown>) {
  for (const key of [
    "theme",
    "sound",
    "vibration",
    "tutorialDone",
    "reminders",
    "reminderTime",
  ] as const) {
    if (!Object.hasOwn(incoming, key) || Object.hasOwn(settingsDirty, key))
      continue;
    if (key === "theme")
      settings.theme = incoming.theme === "dark" ? "dark" : "light";
    else if (key === "reminderTime") {
      if (
        typeof incoming[key] === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(incoming[key])
      )
        settings[key] = incoming[key];
    } else settings[key] = incoming[key] === true;
  }
  applyTheme();
  $<HTMLInputElement>("sound").checked = settings.sound;
  $<HTMLInputElement>("vibration").checked = settings.vibration;
  platform.setHapticState(settings.vibration, paused);
  updateReminderSettings();
}
window.addEventListener("storage", (event) => {
  if (!event.newValue || !event.key?.startsWith(SETTINGS)) return;
  try {
    if (event.key.startsWith(SETTINGS + "."))
      applySettings({
        [event.key.slice(SETTINGS.length + 1)]: JSON.parse(event.newValue),
      });
    if (event.key === SETTINGS || event.key.startsWith(SETTINGS + "."))
      void platform
        .readSettings(SETTINGS)
        .then((raw) => {
          if (raw) applySettings(JSON.parse(raw));
          // Per-field keys are authoritative. A late snapshot from another tab
          // may update the compatibility JSON after those keys were committed.
          // Repair only that projection under the settings lock; never the game.
          if (raw && !futureSave && raw !== localStorage.getItem(SETTINGS))
            void platform
              .writeSettingsPatch(SETTINGS, JSON.stringify(settings), {})
              .catch(() => {});
        })
        .catch(() => {});
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
  feedback("button");
  save();
}
function feedback(kind: HapticCue | "add" = "pair", tactile = true) {
  if (paused || document.hidden) return;
  if (settings.vibration && tactile)
    void platform.haptic(kind === "add" ? "button" : kind).catch(() => {});
  if (kind !== "reject") playSound(kind, settings.sound);
}
function visibleCellEffects(
  indices: readonly number[],
  frames: Keyframe[],
  duration: number,
) {
  if (reduced() || document.hidden) return 0;
  const view = viewport.getBoundingClientRect(),
    box = $("board").getBoundingClientRect();
  const row = box.width / WIDTH;
  if (!row) return 0;
  const first = Math.max(0, Math.floor((view.top - box.top) / row)) * WIDTH;
  const last = Math.ceil((view.bottom - box.top) / row) * WIDTH;
  const visible = indices.filter((i) => i >= first && i < last).slice(0, 54);
  for (const index of visible) motion(cell(index), frames, duration);
  return visible.length;
}
function clearBoardReveal() {
  clearTimeout(boardRevealTimer);
  boardRevealCancel?.();
  boardRevealCancel = undefined;
}
function revealAddedCells(start: number, end: number) {
  clearBoardReveal();
  const current = session.current.board;
  const reveal = (final = false) => {
    if (session.current.board !== current || dialog.open || paused) {
      clearBoardReveal();
      return;
    }
    const count = visibleCellEffects(
      Array.from({ length: end - start }, (_, i) => start + i),
      [
        { background: "var(--selected)", opacity: 0.45 },
        { background: "transparent", opacity: 1 },
      ],
      220,
    );
    if (count || final) clearBoardReveal();
  };
  const arrived = () => reveal();
  // Ignore a queued scrollend from the activating button's own scroll. The target must be visible.
  viewport.addEventListener("scrollend", arrived);
  boardRevealCancel = () => viewport.removeEventListener("scrollend", arrived);
  boardRevealTimer = setTimeout(() => reveal(true), 1000);
}
function settlePresentation() {
  presentationRevision++;
  clearMotions();
  jarSpill.clear();
  clearContact();
  clearTrophyCelebration();
  clearResultCelebration();
  clearBoardReveal();
  clearTimeout(fullJarTimer);
  completedJar = undefined;
  pendingResult = undefined;
  flights.clear();
  visualSeeds = jars(progress).meter;
  renderJar();
}
function animateSeeds(rects: DOMRect[], amount: number, result = false) {
  if (!amount || !rects.length) return;
  const plan = createValueTransferPlan(amount, {
    minDurationMs: 420,
    maxDurationMs: 720,
    maxVisualTokens: 2,
    maxAudioEvents: 2,
  });
  const tokens = Array.from(
    { length: plan.visualTokenCount },
    (_, i) => rects[i % rects.length],
  );
  flights.fly(tokens, $("jar-glass"), (index, silent) => {
    const quantity =
      valueAfterVisualArrival(plan, index) -
      (index ? valueAfterVisualArrival(plan, index - 1) : 0);
    const before = jarState(visualSeeds ?? 0);
    visualSeeds = Math.min(jars(progress).meter, (visualSeeds ?? 0) + quantity);
    const after = jarState(visualSeeds);
    const full = after.index > before.index;
    if (full && !silent) {
      clearTimeout(fullJarTimer);
      completedJar = {
        index: before.index,
        capacity: before.capacity,
        until: performance.now() + 1100,
      };
      const nextJar = () => {
        completedJar = undefined;
        renderJar();
        if (!dialog.open && !paused)
          motion(
            $("jar-glass"),
            [
              { opacity: 0.5, transform: "scale(.92)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            160,
          );
      };
      fullJarTimer = setTimeout(nextJar, 1110);
      const completion = completedJar;
      const revision = presentationRevision;
      // A failed/delayed write must not emit a new milestone, nor may an old
      // arrival restart it after navigation. This effect owns no saved reward.
      void Promise.resolve()
        .then(() => saveQueue)
        .then(() => {
          if (
            revision !== presentationRevision ||
            completedJar !== completion ||
            performance.now() >= completion.until ||
            saveFailed ||
            storageConflict ||
            futureSave ||
            dialog.open ||
            hintOffer.open ||
            paused ||
            document.hidden
          )
            return;
          // Keep the old, full jar through the whole shake if persistence was slow.
          completion.until = performance.now() + 1100;
          clearTimeout(fullJarTimer);
          fullJarTimer = setTimeout(nextJar, 1110);
          jarSpill.play($("jar-glass"));
          feedback("full");
        });
    }
    renderJar();
    if (silent || dialog.open || paused) return;
    if (full || completedJar) return;
    feedback("land", !result);
    motion(
      $("jar-glass"),
      [
        { transform: "rotate(-3deg) scale(1.05)" },
        { transform: "rotate(2deg)" },
        { transform: "none" },
      ],
      180,
    );
  });
}
function maybeCelebrateResult() {
  const pending = pendingResult;
  if (
    !pending ||
    pending.session !== session ||
    !pending.saved ||
    busy ||
    paused ||
    dialog.open ||
    occupied(board()) ||
    saveFailed ||
    storageConflict ||
    futureSave
  )
    return;
  pendingResult = undefined;
  const kind = resultKind(progress.active, progress.done, notebook);
  feedback(kind === "classic" || kind === "daily" ? "win" : kind);
  clearResultCelebration();
  clearResultCelebration = celebrateResult(
    document.querySelector<HTMLElement>(".win-symbol")!,
    kind,
    reduced(),
  );
  if (earnedSeeds) animateSeeds(pending.rects, earnedSeeds, true);
  if (earnedSeeds || earnedHints)
    motion(
      $("result-gains"),
      [
        { opacity: 0.1, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      200,
    );
  if (progress.active.startsWith("daily") && earnedSeeds) {
    const month = progress.active.slice(9, 16);
    const t = trophy(month, progress.done);
    for (const fill of $("award").querySelectorAll<SVGElement>(
      ".medal-liquid, .medal-ink-level",
    )) {
      const target = Number(fill.dataset.target);
      const after = Math.min(t.count, target);
      motion(
        fill,
        [
          {
            transform: `scaleY(${after ? Math.min(Math.max(0, t.count - 1), target) / after : 1})`,
          },
          { transform: "scaleY(1)" },
        ],
        420,
      );
    }
    if (earnedAward) {
      clearTrophyCelebration();
      clearTrophyCelebration = celebrateTrophy($("award"), t.tier, reduced());
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
type MotionOwner = { el: Element; properties: Set<string>; selection: string };
const ownedMotions = new Map<Animation, MotionOwner>();
const cellSelection = (el: Element) =>
  `${el.classList.contains("selected")}/${el.classList.contains("hinted")}`;
function clearMotions() {
  for (const animation of ownedMotions.keys()) animation.cancel();
  ownedMotions.clear();
}
function motion(el: Element | null, frames: Keyframe[], duration = 160) {
  if (!el) return;
  const properties = new Set(frames.flatMap(frame =>
    Object.keys(frame).filter(key => !["offset", "easing", "composite"].includes(key)),
  ));
  const previous = [...ownedMotions].filter(([, owner]) =>
    owner.el === el && [...properties].some(key => owner.properties.has(key)),
  );
  // Sample before cancelling the previous owner. Repeated effects continue from
  // the visible value; independent translate/opacity channels may coexist.
  const first = {...frames[0]};
  if (previous.length || properties.has("background")) {
    const visible = getComputedStyle(el);
    for (const key of Object.keys(first)) {
      if (properties.has(key))
        (first as Record<string, unknown>)[key] =
          visible.getPropertyValue(key.replace(/[A-Z]/g, c => "-" + c.toLowerCase()));
    }
  }
  for (const [animation] of previous) {
    ownedMotions.delete(animation);
    animation.cancel();
  }
  if (reduced() || paused || document.hidden) return;
  const animation = el.animate([first, ...frames.slice(1)], { duration, easing: "ease-out" });
  ownedMotions.set(animation, {el, properties, selection: cellSelection(el)});
  const release = () => ownedMotions.delete(animation);
  animation.addEventListener("finish", release, {once:true});
  animation.addEventListener("cancel", release, {once:true});
}
function reconcileCellMotions() {
  for (const [animation, owner] of [...ownedMotions]) {
    if (!owner.el.matches(".cell") || !owner.properties.has("background")) continue;
    if (animation.playState === "idle" || !owner.el.isConnected) {
      ownedMotions.delete(animation);
      continue;
    }
    if (owner.selection === cellSelection(owner.el)) continue;
    const visible = getComputedStyle(owner.el).backgroundColor;
    const target = owner.el.classList.contains("selected") ? "var(--selected)"
      : owner.el.classList.contains("hinted") ? "var(--highlight)" : "transparent";
    motion(owner.el, [{background:visible}, {background:target}], 100);
  }
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
let appForeground = true;
let backgroundAt: number | undefined;
let platformPaused = false;
function syncPauseState() {
  paused =
    !appForeground ||
    platformPaused ||
    document.hidden ||
    adActive ||
    rewardRequest ||
    engagementActive;
  $("app").inert = adActive || rewardRequest || engagementActive;
  blockSound(paused);
  platform.setHapticState(settings.vibration, paused, !paused);
  if (paused) {
    settlePresentation();
    clearHelpEffects();
    cancelHint();
    suspendSound();
  }
  if (!busy) render();
  platform.gameplay(!paused && !dialog.open && occupied(board()) > 0);
  updateBanner();
  if (!paused) queueMicrotask(() => void applyEarnedHelp());
}
let rewardQueue = Promise.resolve();
let rewardRequest = false;
let helpChoiceBusy = false;
let bannerFrame = 0;
$("app").insertAdjacentHTML(
  "beforeend",
  `<div id="ad-space" aria-hidden="true"></div><dialog id="hint-offer" aria-labelledby="hint-offer-title"><div class="hint-heading"><h2 id="hint-offer-title">Ещё подсказки</h2><button id="close-hints" class="plain" aria-label="Закрыть предложение">${icon("close")}</button></div><div class="hint-copy"><p id="help-offer-copy">Посмотреть видео: показать эту подсказку и оставить ещё 2.</p><div id="help-pack" hidden></div><div id="help-steps" hidden></div><details id="help-details"><summary>Как работает</summary><p id="help-details-copy"></p></details></div><div class="offer-terms"><strong id="help-price"></strong><span id="help-undo"></span></div><p id="rewarded-state" role="status"></p><div class="hint-actions"><button id="watch-hints" class="primary">Посмотреть видео · подсказка +2</button><button id="cancel-hints" class="secondary">Продолжить без подсказки</button></div></dialog>`,
);
const hintOffer = $<HTMLDialogElement>("hint-offer");
const helpPreview = document.createElement("div"); helpPreview.id = "help-preview"; helpPreview.hidden = true;
$("help-offer-copy").after(helpPreview);
const lessonQuick = document.createElement("button");
lessonQuick.id = "lesson-quick";
lessonQuick.className = "secondary";
lessonQuick.textContent = "Начать с короткой задачи";
lessonQuick.hidden = true;
$("lesson-next").after(lessonQuick);
lessonQuick.onclick = () => {
  const task = notebook.find((p) => !progress.done.includes(p.id));
  if (!task || busy) return;
  // Keep the completed lesson visible until the chosen task is durable.
  firstEvent("tutorial_end", { outcome: "complete", step: lesson + 1 });
  void switchGame(task.id);
};
function gameMode() {
  return progress.active === "classic"
    ? "classic"
    : progress.active.startsWith("book")
      ? "notebook"
      : "daily";
}
const committedAnalytics = new CommittedAnalytics(async (event) => {
  if (!adsBridge) return false;
  const result = await adsBridge.report({
    name: event.name,
    data: { ...event.data, event_id: event.id, schema: 2 },
  });
  return result?.accepted !== false;
});
function durableEvent(
  name: string,
  data: Record<string, string | number | boolean> = {},
) {
  if (adsBridge)
    enqueueAnalytics(metadata(progress), name, {
      cohort: metadata(progress).analyticsCohort ?? "legacy",
      ...data,
    });
}
function trackOpen(reason: "restart" | "resume" | "switch") {
  track("game_open", {
    mode: gameMode(),
    cohort: metadata(progress).analyticsCohort ?? "legacy",
    task: progress.active,
    reason,
    attempt: hintAttempt(progress).id,
    in_progress:
      occupied(session.current.board) > 0 && session.history.length > 0,
  });
}
function markGameStarted() {
  lastInputAt = performance.now();
  if (lesson >= 0 || !adsBridge) return;
  const attempt = hintAttempt(progress);
  if (attempt.analyticsStarted) return;
  attempt.analyticsStarted = true;
  durableEvent("game_start", {
    mode: gameMode(),
    task: progress.active,
    attempt: attempt.id,
  });
  void save();
}
function updateBanner() {
  if (bannerFrame) return;
  bannerFrame = requestAnimationFrame(() => {
    bannerFrame = 0;
    void syncBanner(
      lesson < 0 &&
        !dialog.open &&
        !hintOffer.open &&
        !paused &&
        !document.hidden,
    );
  });
}
new MutationObserver(updateBanner).observe(dialog, {
  attributes: true,
  attributeFilter: ["open"],
});
new MutationObserver(updateBanner).observe(hintOffer, {
  attributes: true,
  attributeFilter: ["open"],
});
new ResizeObserver(updateBanner).observe($("ad-space"));
new MutationObserver(updateBanner).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["style"],
});
window.addEventListener("resize", updateBanner);
let offeredIntent: HelpIntent | undefined;
let verifiedHint: HelpIntent | undefined;
let autoIntent: HelpIntent | undefined;
let applyingHelp = false;
function currentPlan(){return helpPaused?undefined:planPosition(progress,session);}
function helpData(intent: HelpIntent) {
  const a = helpProfile(progress).assignments.at(-1);
  return {product: intent.product, mode: intent.task === "classic" ? "classic" : intent.task.startsWith("book") ? "notebook" : "daily",
    attempt: intent.attempt, intent_id: intent.id, offer_id: intent.offer, algorithm: intent.algorithm,
    experiment: a?.experiment ?? "none", variant: a?.variant ?? "control", install: helpProfile(progress).install,
    qa: Boolean(qaProfile)};
}
function helpEvent(name: string, intent: HelpIntent, data: Record<string, string | number | boolean> = {}) {
  track(`assist_${name}`, {...helpData(intent), ...data});
}
function helpFollowup(outcome: string) {
  const intent = helpProfile(progress).followup;
  if (!intent || intent.attempt !== hintAttempt(progress).id || intent.task !== progress.active) return;
  if (adsBridge) enqueueAnalytics(metadata(progress), "assist_followup", {...helpData(intent), outcome});
  delete helpProfile(progress).followup;
}
function validIntent(intent: HelpIntent) {
  return !futureSave && !storageConflict && progress.active === intent.task &&
    hintAttempt(progress).id === intent.attempt && intent.rules === session.rules && sameBoard(board(), intent.board);
}
function createHintIntent(pair: Connection): HelpIntent {
  return freezeIntent({version: 1, id: crypto.randomUUID(), offer: crypto.randomUUID(), product: "hint_pack_3",
    task: progress.active, attempt: hintAttempt(progress).id, rules: 1, algorithm: "hint-v1", board: [...board()], pair: [pair.a, pair.b]});
}
async function persistHelp(candidate: Progress, game = session): Promise<boolean> {
  const wasBusy = busy;
  busy = true;
  try {
    await save(candidate, game);
    if (saveFailed || futureSave || storageConflict) return false;
    progress = candidate; session = game;
    return true;
  } finally { busy = wasBusy; }
}
function receiveReward(r: RewardReceipt): Promise<void> {
  rewardQueue = rewardQueue.catch(() => {}).then(async () => {
    if (switching) await saveQueue;
    if (futureSave || storageConflict || switching) return;
    const product = receiptProduct(r);
    if (!product) { track("assist_result", {outcome: "unsupported_receipt", receipt: typeof r?.token === "string" ? r.token.slice(0,100) : "invalid"}); readWarning ||= "Награда сохранена на устройстве, но её формат пока не поддерживается. Не удаляйте игру."; showSaveState(); return; }
    const candidate = cloneProgress(progress), m = metadata(candidate);
    const already = m.rewardReceipts?.includes(r.token);
    if (!grantReward(candidate, r)) return;
    if (!already && adsBridge) {
      enqueueAnalytics(m, product === "hint_pack_3" ? "hint_reward_granted" : "assist_grant", {
        product, count: product === "hint_pack_3" ? 3 : 1, attempt: r.attempt,
        receipt: r.token, intent_id: r.intent_id ?? "legacy", offer_id: r.offer_id ?? "legacy", ad_session_id: r.ad_session_id ?? "legacy",
        install: helpProfile(candidate).install, qa: Boolean(qaProfile), mode: gameMode(),
      });
    }
    if (!await persistHelp(candidate)) return;
    await adsBridge?.acknowledge({token: r.token}).catch(() => {});
    void refreshRewarded();
    if (!busy) render();
  });
  return rewardQueue;
}
function updateOfferReadiness() {
  if(!hintOffer.open)return;
  const {state,reason}=rewardedReadiness;
  const charged=offeredIntent?.product!=="hint_pack_3"&&offeredIntent&&canUseStoredHelp(offeredIntent);
  $("rewarded-state").hidden=!saveFailed&&(Boolean(charged)||(offeredIntent?.product==="hint_pack_3"&&state==="ready"));
  $("rewarded-state").textContent=saveFailed?"Не сохранено. Заряд на месте.":reason==="pending_receipt"?"Восстанавливаем награду…":state==="ready"?"Награда за завершённое видео":state==="loading"?"Видео загружается…":state==="disabled"?"Видео выключено":"Сейчас видео недоступно";
  $<HTMLButtonElement>("watch-hints").disabled=helpChoiceBusy||saveFailed||(!charged&&state!=="ready");
}
function setHelpOffer(title:string,goal:string,price:string,cta:string,undo:string,details:string){
  $("hint-offer-title").textContent=title;$("help-offer-copy").textContent=goal;
  $("help-price").textContent=price;$("help-price").hidden=!price;$("help-undo").textContent=undo;$("help-undo").hidden=!undo;
  $("help-price").parentElement!.hidden=!price&&!undo;
  $("watch-hints").textContent=cta;$("cancel-hints").textContent="Не сейчас";
  $("help-details-copy").textContent=details;($<HTMLDetailsElement>("help-details")).open=false;
  $("help-pack").hidden=true;$("help-steps").hidden=true;
}
function afterHelpCommit(callback:()=>void){
  const attempt=hintAttempt(progress).id,expected=[...board()],epoch=helpEffectEpoch();
  void saveQueue.then(()=>requestAnimationFrame(()=>{if(epoch===helpEffectEpoch()&&!saveFailed&&!storageConflict&&!futureSave&&!paused&&!document.hidden&&!dialog.open&&!hintOffer.open&&attempt===hintAttempt(progress).id&&sameBoard(board(),expected))callback();}));
}
function assistFeedback(kind:"magnet"|"plan"|"shuffle"|"add"|"undo"|"pair"|"select"|"reject",stage=0){
  if(paused||document.hidden||!appForeground)return;
  if(settings.vibration&&kind!=="select")void platform.haptic(kind==="magnet"||kind==="shuffle"?"pair":kind==="plan"?"hint":kind==="add"?"button":kind).catch(()=>{});
  if(kind!=="reject")playSound(kind==="plan"?"plan-step":kind,settings.sound,stage);
}
function updatePlanRail(plan:ReturnType<typeof planPosition>){
  planRail.hidden=!plan||lesson>=0||!occupied(board());
  if(planRail.hidden){planVisualKey="";return;}
  const steps=plan!.intent.proof!.length,index=plan!.index;
  const label=index<0?"План на паузе":plan!.complete?"Цель достигнута":plan!.intent.after?.length?"Очистить строку":"Очистить поле";
  planRail.innerHTML=`<span>${label}</span><span class="plan-dots" aria-label="${index<0?"Вернитесь к пути":`Шаг ${Math.min(index+1,steps)} из ${steps}`}">${Array.from({length:steps},(_,i)=>`<i class="${i<index||plan!.complete?"done":i===index?"current":""}">${i<index||plan!.complete?"✓":i+1}</i>`).join("")}</span>`;
  if(busy)return;
  const key=plan!.intent.id+":"+index;
  if(key!==planVisualKey){
    const previous=planVisualKey;planVisualKey=key;
    if(plan!.pair)afterHelpCommit(()=>{presentHelpStep($("board"),[plan!.pair!.a,plan!.pair!.b]);if(!previous)assistFeedback("plan",index);else if(index>Number(previous.split(":").at(-1)))playSound("plan-step",settings.sound,index);});
    else if(index<0&&previous)afterHelpCommit(()=>motion($("undo"),[{background:"var(--selected)"},{background:"transparent"}],300));
  }
}
window.addEventListener("seeds:rewarded-state", updateOfferReadiness);
function canUseStoredHelp(intent: HelpIntent): boolean { return Boolean(storedHelp(progress,intent)); }
function previewGrid(values: number[], marked: readonly number[] = []) {
  return `<div class="help-grid" role="img" aria-label="Положение цифр">${values.map((n,i)=>`<span class="${marked.includes(i) ? "magnet-mark" : ""}">${n || ""}</span>`).join("")}</div>`;
}
function magnetGoal(intent: HelpIntent) {
  let end = intent.after ?? [];
  for (const pair of intent.proof ?? []) end = proofRemovePair(end,...pair);
  if (!end.some(Boolean)) return `Очистить поле за ${intent.proof?.length ?? 0} хода`;
  if (Math.ceil(end.length/9) < Math.ceil(intent.board.length/9)) return "Открыть путь к очистке строки";
  return "Открыть обычный ход";
}
function offerMagnet(intent: HelpIntent) {
  if (helpPaused || !validIntent(intent) || hintOffer.open) return;
  if (!provenMagnet(intent)) {message("Сохранённый эффект не удалось проверить. Заряд не списан.");return;}
  offeredIntent = intent;
  const source = storedHelp(progress,intent);
  if (!source && !helpFlags.magnet) {message("Новые предложения Магнита выключены. Заработанные заряды сохранены."); return;}
  setHelpOffer("Магнит",magnetGoal(intent),source==="demo"?"Первый раз бесплатно":source==="replay"?"Повтор бесплатно":source==="charge"?"Из запаса: 1 заряд":"Видео → 1 Магнит",source==="demo"?"Попробовать":source==="replay"?"Повторить бесплатно":source==="charge"?"Применить":"Смотреть видео","Отмена вернёт поле · повтор бесплатно","Магнит уберёт две выделенные цифры. Заряд не возвращается после отмены. Повтор именно этого эффекта на исходном поле бесплатный.");
  helpPreview.hidden = false;
  helpPreview.innerHTML = `<div><strong>До · ${intent.board[intent.pair[0]]} + ${intent.board[intent.pair[1]]}</strong>${previewGrid(intent.board,intent.pair)}</div><div><strong>После Магнита</strong>${previewGrid(intent.after ?? [])}</div>`;
  hintOffer.showModal();updateOfferReadiness();updateBanner();
  helpEvent("eligibility",intent);helpEvent("offer",intent,{ready_state:rewardedReadiness.state,source:source ?? "video"});
  if (!source) void refreshRewarded(true);
}
async function openMagnet() {
  if (helpPaused || busy || paused || lesson >= 0 || progress.active !== "classic" || !hintAttempt(progress).help || hintPending) return;
  const entitlement = hintAttempt(progress).help?.magnet;
  if (entitlement) {
    if (sameBoard(board(),entitlement.intent.board)) offerMagnet(entitlement.intent);
    else message("Магнит уже использован. Его можно повторить после отмены к исходному полю.");
    return;
  }
  const original = [...board()], attempt = hintAttempt(progress).id, generation = ++hintGeneration;
  hintPending = true;render();message("Проверяю эффект Магнита…");
  const search = requestHelp(original,"magnet");helpSearchStop = search.cancel;
  const result = await search.result;
  if (generation !== hintGeneration || !sameBoard(board(),original) || attempt !== hintAttempt(progress).id || paused || dialog.open) return;
  hintPending = false;helpSearchStop = () => {};render();
  if (result.status !== "found" || !result.proof) {
    message(result.status === "unknown" ? "Не удалось проверить полезный Магнит за отведённое время. Можно продолжить игру." : "Сейчас проверенного полезного Магнита нет. Добавление и отмена остаются доступны.");return;
  }
  offerMagnet(helpIntent(progress,"magnet",result.proof));
}
async function performMagnet(intent: HelpIntent) {
  if (helpPaused || !validIntent(intent)) return false;
  try {
    const frame=captureHelpFrame($("board"));
    markGameStarted();
    const applied = applyMagnet(progress,intent,nextMagnetApplication(progress,intent),viewport.scrollTop);
    if (applied.duplicate) return true;
    if (adsBridge) enqueueAnalytics(metadata(applied.progress),"assist_apply",{...helpData(intent),application_id:hintAttempt(applied.progress).help!.magnet!.applications.at(-1)!,entitlement_id:applied.entitlement!,outcome:applied.source!});
    if (!await persistHelp(applied.progress,applied.session)) {render(); return false;}
    clearSelection();render();
    const next=intent.proof?.[0]??[];
    afterHelpCommit(()=>{presentHelpChange(frame,"magnet",intent.pair,next);assistFeedback("magnet");});
    message("Ход открыт. Попробуйте соединить пару.");
    if (!occupied(board())) {complete([]);void save();}
    return true;
  } catch {message("Этот Магнит сейчас неприменим. Заряд сохранён.");return false;}
}
function offerPlan(intent: HelpIntent) {
  const states=planBoards(intent);
  if(helpPaused||!validIntent(intent)||!states||hintOffer.open)return;
  const source=storedHelp(progress,intent);
  if(!source&&!helpFlags.plan){message("Новые предложения плана выключены. Заряды сохранены.");return;}
  offeredIntent=intent;helpPreview.hidden=true;
  const goal=states.at(-1)!.length?"Очистить строку":"Очистить поле";
  setHelpOffer(`План на ${intent.proof!.length} хода`,goal,source==="demo"?"Первый раз бесплатно":source==="charge"?"1 заряд — весь план":"Видео → 1 план",source==="demo"?"Открыть бесплатно":source?"Открыть план":"Смотреть видео","Отмена вернёт шаг · продолжение бесплатно","Убирайте отмеченные пары сами. Один заряд открывает весь путь. После другого хода подсветка приостановится; возврат через отмену продолжит план бесплатно. Заряд не возвращается.");
  $("help-steps").hidden=false;$("help-steps").innerHTML=Array.from({length:intent.proof!.length},(_,i)=>`<span>${i+1}</span>`).join('<i aria-hidden="true">→</i>');
  hintOffer.showModal();updateOfferReadiness();updateBanner();
  helpEvent("eligibility",intent);helpEvent("offer",intent,{ready_state:rewardedReadiness.state,source:source ?? "video"});
  if(!source)void refreshRewarded(true);
}
async function openPlan() {
  if(helpPaused||busy||paused||lesson>=0||progress.active!=="classic"||!hintAttempt(progress).help||hintPending)return;
  const current=currentPlan();
  if(hintAttempt(progress).help?.plan){
    if(current?.pair){displayHint(current.pair);message("Уберите отмеченную пару");}
    else message(current?.complete ? "Цель оплаченного плана достигнута" : "План доступен после возврата к его позиции");
    return;
  }
  const original=[...board()],attempt=hintAttempt(progress).id,generation=++hintGeneration;
  hintPending=true;render();message("Проверяю законченный план…");
  const search=requestHelp(original,"plan");helpSearchStop=search.cancel;
  const result=await search.result;
  if(generation!==hintGeneration||!sameBoard(board(),original)||hintAttempt(progress).id!==attempt||paused||dialog.open)return;
  hintPending=false;helpSearchStop=()=>{};render();
  if(result.status!=="found"||!result.proof){message(result.status==="unknown" ? "Проверка плана не уложилась в лимит. Обычная подсказка доступна." : "Законченный план на 2–3 хода пока не найден. Можно использовать обычную подсказку.");return;}
  offerPlan(helpIntent(progress,"plan",result.proof));
}
async function performPlan(intent: HelpIntent) {
  if(helpPaused||!validIntent(intent))return false;
  try{
    markGameStarted();const applied=applyPlan(progress,intent);
    if(!applied.duplicate&&adsBridge)enqueueAnalytics(metadata(applied.progress),"assist_apply",{...helpData(intent),application_id:intent.id+":1",entitlement_id:applied.entitlement,outcome:applied.source});
    if(!applied.duplicate&&!await persistHelp(applied.progress,applied.session)){render();return false;}
    const plan=currentPlan();
    if(plan?.pair){displayHint(plan.pair,true);message("Уберите отмеченную пару");}
    return true;
  }catch{message("План сейчас неприменим. Заряд сохранён.");return false;}
}
function offerHints(intent: HelpIntent) {
  if (rewardRequest || hintOffer.open) return;
  offeredIntent = intent;
  helpPreview.hidden = true;
  jarSpill.clear();helpEvent("eligibility",intent);track("hint_offer",{mode:gameMode()});
  setHelpOffer("Открыть подсказку","Досмотрите видео — покажем пару.","","Смотреть видео","","После завершённого видео откроем эту пару и оставим ещё две подсказки в запасе. Повтор уже открытой пары бесплатный.");
  $("help-pack").hidden=false;$("help-pack").innerHTML=`<span>${icon("hint")}<strong>1 сейчас</strong></span><span>${icon("hint")}<strong>+2 в запас</strong></span>`;
  hintOffer.showModal(); updateOfferReadiness();
  helpEvent("offer", intent, {ready_state: rewardedReadiness.state});
  void refreshRewarded(true);
  if (rewardedReadiness.reason === "pending_receipt") void (async () => {
    const pending = await adsBridge?.pending().catch(() => undefined);
    if (pending?.reward) {await receiveReward(pending.reward); if (!saveFailed && offeredIntent?.id === intent.id) {hintOffer.close(); offeredIntent = undefined; message("Ранее заработанная награда восстановлена в запасе");}}
  })();
  updateBanner();
}
$("close-hints").onclick = () => $("cancel-hints").click();
$("cancel-hints").onclick = () => {
  if (offeredIntent) helpEvent("choice", offeredIntent, {outcome: "dismissed"});
  hintOffer.close(); offeredIntent = undefined; render(); updateBanner();
};
hintOffer.addEventListener("cancel", e => {e.preventDefault(); $("cancel-hints").click();});
async function applyEarnedHelp() {
  if (applyingHelp || !autoIntent || paused || busy || adActive || rewardRequest || !appForeground || document.hidden) return;
  const intent = autoIntent, grant = helpProfile(progress).grant;
  if(helpPaused&&intent.product!=="hint_pack_3"){autoIntent=undefined;return;}
  if (!grant || grant.intent !== intent.id || grant.product !== intent.product) return;
  applyingHelp = true;
  try {
    if (!validIntent(intent)) {
      helpEvent("stored", intent, {outcome: "stale", receipt: grant.token});
      message(intent.product === "hint_pack_3" ? "3 подсказки добавлены в запас" : "Заряд добавлен в запас");
      autoIntent = undefined; return;
    }
    if (intent.product === "plan_1" && await performPlan(intent)) {autoIntent = undefined; return;}
    if (intent.product === "magnet_1" && await performMagnet(intent)) {autoIntent = undefined; return;}
    if (intent.product === "hint_pack_3" && await revealHint(intent)) {
      message(`Подсказка открыта. Ещё ${metadata(progress).wallet} в запасе`);
      autoIntent = undefined;
    }
  } finally { applyingHelp = false; }
}
$("watch-hints").onclick = async () => {
  const intent = offeredIntent;
  if (helpChoiceBusy || rewardRequest || !intent || !validIntent(intent) || (helpPaused&&intent.product!=="hint_pack_3")) return;
  helpChoiceBusy=true;
  $<HTMLButtonElement>("watch-hints").disabled=true;
  try {
  if (intent.product !== "hint_pack_3" && canUseStoredHelp(intent)) {
    if (busy) return;
    helpEvent("choice",intent,{outcome:"accepted"});
    $<HTMLButtonElement>("watch-hints").disabled = true;
    if (await (intent.product === "magnet_1" ? performMagnet(intent) : performPlan(intent))) {hintOffer.close();offeredIntent=undefined;updateBanner();}
    else updateOfferReadiness();
    return;
  }
  await refreshRewarded();
  if (rewardedReadiness.state !== "ready") {updateOfferReadiness(); return;}
  if (saveFailed || storageConflict || futureSave) {hintOffer.close(); showSaveState(); return;}
  helpEvent("choice", intent, {outcome: "accepted"});
  const candidate = cloneProgress(progress);
  helpProfile(candidate).intent = intent;
  if (!await persistHelp(candidate)) {hintOffer.close();offeredIntent=undefined;showSaveState();updateBanner();return;}
  autoIntent = intent;
  rewardRequest = true; hintOffer.close(); syncPauseState();
  const adSession = crypto.randomUUID();
  helpEvent("request", intent, {ad_session_id: adSession});
  let outcomeMessage = "";
  try {
    lastExternalAt = performance.now();
    const result = await showAd("rewarded", intent.attempt, intent, adSession);
    if (result.reward) await receiveReward(result.reward);
    await rewardQueue;
    helpEvent("result", intent, {ad_session_id: adSession, outcome: result.status ?? "error", reason: result.reason ?? result.status ?? "unknown"});
    if (helpProfile(progress).grant?.intent !== intent.id) {
      autoIntent = undefined;
      outcomeMessage = result.status === "reward_pending" ? "Награда ожидает сохранения на устройстве. Не удаляйте игру; повторите восстановление позже." : result.status === "closed" ? (intent.product === "hint_pack_3" ? "Видео закрыто. Подсказки не начислены." : "Видео закрыто. Заряд не начислен.") : "Реклама сейчас недоступна. Попробуйте позже.";
    }
  } finally {
    rewardRequest = false; syncPauseState();
    await applyEarnedHelp();
    if (outcomeMessage && !saveFailed) message(outcomeMessage);
    updateBanner();
  }
  } finally {helpChoiceBusy=false;if(hintOffer.open)updateOfferReadiness();}
};
let earnedAward = "",
  earnedSeeds = 0,
  earnedHints = 0;
function complete(rects: DOMRect[]) {
  const alreadyCompleted =
    metadata(progress).attempts[progress.active]?.completed;
  const id = progress.active,
    month = id.slice(9, 16);
  const before = id.startsWith("daily-v1-")
    ? trophy(month, progress.done).tier
    : 0;
  const gains = recordCompletion(progress, id);
  pendingResult = { session, rects, saved: false };
  if (gains.hints)
    durableEvent("daily_reward", {
      days: metadata(progress).daily!.count,
      count: gains.hints,
      attempt: hintAttempt(progress).id,
    });
  earnedSeeds = gains.seeds;
  earnedHints = gains.hints;
  if (!alreadyCompleted)
    durableEvent("game_complete", {
      mode: gameMode(),
      task: id,
      attempt: hintAttempt(progress).id,
      moves: session.current.moves,
      hints: progress.hints[id] ?? 0,
      assisted: Boolean(hintAttempt(progress).help?.assisted),
      assists: session.current.assists ?? 0,
    });
  if (!alreadyCompleted)
    firstEvent("first_complete", {
      mode: gameMode(),
      attempt: hintAttempt(progress).id,
    });
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
  renderClassicChoices();
  const kind = resultKind(id, progress.done, notebook);
  $("win").dataset.resultKind = kind;
  $("win").classList.toggle("daily-result", id.startsWith("daily"));
  const index = notebook.findIndex((p) => p.id === id);
  resultTitle.textContent =
    kind === "classic"
      ? "Поле очищено!"
      : kind === "daily"
        ? "Задача дня решена"
        : kind === "book"
          ? `Тетрадь ${volumeOf(id) + 1} пройдена!`
          : kind === "page"
            ? `Страница ${(Math.floor(index / 6) % 4) + 1} завершена!`
            : "Задача решена";
  resultSubtitle.textContent =
    kind === "book"
      ? "Все четыре страницы готовы"
      : kind === "page"
        ? "6 из 6 задач"
        : kind === "daily"
          ? id.slice(9).split("-").reverse().join(".")
          : "";
  resultSubtitle.hidden = !resultSubtitle.textContent;
  const symbol = document.querySelector<HTMLElement>(".win-symbol")!;
  if (resultArtKey !== kind) {
    symbol.innerHTML = resultArtwork(kind);
    resultArtKey = kind;
  }
  symbol.classList.toggle("paper-result", kind === "page" || kind === "book");
  symbol.classList.toggle("field-result", kind === "classic");
  $("win-stats").innerHTML = [
    ["Пары", session.current.moves],
    ["Добавления", session.current.additions],
    ["Подсказки", progress.hints[id] ?? 0],
  ]
    .map(
      ([label, value]) =>
        `<span class="result-stat"><strong>${value}</strong><span>${label}</span></span>`,
    )
    .join("");
  resultAssistance.textContent = !helpPaused && hintAttempt(progress).help?.assisted ? hintAttempt(progress).help?.plan ? hintAttempt(progress).help?.magnet ? "С Планом и Магнитом" : "С помощью Плана" : "С помощью Магнита" : "";
  resultAssistance.hidden = !resultAssistance.textContent;
  const i = notebook.findIndex((p) => p.id === id);
  const next = nextTask(id, progress.done);
  const archiveNext = id.startsWith("daily") && next?.startsWith("daily");
  $("play-again").textContent = archiveNext
    ? next!.slice(9) === today()
      ? "Сегодняшняя задача"
      : `Задача из архива · ${next!.slice(9).split("-").reverse().join(".")}`
    : next
      ? i >= 0 && volumeOf(next) !== volumeOf(id)
        ? "Следующая тетрадь"
        : i >= 0 &&
            Math.floor(notebook.findIndex((p) => p.id === next) / 6) >
              Math.floor(i / 6)
          ? "Следующая страница"
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
  $("result-reminder").hidden =
    !engagementAvailable ||
    settings.reminders ||
    !id.startsWith("daily") ||
    Boolean(
      metadata(progress).flags?.includes("reminder_permission_requested"),
    );
  $("result-gains").style.minHeight =
    earnedSeeds || earnedHints
      ? `${((earnedSeeds ? 1 : 0) + (earnedHints ? 1 : 0)) * 1.5}em`
      : "";
  $("result-gains").innerHTML = saveFailed
    ? "Награда ожидает сохранения"
    : [
        earnedSeeds
          ? `В баночку: +${earnedSeeds} ${seedWord(earnedSeeds)}`
          : "",
        earnedHints
          ? `За серию дней: +${earnedHints} ${hintWord(earnedHints)}`
          : "",
      ]
        .filter(Boolean)
        .map((text) => `<span>${text}</span>`)
        .join("");
  $("try-notebook").textContent = notebook
    .slice(0, 24)
    .some((p) => !progress.done.includes(p.id))
    ? "Короткая задача"
    : "Задача из тетради";
  $("try-notebook").hidden =
    id !== "classic" || !notebook.some((p) => !progress.done.includes(p.id));
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
        ? `✓ Страница ${(page % 4) + 1} завершена`
        : `Страница ${(page % 4) + 1} · ${n} из 6`;
  }
  if (id.startsWith("daily")) {
    const m = id.slice(9, 16),
      t = trophy(m, progress.done);
    award.hidden = false;
    award.innerHTML = `<div class="trophy-heading"><strong>${monthName(m)}</strong><span>${t.count} из ${days(m).length} дней</span></div>${trophyMark(m, t.count, days(m).length, saveFailed)}`;
  }
  prepareResultLabels();
  scheduleActionLayout();
}
function classicDifficulty(): ClassicDifficulty {
  return metadata(progress).classicRun?.difficulty ?? CLASSIC_DEFAULT;
}
function renderClassicChoices() {
  const isClassic = progress.active === "classic";
  const level = classicDifficulty();
  resultNext.classList.toggle("is-classic", isClassic);
  difficultyCaption.hidden = !isClassic;
  difficultyCaption.textContent =
    level === CLASSIC_MIN
      ? "Сложность: минимум"
      : level === CLASSIC_MAX
        ? "Сложность: максимум"
        : `${classicDifficultyNames[level]} сложность`;
  for (const [id, atLimit] of [
    ["classic-easier", level === CLASSIC_MIN],
    ["classic-harder", level === CLASSIC_MAX],
  ] as const) {
    const button = $<HTMLButtonElement>(id);
    button.hidden = !isClassic;
    button.disabled = busy || atLimit;
    button.title = atLimit
      ? level === CLASSIC_MIN
        ? "Уже самая лёгкая сложность"
        : "Уже самая высокая сложность"
      : id === "classic-easier"
        ? "Начать новую партию легче"
        : "Начать новую партию сложнее";
  }
  $<HTMLButtonElement>("play-again").disabled = busy;
}
function compactCount(n: number) {
  return n > 999 ? "999+" : String(n);
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
  document
    .querySelector(".game")!
    .classList.toggle(
      "short-board",
      values.length <= 54 && count > 0 && lesson < 0,
    );
  renderJar();
  gameDifficulty.hidden = lesson >= 0 || progress.active !== "classic";
  gameDifficulty.textContent = difficultyLabel();
  gameDifficulty.dataset.level = String(classicDifficulty());
  const ended = count === 0 && lesson < 0;
  document.querySelector(".game")!.classList.toggle("is-result", ended);
  resultDock.hidden = !ended;
  const taskIndex = notebook.findIndex((p) => p.id === progress.active);
  const marks = $("page-progress");
  marks.hidden = lesson >= 0 || taskIndex < 0;
  if (taskIndex >= 0) {
    const pageIndex = Math.floor(taskIndex / 6);
    marks.innerHTML = `<span>Страница ${(pageIndex % 4) + 1}</span><div>${notebook
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
  const plan = lesson < 0 ? currentPlan() : undefined;
  if(!busy){
    if(plan?.pair)highlight=plan.pair;
    else if(planHighlighted)highlight=null;
    planHighlighted=Boolean(plan?.pair);
  }
  updatePlanRail(plan);
  boardView.render(values, selected, highlight);
  reconcileCellMotions();
  $("win").hidden = count > 0 || lesson >= 0;
  document.querySelector<HTMLElement>("footer")!.hidden = !count && lesson < 0;
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
  const hintCount = monetized ? hintsLeft(progress) : 0;
  const repeatAvailable = available.some(p => hintAttempt(progress).hintKeys?.includes(hintKey(values, p.a, p.b)));
  const verifiedPaidHint = progress.active === "classic" ? available.length > 0 : Boolean(verifiedHint && validIntent(verifiedHint));
  const videoHint = helpFlags.visibility && monetized && hintCount === 0 && verifiedPaidHint && !repeatAvailable;
  const assist = hintAttempt(progress).help;
  magnetButton.hidden = helpPaused || lesson >= 0 || progress.active !== "classic" || !count || !assist || (!helpFlags.magnet && !assist.magnet && !helpProfile(progress).inventory.magnet);
  magnetButton.disabled = helpPaused || busy || hintPending || Boolean(assist?.magnet && !sameBoard(values,assist.magnet.intent.board));
  planButton.hidden=helpPaused||lesson>=0||progress.active!=="classic"||!count||!assist||(!helpFlags.plan&&!assist.plan&&!helpProfile(progress).inventory.plan);
  planButton.disabled=helpPaused||busy||hintPending||Boolean(assist?.plan && (currentPlan()?.index ?? -1)<0);
  $("plan-count").textContent=assist?.plan ? plan?.complete ? "✓" : plan?.pair ? `${plan.index+1}/${plan.intent.proof!.length}` : "↶" : String(helpProfile(progress).inventory.plan || (!helpProfile(progress).demo.plan ? 1 : 0));
  planButton.setAttribute("aria-label",assist?.plan ? "Продолжить оплаченный план" : `Стратегический план, зарядов ${$("plan-count").textContent}`);
  document.querySelector<HTMLElement>("footer")!.style.setProperty("--help-actions",String([...document.querySelectorAll<HTMLButtonElement>("footer button")].filter(b=>!b.hidden).length));
  $("magnet-count").textContent = assist?.magnet ? "↻" : String(helpProfile(progress).inventory.magnet || (!helpProfile(progress).demo.magnet ? 1 : 0));
  magnetButton.setAttribute("aria-label",assist?.magnet ? "Повторить Магнит на его исходном поле" : `Магнит, зарядов ${$("magnet-count").textContent}`);
  $("hint-count").textContent = videoHint ? "▷ +3" : monetized ? compactCount(hintCount) : "";
  $("hint").setAttribute(
    "aria-label",
    videoHint ? "Подсказка: 3 подсказки за просмотр видео" : monetized ? `Подсказка, осталось ${hintCount}` : "Подсказка",
  );
  updateBanner();
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
  const addCount =
    (progress.active === "classic" || lesson >= 0) && !available.length && count
      ? count
      : 0;
  $("add-count").textContent = addCount ? compactCount(addCount) : "";
  $("add").setAttribute(
    "aria-label",
    addCount ? `Добавить ${addCount} ${digitWord(addCount)}` : "Добавить",
  );
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
              : session.current.moves < 3
                ? "Равные или сумма 10"
                : ""
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
  helpSearchStop(); helpSearchStop = () => {};
}
function clearSelection() {
  cancelHint();
  selected = -1;
  highlight = null;
}
function startLesson(short = false) {
  shortLesson = short;
  if (busy) return;
  if (!metadata(progress).flags?.includes("tutorial_end"))
    firstEvent("tutorial_start", { short });
  session.current.scroll = viewport.scrollTop;
  lesson = 0;
  loadLesson();
  closeMenu();
  void save();
}
function loadLesson() {
  lessonQuick.hidden = true;
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
      ? " Пары ищутся по горизонтали, вертикали и диагонали, а ещё через край строки. Между ними — только пустые клетки."
      : "");
  $("lesson-next").hidden = true;
  viewport.scrollTop = 0;
  render();
  message("Попробуйте на маленьком поле");
}
function finishLesson(outcome: "complete" | "skip" = "skip") {
  if (busy) return;
  if (lesson >= 0 && !metadata(progress).flags?.includes("tutorial_end"))
    firstEvent("tutorial_end", { outcome, step: lesson + 1 });
  lesson = -1;
  lessonQuick.hidden = true;
  enteredGame = true;
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
  clearBoardReveal();
  const values = board();
  if (!values[i] || selected === i) {
    clearSelection();
    render();
    return;
  }
  if (lesson >= 0 && lessonPhase === 2) return;
  markGameStarted();
  if (selected < 0) {
    selected = i;
    feedback("select");
    if (highlight && i !== highlight.a && i !== highlight.b) highlight = null;
    render();
    motion(
      cell(i)?.querySelector(".digit") ?? null,
      [{ transform: "scale(.88)" }, { transform: "scale(1)" }],
      120,
    );
    return;
  }
  const a = selected,
    result = checkPair(values, a, i);
  if (!result.ok) {
    selected = i;
    highlight = null;
    render();
    feedback("reject");
    motion(cell(a), [
      { background: "transparent" },
      { background: "var(--reject)", offset: 0.35 },
      { background: "transparent" },
    ]);
    motion(cell(i)?.querySelector(".digit") ?? null, [
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
  if (lesson < 0) {
    const shown = hintAttempt(progress).hintChoices?.[hintKey(values, 0, 0)];
    const assisted = Boolean(hintAttempt(progress).help?.assisted || (shown && shown.includes(a) && shown.includes(i)));
    const data = {
      mode: gameMode(),
      attempt: hintAttempt(progress).id,
      assisted,
    };
    firstEvent("first_pair", data);
    if (!assisted) firstEvent("first_unassisted_pair", data);
  }
  if (lesson < 0) helpFollowup("ordinary_move");
  const flightRects = [cell(a), cell(i)]
    .filter(Boolean)
    .map((n) => n!.getBoundingClientRect());
  busy = true;
  highlight = result.path;
  render();
  for (const n of [a, i]) cell(n)?.classList.add("erasing");
  const oldLength = values.length,
    next = removePair(values, a, i);
  const ending = lesson < 0 && !occupied(next);
  if (!ending) feedback("pair");
  // Commit the accepted move before awaiting a decorative animation.
  if (lesson < 0) {
    session = commit(session, next, "pair", viewport.scrollTop);
    removedPairs.set(session.current.board, [a, i]);
    hintIndex = 0;
    if (progress.active === "classic") {
      const gain = collectPair(progress, session.current.moves);
      if (gain) animateSeeds(flightRects, gain, ending);
    }
    if (!occupied(next)) complete(flightRects);
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
      shortLesson && lesson === 1
        ? "Играть в классику"
        : lesson === 5
          ? "Начать игру"
          : "Дальше";
    lessonQuick.hidden = !(shortLesson && lesson === 1);
  }
  clearSelection();
  busy = false;
  render();
  if (hadBoardFocus && !$("board").contains(document.activeElement))
    (
      $("board").querySelector<HTMLElement>("button") ??
      (lesson >= 0 ? $("lesson-next") : $("play-again"))
    ).focus({ preventScroll: true });
  if (lesson < 0 && !occupied(next))
    setTimeout(() => {
      void tryResultEngagement();
    }, 1500);
  if (lesson < 0 && occupied(next) && !availablePairs(next).length) {
    if (firstEvent("first_no_moves", { mode: gameMode() })) void save();
  }
  if (occupied(next) && next.length < oldLength && !reduced()) {
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
  maybeCelebrateResult();
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
  if(!helpPaused&&lesson<0&&!saveFailed&&hintAttempt(progress).help?.plan){
    const plan=currentPlan();
    if(plan?.complete)message("Цель плана достигнута");
    else if(plan?.pair)message("Уберите отмеченную пару");
    else message("Для возврата к Плану отмените ход");
  }
}
function add() {
  saveRecovered = false;
  if (busy || paused) return;
  markGameStarted();
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
    feedback("add");
    revealAddedCells(values.length, next.length);
    if (lesson === 5) message("Теперь нажмите «Отмена»");
  } catch {
    message(
      "Поле больше не расширяется. Отмените последний ход или начните новую партию.",
    );
  }
}
function undoAction() {
  saveRecovered = false;
  if (busy || paused || (lesson < 0 && !occupied(board()))) return;
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
  if (!session.history.length) return;
  clearBoardReveal();
  const restored = removedPairs.get(session.current.board);
  session = undo(session);
  clearSelection();
  render();
  const plan=currentPlan();
  if(plan?.pair)message("Уберите отмеченную пару");
  viewport.scrollTop = session.current.scroll;
  feedback("undo");
  if (restored)
    visibleCellEffects(
      restored,
      [{ background: "var(--selected)" }, { background: "transparent" }],
      220,
    );
  motion(
    $("undo").querySelector("svg"),
    [{ transform: "rotate(-18deg)" }, { transform: "rotate(0)" }],
    160,
  );
  save();
  platform.gameplay(occupied(board()) > 0);
}
async function hint() {
  saveRecovered = false;
  if (busy || paused || lesson >= 0 || hintPending) return;
  markGameStarted();
  const plan=currentPlan();
  if(plan?.pair){displayHint(plan.pair);message("Уберите отмеченную пару");return;}
  const available = availablePairs(board());
  const attempt = hintAttempt(progress);
  const choice = attempt.hintChoices?.[hintKey(board(), 0, 0)];
  const remembered =
    choice && available.find((p) => p.a === choice[0] && p.b === choice[1]);
  const paid = available.find((p) =>
    attempt.hintKeys?.includes(hintKey(board(), p.a, p.b)),
  );
  if (remembered || paid) highlight = remembered || paid || null;
  else if (progress.active !== "classic") {
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
    highlight = available[0];
  }
  if (!highlight) return;
  const intent = createHintIntent(highlight);
  verifiedHint = intent;
  highlight = null;
  if (monetized && !hintsLeft(progress) && !attempt.hintKeys?.includes(hintKey(intent.board, ...intent.pair))) {
    render(); offerHints(intent); return;
  }
  await revealHint(intent);
}
async function revealHint(intent: HelpIntent): Promise<boolean> {
  if (!validIntent(intent)) return false;
  const pair = checkPair(board(), ...intent.pair);
  if (!pair.ok) return false;
  const candidate = cloneProgress(progress), attempt = hintAttempt(candidate);
  const key = hintKey(intent.board, ...intent.pair);
  const repeated = attempt.hintKeys?.includes(key);
  if (monetized && !spendHint(candidate, key)) return false;
  (attempt.hintChoices ??= {})[hintKey(intent.board, 0, 0)] = [...intent.pair];
  if (!repeated) candidate.hints[candidate.active] = (candidate.hints[candidate.active] ?? 0) + 1;
  helpProfile(candidate).followup = intent;
  if (adsBridge) enqueueAnalytics(metadata(candidate), "assist_apply", {...helpData(intent), application_id: crypto.randomUUID(), outcome: repeated ? "repeat" : "revealed"});
  if (!await persistHelp(candidate)) {render(); return false;}
  if (!repeated) {
    track("hint_used", {mode: gameMode(), remaining: hintsLeft(progress)});
    firstEvent("first_hint", {mode: gameMode(), attempt: attempt.id});
    void save();
  }
  displayHint(pair.path); return true;
}
function displayHint(pair: Connection,quiet=false) {
  highlight = pair;
  selected = -1;
  render();
  if(!quiet)feedback("hint");
  visibleCellEffects(
    [highlight.a, highlight.b],
    [{ background: "var(--selected)" }, { background: "var(--highlight)" }],
    200,
  );
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
  message(hintExplanation(board(), highlight));
}
type CollectionScreen = "book" | "calendar" | "trophies" | "progress";
const navigationTrail: { screen: string; scroll: number; focus: string }[] = [];
let collectionTab: "jars" | "months" = "jars";
function rememberNavigation(target: string) {
  const screen = dialog.open ? dialog.dataset.screen || "home" : "game";
  if (screen === target) return;
  const element = document.activeElement as HTMLElement | null;
  navigationTrail.push({
    screen,
    scroll: dialogScroller().scrollTop,
    focus:
      element?.id ||
      (element?.dataset.month
        ? `month:${element.dataset.month}`
        : element?.dataset.volume
          ? `volume:${element.dataset.volume}`
          : ""),
  });
}
function returnToPrevious() {
  const previous = navigationTrail.pop();
  if (previous?.screen === "game") {
    closeMenu();
    return;
  }
  if (!previous || previous.screen === "home") openMenu(true);
  else if (previous.screen === "settings") openSettings(true);
  else openCollection(previous.screen as CollectionScreen, true);
  if (previous) {
    dialogScroller().scrollTop = previous.scroll;
    const target = previous.focus.startsWith("month:")
      ? dialog.querySelector<HTMLElement>(
          `[data-month="${previous.focus.slice(6)}"]`,
        )
      : previous.focus.startsWith("volume:")
        ? dialog.querySelector<HTMLElement>(
            `[data-volume="${previous.focus.slice(7)}"]`,
          )
        : document.getElementById(previous.focus);
    target?.focus({ preventScroll: true });
  }
}
function closeMenu() {
  if (lesson < 0) enteredGame = true;
  navigationTrail.length = 0;
  dialog.close();
  render();
  showSaveState();
  document.body.classList.remove("navigation-open");
  platform.gameplay(!paused && occupied(board()) > 0);
}
function navigateBack(native = false): boolean {
  if(closeHelpLab())return true;
  if (adActive || rewardRequest || engagementActive) return true;
  if (hintOffer.open) {
    hintOffer.close();
    return true;
  }
  if (busy) return true;
  if (dialog.open) {
    if ($("menu-content").hidden) returnToPrevious();
    else if (native) return false;
    else if (dialog.dataset.entry === "pause") closeMenu();
  } else if (lesson >= 0) finishLesson();
  else openMenu();
  return true;
}
function openMenu(preserve: unknown = false) {
  if (busy || adActive || rewardRequest || engagementActive) return;
  if (!dialog.open) dialog.dataset.entry = enteredGame ? "pause" : "root";
  if (preserve !== true) navigationTrail.length = 0;
  settlePresentation();
  releaseDialogHeading();
  updateHome();
  cancelHint();
  if (!busy) render();
  document.body.classList.add("navigation-open");
  dialog.dataset.screen = "home";
  $("settings-panel").hidden = true;
  renderHomeCurrent();
  $("collection").hidden = true;
  $("menu-content").hidden = false;
  $("confirm-content").hidden = true;
  if (!dialog.open) {
    dialog.showModal();
    dialogScroller().scrollTop = 0;
  }
  showSaveState();
  $("resume").focus({ preventScroll: true });
  platform.gameplay(false);
}
function reset() {
  if (busy || saveFailed || adActive || rewardRequest) return;
  if (progress.active === "classic") {
    void beginClassic(occupied(session.current.board) ? "restart" : "next");
    return;
  }
  settlePresentation();
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
  trackOpen("restart");
}
async function beginClassic(
  action: "restart" | "next",
  level = classicDifficulty(),
) {
  if (
    busy ||
    saveFailed ||
    futureSave ||
    storageConflict ||
    adActive ||
    rewardRequest ||
    engagementActive ||
    lesson >= 0
  )
    return;
  settlePresentation();
  const candidate: Progress = {
    ...progress,
    sessions: { ...progress.sessions },
    hints: { ...progress.hints },
    done: [...progress.done],
    seen: [...progress.seen],
    meta: {
      ...metadata(progress),
      attempts: { ...metadata(progress).attempts },
      classicDeals: readClassicDeals(metadata(progress).classicDeals),
      classicRun: readClassicRun(metadata(progress).classicRun),
    },
    jars: { ...jars(progress) },
  };
  const m = metadata(candidate);
  const previousAttempt = m.attempts.classic?.id ?? "";
  let next: Session | undefined;
  if (action === "restart") {
    next = restartClassic(session, m.classicDeals, previousAttempt);
    if (m.classicRun?.current?.attempt === previousAttempt)
      next.current.board = [...m.classicRun.current.board];
  }
  const highWater = jars(candidate).highWater;
  startAttempt(candidate, "classic");
  if (helpFlags.magnet || helpFlags.plan || helpProfile(candidate).inventory.magnet || helpProfile(candidate).inventory.plan) hintAttempt(candidate).help = {version:1,assisted:false};
  const attempt = m.attempts.classic.id;
  if (action === "next") m.classicRun ??= newClassicRun();
  let nextSession: Session;
  try {
    nextSession = next ?? takeGeneratedClassic(m.classicRun!, attempt, level);
    if (action === "next") delete m.classicDeals;
  } catch {
    message("Не удалось подготовить новую партию. Попробуйте ещё раз.");
    return;
  }
  if (action === "restart") {
    // Replaying the same field cannot repay already collected pairs.
    jars(candidate).highWater = highWater;
    if (m.classicDeals?.current?.attempt === previousAttempt)
      m.classicDeals.current.attempt = attempt;
    if (m.classicRun?.current?.attempt === previousAttempt)
      m.classicRun.current.attempt = attempt;
  }
  candidate.hints.classic = 0;
  candidate.active = "classic";
  busy = true;
  switching = true;
  dialog.inert = true;
  try {
    await save(candidate, nextSession);
    if (saveFailed || futureSave || storageConflict) return;
    progress = candidate;
    session = nextSession;
    busy = switching = false;
    dialog.inert = false;
    earnedAward = "";
    earnedSeeds = earnedHints = 0;
    saveRecovered = false;
    clearSelection();
    closeMenu();
    render();
    viewport.scrollTop = 0;
    trackOpen("restart");
  } finally {
    busy = switching = false;
    dialog.inert = false;
    showSaveState();
  }
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
let confirmAction: "restart" | "next" = "restart";
let confirmDifficulty: ClassicDifficulty = CLASSIC_DEFAULT;
function requestRestart(
  action: "restart" | "next" = "restart",
  level = classicDifficulty(),
) {
  if (
    busy ||
    saveFailed ||
    futureSave ||
    storageConflict ||
    adActive ||
    rewardRequest
  )
    return;
  confirmAction = action;
  confirmDifficulty = level;
  if (
    (!session.history.length &&
      !session.current.moves &&
      !session.current.additions) ||
    !occupied(session.current.board)
  ) {
    if (action === "next") void beginClassic("next", level);
    else reset();
    return;
  }
  const next = action === "next";
  confirmHeading.querySelector("h2")!.textContent = next
    ? level < classicDifficulty()
      ? "Партия полегче?"
      : "Новая партия?"
    : "Начать заново?";
  $("confirm-content").querySelector("p")!.textContent = next
    ? "Текущее поле и история отмены будут заменены. Собранные семечки и награды останутся."
    : "Вернуться к началу этого поля? История отмены будет очищена. Собранные семечки и награды останутся.";
  $("confirm-new").textContent = next ? "Начать новую партию" : "Начать заново";
  rememberNavigation("confirm");
  openMenu(true);
  dialog.dataset.screen = "confirm";
  $("menu-content").hidden = true;
  $("settings-panel").hidden = true;
  $("confirm-content").hidden = false;
  pinDialogHeading($("confirm-content"));
  $("confirm-back").focus({ preventScroll: true });
}
$("new").onclick = () => requestRestart();
$("next-classic").onclick = () => requestRestart("next");
$("menu-easier").onclick = () => {
  const level = classicDifficulty();
  if (level > CLASSIC_MIN)
    requestRestart("next", (level - 1) as ClassicDifficulty);
};
$("cancel-new").onclick = returnToPrevious;
function openSettings(restoring = false) {
  if (!restoring) rememberNavigation("settings");
  openMenu(true);
  $("menu-content").hidden = true;
  $("settings-panel").hidden = false;
  dialog.dataset.screen = "settings";
  updateReminderSettings();
  pinDialogHeading($("settings-panel"));
  if (!restoring) dialogScroller().scrollTop = 0;
  $("settings-back").focus({ preventScroll: true });
}
$("settings-open").onclick = () => openSettings();
$("settings-back").onclick = returnToPrevious;
$("privacy-open").onclick = () => {
  rememberNavigation("privacy");
  $("settings-panel").hidden = true;
  $("collection").hidden = false;
  dialog.dataset.screen = "privacy";
  $("collection").innerHTML =
    `<div class="screen-heading"><button id="privacy-back" class="text-button" aria-label="Назад">${icon("back")}</button><h2>О данных</h2></div><p>Партии, отмены и настройки хранятся на устройстве. Регистрация не нужна. Удаление данных приложения удалит прогресс.</p><p>В Android-версии AppMetrica и рекламный SDK Яндекса передают технические сведения об устройстве, установке, сеансах, сбоях и рекламе. Могут использоваться IP-адрес и рекламный идентификатор. Содержимое поля и полные сохранения в события аналитики не отправляются.</p><p>Напоминание о задаче дня включено по умолчанию и работает по местному времени на устройстве. Его можно выключить в настройках игры. Разрешение Android можно отключить в системных настройках.</p><p>Окно оценки обслуживает RuStore. Игра не получает текст отзыва и звёзды и не выдаёт за них награду.</p><p>Доступ к точному местоположению, камере, микрофону, контактам и файлам не запрашивается. Отслеживание геолокации AppMetrica отключено.</p><p>Полная политика и обращение к разработчику:</p><p><a href="https://github.com/DanilaH/seeds-bits/blob/main/store/PRIVACY.md" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a></p><p><a href="https://github.com/DanilaH/seeds-bits/issues" target="_blank" rel="noopener noreferrer">Связь с разработчиком</a></p>`;
  pinDialogHeading($("collection"));
  dialogScroller().scrollTop = 0;
  $("privacy-back").onclick = returnToPrevious;
  $("privacy-back").focus({ preventScroll: true });
};

$("confirm-new").onclick = () => {
  if (confirmAction === "next") void beginClassic("next", confirmDifficulty);
  else reset();
};
$("restart-task").onclick = () => requestRestart();
async function prepareResultTransition(route: "next" | "easier" | "harder" | "short") {
  if (busy || adActive || rewardRequest || engagementActive || lesson >= 0 || occupied(board())) return false;
  const policy = route !== "short" || helpFlags.result;
  const firstShort = route === "short" && !metadata(progress).flags?.includes("result_short_task_seen");
  if(firstShort)(metadata(progress).flags ??= []).push("result_short_task_seen");
  const assignment=helpProfile(progress).assignments.at(-1);
  const transition = {install:helpProfile(progress).install,experiment:assignment?.experiment??"none",variant:assignment?.variant??"control",qa:Boolean(qaProfile),config:assignment?.config??"none",route,first_short_task:firstShort,attempt:hintAttempt(progress).id,mode:gameMode(),policy_enabled:policy,ad_session_id:crypto.randomUUID()};
  busy = true;renderClassicChoices();
  durableEvent("result_transition",{...transition,phase:"choice"});
  await save();
  let reason = !policy ? "variant_off" : saveFailed || storageConflict || futureSave ? "save_blocked" :
    !appForeground || document.hidden ? "background" : skipNextInterstitial || performance.now()-lastExternalAt <= 30000 ? "external_suppression" : "request";
  if(reason === "request") {
    lastExternalAt=performance.now();
    const result=await showAd("interstitial",undefined,undefined,transition.ad_session_id);
    reason=result.reason ?? result.status ?? "unknown";
    track("result_transition",{...transition,phase:"result",reason,shown:Boolean(result.shown)});
  } else track("result_transition",{...transition,phase:"result",reason,shown:false});
  if(policy)skipNextInterstitial=false;
  busy=false;renderClassicChoices();
  return !saveFailed&&!storageConflict&&!futureSave;
}
async function playNextClassic(delta: -1 | 0 | 1 = 0) {
  const level=classicDifficulty()+delta;
  if(level<CLASSIC_MIN||level>CLASSIC_MAX)return;
  if(!await prepareResultTransition(delta<0 ? "easier" : delta>0 ? "harder" : "next"))return;
  const next=nextTask(progress.active,progress.done);
  if(next)await switchGame(next);
  else if(progress.active.startsWith("book"))openCollection("book");
  else if(progress.active.startsWith("daily"))openCollection("calendar");
  else await beginClassic("next",level as ClassicDifficulty);
}
$("play-again").onclick=()=>void playNextClassic();
$("classic-easier").onclick=()=>void playNextClassic(-1);
$("classic-harder").onclick=()=>void playNextClassic(1);
$("try-notebook").onclick=async()=>{
  const next=notebook.slice(0,24).find(p=>!progress.done.includes(p.id)) ?? notebook.find(p=>!progress.done.includes(p.id));
  if(next&&await prepareResultTransition("short"))await switchGame(next.id);
};
function seedWord(n: number) {
  const x = n % 100;
  return x >= 11 && x <= 14
    ? "семечек"
    : n % 10 === 1
      ? "семечко"
      : n % 10 >= 2 && n % 10 <= 4
        ? "семечки"
        : "семечек";
}
function hintWord(n: number) {
  const x = n % 100;
  return x >= 11 && x <= 14
    ? "подсказок"
    : n % 10 === 1
      ? "подсказка"
      : n % 10 >= 2 && n % 10 <= 4
        ? "подсказки"
        : "подсказок";
}
$("learn").onclick = () => startLesson();
$("skip").onclick = () => finishLesson("skip");
$("lesson-next").onclick = () => {
  if (lesson === 5 || (shortLesson && lesson === 1)) finishLesson("complete");
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
    platform.setHapticState(settings.vibration, paused);
    if (settings[key] || key === "sound") feedback("button");
    if (key === "sound" && !settings.sound) suspendSound();
    save();
  };
$("retry-save").onclick = async () => {
  await save();
  if (saveFailed || storageConflict || futureSave) return;
  // A failed reward save leaves its native receipt pending until a durable retry.
  try {
    const pending = await adsBridge?.pending();
    if (pending?.reward) await receiveReward(pending.reward);
  } catch {
    // Keep the receipt for the next retry or launch; the game remains usable.
  }
  await applyEarnedHelp();
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
window.addEventListener("resize", () => {
  settlePresentation();
  drawPath(highlight);
});
document.addEventListener("visibilitychange", () => {
  syncPauseState();
  if (paused && !busy) save();
});
window.addEventListener("pagehide", () => {
  if (!busy) save();
});
async function boot() {
  let warning = "";
  let hadStoredState = false;
  try {
    const bundle = await platform.read(PROGRESS);
    hadStoredState = Boolean(bundle);
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
          await preserveUnreadSave(bundle);
        } catch {
          /* Warning remains visible even when backup storage is unavailable. */
        }
        throw error;
      }
      if (readWarning) {
        try {
          await preserveUnreadSave(bundle);
        } catch {
          /* Keep the recovery notice. */
        }
      }
      session = progress.sessions[progress.active];
    } else {
      const stored = await platform.read(KEY);
      hadStoredState = Boolean(stored);
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
    const raw = await platform.readSettings(SETTINGS);
    if (raw) {
      const s = JSON.parse(raw);
      settings = {
        theme: s.theme === "dark" ? "dark" : "light",
        sound: s.sound === true,
        vibration: s.vibration !== false,
        tutorialDone: s.tutorialDone === true,
        reminders: s.reminders !== false,
        reminderTime:
          typeof s.reminderTime === "string" &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(s.reminderTime)
            ? s.reminderTime
            : "12:30",
      };
    }
  } catch {
    /* Defaults remain usable. */
  }
  try {
    recoveryAvailable = restorable(await platform.read(PROGRESS + ".recovery"));
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
  metadata(progress).analyticsCohort ??=
    hadStoredState || settings.tutorialDone || readWarning
      ? "legacy"
      : "fresh-v2";
  jars(progress);
  visualSeeds = jars(progress).meter;
  selectedVolume = progress.active.startsWith("book")
    ? volumeOf(progress.active)
    : 0;
  applyTheme();
  platform.setHapticState(settings.vibration, paused);
  $<HTMLInputElement>("sound").checked = settings.sound;
  $<HTMLInputElement>("vibration").checked = settings.vibration;
  render();
  viewport.scrollTop = session.current.scroll;
  try {
    await platform.initPlatform(
      () => {
        platformPaused = true;
        syncPauseState();
        if (!busy) save();
      },
      () => {
        platformPaused = false;
        syncPauseState();
      },
    );
  } catch {
    warning = "Сервис площадки недоступен. Можно играть без него.";
  }
  if (!hadStoredState && (helpFlags.magnet || helpFlags.plan)) hintAttempt(progress).help = {version:1,assisted:false};
  const profile = helpProfile(progress), beforeAssignments = new Set(profile.assignments.map(a=>a.experiment));
  const assignment = assignHelp(profile, hadStoredState);
  if (!beforeAssignments.has(assignment.experiment) && adsBridge) enqueueAnalytics(metadata(progress), "experiment_assignment", {...assignment});
  if (qaProfile) {
    const label = document.createElement("span"); label.id = "qa-profile";
    label.textContent = `QA · ${qaProfile==="baseline"?"обычная игра":qaProfile==="all"?"все фичи":qaProfile} · тестовая реклама`; $("menu-content").append(label);
  }
  await save();
  await adsBridge?.configureContext?.({...assignment, anchor: String(assignment.anchor), qa: String(assignment.qa)}).catch(() => {});
  experience(progress).sessions++;
  await initializeMonetization(() => syncPauseState(), receiveReward);
  if (
    !futureSave &&
    !readWarning &&
    lastStored &&
    adsBridge &&
    metadata(progress).analytics?.length
  )
    // A failed SharedPreferences commit can remain in process memory. A read on
    // WebView recreation is not a disk acknowledgement: confirm it with a write.
    await save();
  if (engagementBridge)
    try {
      await engagementBridge.addListener("dailyOpen", () => {
        pendingDailyOpen = true;
        void openDailyNotification();
      });
      const config = await engagementBridge.configuration();
      engagementAvailable = config.available;
      notificationGranted = config.granted;
      pendingDailyOpen = Boolean(config.entry);
    } catch {}
  syncPauseState();
  trackOpen("resume");
  void platform
    .listenAppState((active) => {
      appForeground = active;
      if (!active && !adActive && !rewardRequest && !engagementActive)
        backgroundAt = Date.now();
      if (active) {
        if (
          backgroundAt !== undefined &&
          Date.now() - backgroundAt >= 30 * 60 * 1000
        )
          experience(progress).sessions++;
        backgroundAt = undefined;
        if (engagementBridge)
          void engagementBridge
            .configuration()
            .then((c) => {
              notificationGranted = c.granted;
              updateReminderSettings();
              if (c.entry) {
                pendingDailyOpen = true;
                void openDailyNotification();
              }
            })
            .catch(() => {});
      }
      syncPauseState();
      if (active) void openDailyNotification();
      if (!active && !busy) save();
    })
    .catch(() => {});
  void platform.listenBack(() => navigateBack(true)).catch(() => {});
  if (!settings.tutorialDone) startLesson(true);
  else openMenu();
  bootComplete = true;
  await openDailyNotification();
  platform.ready();
  platform.gameplay(!paused && !dialog.open);
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
  earnedSeeds = 0;
  earnedHints = 0;
  saveRecovered = false;
  if (busy || futureSave || storageConflict) return;
  if (id.startsWith("daily") && !availableDay(id.slice(9))) return;
  if (id.startsWith("book") && volumeOf(id) > 0) {
    busy = true;
    dialog.inert = true;
    document.getElementById("book-load-error")?.remove();
    const loading = document.createElement("p");
    loading.setAttribute("role", "status");
    loading.textContent = "Открываю тетрадь…";
    $("collection").prepend(loading);
    try {
      await loadNotebook();
    } catch {
      const error = document.createElement("div");
      error.id = "book-load-error";
      error.setAttribute("role", "alert");
      const text = document.createElement("p");
      text.textContent =
        "Не удалось открыть тетрадь. Перезагрузите игру, чтобы повторить загрузку. Текущая партия будет сохранена.";
      const retry = document.createElement("button");
      retry.className = "secondary";
      retry.textContent = "Сохранить и перезагрузить";
      retry.onclick = async () => {
        retry.disabled = true;
        await save();
        if (!saveFailed && !futureSave && !storageConflict) location.reload();
        else retry.disabled = false;
      };
      error.append(text, retry);
      $("collection").prepend(error);
      return;
    } finally {
      loading.remove();
      busy = false;
      dialog.inert = false;
    }
  }

  if (lesson < 0 && !busy) session.current.scroll = viewport.scrollTop;
  if (lesson >= 0) {
    if (!metadata(progress).flags?.includes("tutorial_end"))
      firstEvent("tutorial_end", { outcome: "skip", step: lesson + 1 });
    settings.tutorialDone = true;
    settingsDirty.tutorialDone = true;
  }
  progress.sessions[progress.active] = session;
  settlePresentation();
  // Sessions are replaced on moves; retain their immutable histories and caches.
  const candidate: Progress = {
    ...progress,
    sessions: { ...progress.sessions },
    hints: { ...progress.hints },
    done: [...progress.done],
    seen: [...progress.seen],
    meta: progress.meta
      ? { ...progress.meta, attempts: { ...progress.meta.attempts } }
      : undefined,
    jars: progress.jars ? { ...progress.jars } : undefined,
  };
  if (
    progress.active !== id &&
    progress.active !== "classic" &&
    !occupied(session.current.board)
  ) {
    candidate.sessions[progress.active] = {
      ...candidate.sessions[progress.active],
      history: [],
    };
    const previous = metadata(candidate).attempts[progress.active];
    if (previous?.completed) {
      candidate.meta!.attempts[progress.active] = { ...previous };
      delete candidate.meta!.attempts[progress.active].hintKeys;
      delete candidate.meta!.attempts[progress.active].hintChoices;
    }
  }

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
  trackOpen("switch");
}
const months = () =>
  Array.from(
    { length: 12 },
    (_, i) => `${trophyYear}-${String(i + 1).padStart(2, "0")}`,
  ).filter((m) => m >= FIRST_MONTH && m <= today().slice(0, 7));
const monthName = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString(
    "ru",
    { month: "long", year: "numeric" },
  );
function openCollection(kind: CollectionScreen, restoring = false) {
  if (busy) return;
  const sameScreen = dialog.open && dialog.dataset.screen === kind;
  const oldScroll = dialogScroller().scrollTop;
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusVolume = focused?.dataset.volume;
  const pickerOpen = (
    document.getElementById("calendar-picker") as HTMLDetailsElement | null
  )?.open;
  if (!restoring) rememberNavigation(kind);
  openMenu(true);
  dialog.dataset.screen = kind;
  $("menu-content").hidden = true;
  const panel = $("collection");
  panel.hidden = false;
  let html = `<button class="text-button screen-back" id="collection-back" aria-label="Назад">${icon("back")}</button>`;
  if (kind === "progress") {
    const m = metadata(progress);
    const completedBook = notebook.filter((p) =>
      progress.done.includes(p.id),
    ).length;
    const completedDaily = progress.done.filter(
      (id) =>
        id.startsWith("daily-v1-") && availableDay(id.slice(9), "9999-12-31"),
    ).length;
    const j = jarState(jars(progress).meter);
    const nextVolume = nextBookVolume();
    const nextDone = volumeTasks(nextVolume).filter((p) =>
      progress.done.includes(p.id),
    ).length;
    html += `<h2>Прогресс</h2>${jarHero(j)}<button id="progress-trophies" class="secondary">Баночки и трофеи ${icon("arrow")}</button><button id="progress-book" class="progress-book"><span><strong>Тетрадь ${nextVolume + 1}</strong><small>${nextDone} из 24 задач</small></span>${icon("arrow")}<progress max="24" value="${nextDone}" aria-label="Тетрадь ${nextVolume + 1}"></progress></button><dl class="progress-stats"><div><dt>Задачи в тетрадях</dt><dd>${completedBook} из ${notebook.length}</dd></div><div><dt>Задачи дня</dt><dd>${completedDaily}</dd></div><div><dt>Завершено партий</dt><dd>${m.completed}</dd></div><div><dt>Без подсказок</dt><dd>${m.unassisted}</dd></div></dl><details class="explanation"><summary>Как считается прогресс</summary><p>Партии и прохождения без подсказок считаются с ${new Date(m.since).toLocaleDateString("ru")}. Старые отметки задач сохранены.</p></details><p class="fine">Прогресс сохраняется на этом устройстве.</p>`;
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
    const chapter = Math.floor(selectedVolume / 10);
    const chapterCandidates = candidates.filter(
      (v) => Math.floor(v / 10) === chapter,
    );
    if (!chapterCandidates.includes(selectedVolume) && chapterCandidates.length)
      selectedVolume = chapterCandidates[0];
    const stats = status(selectedVolume);
    html += `<h2>Тетради</h2><p class="intro book-total">100 тетрадей · 2400 задач</p><div class="archive-controls"><label>Раздел<select id="book-chapter">${chapterNames.map((n, i) => `<option value="${i}" ${i === chapter ? "selected" : ""}>${i + 1}. ${n}</option>`).join("")}</select></label><label>Показать<select id="book-filter">${[
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
          `<button class="volume-cover ${v === selectedVolume ? "current" : ""}" data-volume="${v}" aria-pressed="${v === selectedVolume}" aria-label="Тетрадь ${v + 1}, ${status(v).n} из 24"><strong>${v + 1}${status(v).n === 24 ? '<span class="volume-done">✓</span>' : ""}</strong><small>${status(v).n}/24</small><progress max="24" value="${status(v).n}" aria-hidden="true"></progress></button>`,
      )
      .join("")}</div>`;
    if (chapterCandidates.length) {
      const tasks = volumeTasks(selectedVolume);
      const continuing =
        tasks.find((p) => p.id === progress.active && !finished.has(p.id)) ??
        tasks.find(
          (p) => progress.sessions[p.id]?.history.length && !finished.has(p.id),
        ) ??
        tasks.find((p) => !finished.has(p.id)) ??
        tasks[0];
      html += `<div class="volume-heading"><h3>Тетрадь ${selectedVolume + 1}</h3><span>${stats.n}/24</span></div><button class="primary" id="continue-book" data-continue="${continuing.id}">${stats.n === 24 ? "Повторить" : stats.started ? "Продолжить" : "Начать"} · задача ${Number(continuing.id.slice(8)) - selectedVolume * 24}</button>`;
      for (let page = 0; page < 4; page++) {
        const group = tasks.slice(page * 6, page * 6 + 6),
          n = group.filter((p) => finished.has(p.id)).length;
        html += `<section class="book-page ${n === 6 ? "page-done" : ""}"><div class="page-heading"><h3>Страница ${page + 1}</h3><span>${n}/6</span></div><div class="task-grid">${group.map((p, i) => `<button class="task ${finished.has(p.id) ? "done" : ""}" data-game="${p.id}" ${p.id === progress.active ? 'aria-current="true"' : ""} aria-label="Задача ${selectedVolume * 24 + page * 6 + i + 1}${finished.has(p.id) ? ", решена" : ""}">${page * 6 + i + 1}${finished.has(p.id) ? "<small>✓</small>" : ""}</button>`).join("")}</div>${n === 6 ? '<p class="stamp">Завершено ✓</p>' : ""}</section>`;
      }
    } else
      html +=
        '<div class="empty-state"><p>В этом разделе нет тетрадей с таким статусом.</p><button id="book-filter-reset" class="secondary">Показать все в разделе</button></div>';
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
    html += `<h2>Задача дня</h2>${streakPanel()}<button class="primary calendar-today" id="today-task">${progress.done.includes("daily-v1-" + today()) ? "Повторить сегодняшнюю" : "Играть сегодня"}</button><div class="month-nav calendar-nav"><button id="prev-month" aria-label="Предыдущий месяц" ${calendarMonth <= FIRST_MONTH ? "disabled" : ""}>${icon("back")}</button><details id="calendar-picker" ${pickerOpen ? "open" : ""}><summary aria-label="Выбрать месяц">${monthName(calendarMonth)}</summary>${calendarControls()}</details><button id="next-month" aria-label="Следующий месяц" ${calendarMonth >= today().slice(0, 7) ? "disabled" : ""}>${icon("arrow")}</button></div><div class="calendar">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((x) => `<span>${x}</span>`).join("")}${"<i></i>".repeat(weekday)}${days(
      calendarMonth,
    )
      .map(
        (d) =>
          `<button class="task ${progress.done.includes("daily-v1-" + d) ? "done" : ""} ${d === today() ? "today" : ""}" data-game="daily-v1-${d}" ${!availableDay(d) ? "disabled" : ""} aria-label="${d}${progress.done.includes("daily-v1-" + d) ? ", решена" : ""}">${Number(d.slice(-2))}${progress.done.includes("daily-v1-" + d) ? "<small>✓</small>" : ""}</button>`,
      )
      .join(
        "",
      )}</div><section class="calendar-trophies" aria-label="Трофеи месяца">${trophyMark(calendarMonth, t.count, days(calendarMonth).length)}</section><p>${t.count} из ${days(calendarMonth).length} задач решено</p><p class="fine">Прошедшие дни доступны в любое время.</p><details class="explanation"><summary>Как считается серия</summary><p>Решайте сегодняшнюю задачу в её день. Архив идёт в трофеи месяца. За третий день серии — 1 подсказка, за каждые семь дней подряд — 3. Награды поступают в общий запас автоматически. После пропуска сохраняются рекорд и награды. Задача, законченная после полуночи, остаётся в архиве, но уже не увеличивает серию за вчера.</p></details><details class="explanation"><summary>Трофеи месяца</summary><p>Бронза — 7 задач, серебро — 14, золото — весь месяц.</p></details>`;
  } else {
    html += `<h2>Коллекция</h2><div class="collection-tabs" role="group" aria-label="Раздел коллекции"><button id="jars-tab" aria-pressed="${collectionTab === "jars"}">Баночки</button><button id="trophies-mode" aria-pressed="${collectionTab === "months"}">Трофеи месяца</button></div>`;
    const j = jarState(jars(progress).meter);
    jarShelfPage = Math.min(
      jarShelfPage,
      Math.max(0, Math.ceil(j.index / 12) - 1),
    );
    const shelfEnd = j.index - jarShelfPage * 12,
      shelfStart = Math.max(0, shelfEnd - 12);
    html += `<section class="jar-collection" ${collectionTab !== "jars" ? "hidden" : ""}><h3>Баночки</h3><p>${j.index} собрано · ${jars(progress).seeds} семечек</p>${jarHero(j)}<div class="jar-shelf">${Array.from(
      { length: shelfEnd - shelfStart },
      (_, n) => {
        const i = shelfStart + n;
        return `<div class="jar-keepsake" style="--jar-color:${jarColors[i % 6]};--fill:100%"><span class="jar-glass"><span class="jar-fill"></span><span class="jar-lid"></span></span><small>${jarNames[i % 6]} · ${i + 1}</small></div>`;
      },
    ).join(
      "",
    )}</div><div class="month-nav" ${j.index ? "" : "hidden"}><button id="older-jars" ${shelfStart === 0 ? "disabled" : ""}>Раньше</button><span>${j.index ? `${shelfStart + 1}–${shelfEnd}` : "Пока пусто"}</span><button id="newer-jars" ${jarShelfPage === 0 ? "disabled" : ""}>Новее</button></div>${j.index ? "" : '<button id="jar-play" class="primary">Играть в классику</button>'}<details class="explanation"><summary>Как заполняются баночки</summary><p>В классике — две семечки за новый ход. Первая победа в задаче тетради или календаря тоже пополняет банку: от 4 до 24 семечек в зависимости от размера поля. Повторы не начисляются. После отмены в классике нужно пройти дальше прежнего хода.</p></details><p>Полностью очищено полей: ${jars(progress).wins}</p><p class="fine">${jars(progress).wins >= 100 ? "Мастер · 100 полей" : jars(progress).wins >= 25 ? "Знаток · 25 полей" : jars(progress).wins >= 5 ? "Уверенный старт · 5 полей" : "Первая отметка мастерства — за 5 очищенных полей"}</p></section>`;
    html += `<section class="monthly-collection" ${collectionTab !== "months" ? "hidden" : ""}><p class="fine">Бронза — 7 задач · серебро — 14 · золото — весь месяц</p><label class="year-picker">Год трофеев<select id="trophy-year">${years()
      .map((y) => `<option ${y === trophyYear ? "selected" : ""}>${y}</option>`)
      .join("")}</select></label>`;
    for (const m of months()
      .filter((m) => m.startsWith(trophyYear))
      .reverse()) {
      const t = trophy(m, progress.done);
      html += `<button class="trophy tier-${t.tier}" data-month="${m}"><span class="trophy-heading"><strong>${monthName(m)}</strong><small>${t.count}/${days(m).length} дней</small></span>${trophyMark(m, t.count, days(m).length)}</button>`;
    }
  }
  if (kind === "trophies") html += "</section>";
  panel.innerHTML = html;
  if (kind === "calendar") {
    const layout = document.createElement("div");
    layout.className = "calendar-layout";
    const activity = document.createElement("section");
    activity.className = "calendar-activity";
    const month = document.createElement("section");
    month.className = "calendar-month";
    for (const node of [...panel.children]) {
      if (node.matches(".screen-back,h2")) continue;
      (node.matches(".daily-run,#today-task") ? activity : month).append(node);
    }
    layout.append(activity, month);
    panel.append(layout);
  }
  if (kind === "trophies") {
    const jars = panel.querySelector(".jar-collection")!;
    const overview = document.createElement("div");
    overview.className = "jar-overview";
    const history = document.createElement("div");
    history.className = "jar-history";
    const summary = jars.querySelector("p");
    for (const node of [...jars.children])
      (node.matches("h3,.progress-hero") || node === summary
        ? overview
        : history
      ).append(node);
    jars.append(overview, history);
  }
  if (kind === "book") {
    const resume = document.createElement("section");
    resume.className = "book-resume";
    const heading = panel.querySelector(".volume-heading"),
      button = document.getElementById("continue-book");
    if (heading && button) {
      resume.append(heading, button);
      panel.append(resume);
    }
    const browser = document.createElement("section");
    browser.className = "book-browser";
    browser.setAttribute("aria-label", "Выбор тетради");
    for (const selector of [
      ".book-total",
      ".archive-controls",
      ".volume-shelf",
    ])
      if (panel.querySelector(selector))
        browser.append(panel.querySelector(selector)!);
    panel.append(browser);
    const pages = document.createElement("div");
    pages.className = "book-pages";
    pages.append(...panel.querySelectorAll(".book-page"));
    panel.append(pages);
  }
  const screenHeading = document.createElement("div");
  screenHeading.className = "screen-heading";
  screenHeading.append($("collection-back"), panel.querySelector("h2")!);
  panel.prepend(screenHeading);
  pinDialogHeading(panel);
  if (kind === "progress") {
    $("progress-trophies").onclick = () => openCollection("trophies");
    $("progress-book").onclick = () => {
      selectedVolume = nextBookVolume();
      openCollection("book");
    };
  }
  $("collection-back").onclick = returnToPrevious;
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
    if ($("book-filter-reset"))
      $("book-filter-reset").onclick = () => {
        bookFilter = "all";
        openCollection("book");
      };
    if ($("continue-book"))
      $("continue-book").onclick = () =>
        switchGame($("continue-book").dataset.continue!);
    $("book-filter").onchange = () => {
      bookFilter = $<HTMLSelectElement>("book-filter").value;
      openCollection("book");
    };
    $("book-chapter").onchange = () => {
      selectedVolume = Number($<HTMLSelectElement>("book-chapter").value) * 10;
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
    if ($("jar-play")) $("jar-play").onclick = () => switchGame("classic");
    $("jars-tab").onclick = () => {
      collectionTab = "jars";
      openCollection("trophies");
    };
    $("trophies-mode").onclick = () => {
      collectionTab = "months";
      openCollection("trophies");
    };
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
  if (sameScreen) {
    dialogScroller().scrollTop = oldScroll;
    if (focusId)
      document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (focusVolume)
      panel
        .querySelector<HTMLElement>(`[data-volume="${focusVolume}"]`)
        ?.focus({ preventScroll: true });
  } else if (!restoring) dialogScroller().scrollTop = 0;
}
$("classic-mode").onclick = () => switchGame("classic");
$("book-mode").onclick = () => openCollection("book");
$("daily-mode").onclick = () => switchGame(daily(today()).id);
$("calendar-open").onclick = () => {
  calendarMonth = today().slice(0, 7);
  openCollection("calendar");
};
$("progress-open").onclick = () => openCollection("progress");
function nextBookVolume() {
  if (progress.active.startsWith("book")) return volumeOf(progress.active);
  const first = notebook.findIndex((p) => !progress.done.includes(p.id));
  return Math.max(0, Math.floor(first / 24));
}
function jarPicture(j: ReturnType<typeof jarState>) {
  return `<span class="jar-picture" style="--fill:${j.percent}%;--jar-color:${j.color}" aria-hidden="true"><span class="jar-glass"><span class="jar-fill"></span><span class="jar-lid"></span></span></span>`;
}
function jarHero(j: ReturnType<typeof jarState>) {
  return `<section class="progress-hero" aria-label="Следующая баночка">${jarPicture(j)}<div><span class="hero-kicker">Баночка ${j.index + 1} · ${j.name}</span><p class="hero-value">${j.percent}<span>%</span></p><p class="hero-count">${j.filled} из ${j.capacity} семечек</p><progress max="${j.capacity}" value="${j.filled}" aria-label="Заполнение баночки"></progress><p class="fine">До следующей — ${j.capacity - j.filled}</p></div></section>`;
}
function difficultyLabel() {
  const level = classicDifficulty();
  return `${classicDifficultyNames[level]}${level === CLASSIC_MIN ? " · минимум" : level === CLASSIC_MAX ? " · максимум" : ""}`;
}
function renderHomeCurrent() {
  const count = occupied(board()),
    classicMode = progress.active === "classic";
  $("home-difficulty").hidden = !classicMode || lesson >= 0;
  $("home-difficulty").textContent =
    `${classicDifficultyNames[classicDifficulty()]} сложность${classicDifficulty() === CLASSIC_MIN ? " · минимум" : classicDifficulty() === CLASSIC_MAX ? " · максимум" : ""}`;
  homeGoal.hidden = lesson >= 0;
  $("next-classic").hidden = !classicMode || lesson >= 0;
  $("menu-easier").hidden = !classicMode || lesson >= 0 || !count;
  $<HTMLButtonElement>("menu-easier").disabled =
    classicDifficulty() === CLASSIC_MIN;
  $("new").hidden =
    lesson >= 0 ||
    (classicMode && !count) ||
    (dialog.dataset.entry !== "pause" && count > 0 && !session.history.length);
  $("new").textContent = classicMode
    ? count
      ? "Начать заново"
      : "Новая партия"
    : count
      ? "Начать задачу заново"
      : "Повторить задачу";
  if (lesson >= 0) {
    $("classic-mode").hidden = false;
    $("home-eyebrow").textContent = "Как играть";
    $("home-game-title").textContent = "Обучение";
    $("resume-context").textContent =
      `Шаг ${lesson + 1} из ${shortLesson ? 2 : lessons.length}`;
    $("resume").textContent = "Продолжить обучение";
    return;
  }
  $("classic-mode").hidden = classicMode;
  $("home-eyebrow").textContent = !count
    ? "Партия завершена"
    : session.history.length
      ? "Текущая партия"
      : "Игра";
  $("home-game-title").textContent = classicMode
    ? "Классика"
    : progress.active.startsWith("book")
      ? `Тетрадь ${volumeOf(progress.active) + 1}`
      : "Задача дня";
  $("resume-context").textContent = classicMode
    ? `${count} ${digitWord(count)} на поле`
    : progress.active.startsWith("book")
      ? `Задача ${((Number(progress.active.slice(8)) - 1) % 24) + 1} · ${count} ${digitWord(count)}`
      : `${progress.active.slice(9).split("-").reverse().join(".")} · ${count} ${digitWord(count)}`;
  $("resume").textContent = !count
    ? "Посмотреть результат"
    : session.history.length
      ? "Продолжить"
      : classicMode
        ? "Начать классику"
        : "Играть";
  if (classicMode) {
    const j = jarState(jars(progress).meter);
    homeGoal.innerHTML = `${jarPicture(j)}<div><strong>Баночка ${j.index + 1} · ${j.percent}%</strong><span>${j.filled} из ${j.capacity} семечек</span><progress max="${j.capacity}" value="${j.filled}" aria-label="Заполнение баночки"></progress></div>`;
  } else {
    const done = progress.active.startsWith("book")
      ? volumeTasks(volumeOf(progress.active)).filter((p) =>
          progress.done.includes(p.id),
        ).length
      : trophy(progress.active.slice(9, 16), progress.done).count;
    const total = progress.active.startsWith("book")
      ? 24
      : days(progress.active.slice(9, 16)).length;
    homeGoal.innerHTML = `<div><strong>${done} из ${total} задач</strong><progress max="${total}" value="${done}" aria-label="Пройденные задачи"></progress></div>`;
  }
}
function updateHome() {
  const finished = new Set(progress.done);
  $("book-count").textContent =
    `${notebook.filter((p) => finished.has(p.id)).length} из ${notebook.length} решено`;
  const id = `daily-v1-${today()}`;
  const run = dailyRun(progress);
  $("daily-series").hidden = run.count === 0;
  $("daily-series").textContent =
    `${run.count} ${dayWord(run.count)} подряд${run.solvedToday ? "" : ` · до награды ${run.until} ${dayWord(run.until)}`}`;
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
    const scroll = dialogScroller().scrollTop;
    openCollection("calendar");
    const target = game
      ? dialog.querySelector<HTMLElement>(`[data-game="${game}"]`)
      : id
        ? document.getElementById(id)
        : null;
    if (target && !(target as HTMLButtonElement).disabled)
      target.focus({ preventScroll: true });
    dialogScroller().scrollTop = scroll;
  }
  if (!occupied(board())) renderWin();
}
setInterval(refreshDate, 1000);
window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", refreshDate);

clearContact = installInterfaceMotion(
  control => {if(!control.closest("#help-lab"))feedback("button");},
  () => paused || document.hidden,
);
void boot();

function renderJar() {
  const meter = $("jar-meter");
  meter.hidden = lesson >= 0;
  (document.querySelector("header .brand") as HTMLElement).hidden =
    !meter.hidden;
  if (meter.hidden) return;
  visualSeeds ??= jars(progress).meter;
  const j = jarState(visualSeeds);
  const celebrating = completedJar && performance.now() < completedJar.until;
  if (celebrating) {
    j.index = completedJar!.index;
    j.percent = 100;
    j.filled = j.capacity = completedJar!.capacity;
    j.name = jarNames[j.index % 6];
    j.color = jarColors[j.index % 6];
  }
  meter.style.setProperty("--jar-color", j.color);
  meter.style.setProperty("--fill", `${j.percent}%`);
  $("jar-name").textContent = `Баночка ${j.index + 1}`;
  $("jar-percent").textContent = `${j.percent}%`;
  meter.dataset.full = String(Boolean(celebrating));
  $("jar-collected").title = celebrating ? "Баночка собрана" : "";
  meter.dataset.filled = String(j.filled);
  meter.dataset.capacity = String(j.capacity);
  meter.setAttribute(
    "aria-label",
    `Баночка ${j.index + 1}${celebrating ? ", собрана" : ""}, заполнено ${j.percent} процентов, ${j.filled} из ${j.capacity}. Открыть коллекцию`,
  );
}
$("jar-meter").onclick = () => {
  collectionTab = "jars";
  openCollection("trophies");
};

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

function dayWord(n: number) {
  const x = n % 100;
  return x >= 11 && x <= 14
    ? "дней"
    : n % 10 === 1
      ? "день"
      : n % 10 >= 2 && n % 10 <= 4
        ? "дня"
        : "дней";
}
function streakPanel() {
  const r = dailyRun(progress),
    base = Math.floor(Math.max(0, r.nextCount - 1) / 7) * 7;
  return `<section class="daily-run" aria-label="Серия дней"><div class="run-heading"><strong>${r.count ? `${r.count} ${dayWord(r.count)} подряд` : "Новая серия"}</strong><span>Рекорд · ${r.best}</span></div><div class="run-days">${Array.from(
    { length: 7 },
    (_, i) => {
      const n = base + i + 1;
      return `<span class="${n <= r.count ? "done" : n === r.nextCount ? "next" : ""}" aria-label="${n}-й день${n <= r.count ? ", засчитан" : ""}">${n <= r.count ? "✓" : n}</span>`;
    },
  ).join(
    "",
  )}</div><p>До награды: ${r.until} ${dayWord(r.until)} · +${streakReward(r.nextMilestone)} ${hintWord(streakReward(r.nextMilestone))}</p></section>`;
}
function firstEvent(
  name: string,
  data: Record<string, string | number | boolean> = {},
) {
  const m = metadata(progress);
  if (m.flags?.includes(name)) return false;
  (m.flags ??= []).push(name);
  durableEvent(name, data);
  return true;
}
function updateReminderSettings() {
  $("reminder-settings").hidden = !engagementAvailable;
  $<HTMLInputElement>("reminders").checked = settings.reminders;
  $<HTMLInputElement>("reminder-time").value = settings.reminderTime;
  const requested = Boolean(
    metadata(progress).flags?.includes("reminder_permission_requested"),
  );
  const failed = metadata(progress).flags?.includes(
    "reminder_permission_error",
  );
  const denied = !notificationGranted && requested && !failed;
  const pending =
    !notificationGranted && ((settings.reminders && !requested) || failed);
  $<HTMLInputElement>("reminders").disabled = notificationRequestPending;
  $<HTMLButtonElement>("notification-permission-request").disabled =
    notificationRequestPending;
  $("reminder-permission").textContent = notificationRequestPending
    ? notificationSaving
      ? "Сохраняем настройки…"
      : "Ожидаем ответ Android…"
    : notificationGranted
      ? settings.reminders
        ? "Напоминание включено."
        : "Напоминание выключено."
      : failed
        ? "Не удалось открыть запрос Android. Можно повторить или разрешить уведомления в системных настройках."
        : denied
          ? "Уведомления отключены в Android. Разрешите их в системных настройках, затем включите напоминание."
          : pending
            ? "Нужно разрешение Android. Запросим его после первой пройденной задачи дня. Можно разрешить сейчас."
            : "";
  $("notification-permission-request").hidden =
    !pending || notificationRequestPending;
  $("notification-permission-request").textContent = failed
    ? "Повторить запрос"
    : "Разрешить уведомления";
  $("notification-system-settings").hidden =
    notificationRequestPending || notificationGranted || (!denied && !failed);
  const wallet = metadata(progress).wallet;
  $("hint-wallet").textContent =
    `Общий запас: ${wallet} ${hintWord(wallet)}. Сначала расходуются три бесплатные подсказки текущей партии.`;
}
async function enableReminder(enabled: boolean) {
  if (
    !engagementBridge ||
    engagementActive ||
    busy ||
    adActive ||
    rewardRequest
  )
    return;
  if (!enabled) {
    const flags = metadata(progress).flags;
    const errorIndex = flags?.indexOf("reminder_permission_error") ?? -1;
    if (errorIndex >= 0) flags!.splice(errorIndex, 1);
  }
  if (enabled && !notificationGranted) {
    engagementActive = true;
    notificationRequestPending = true;
    notificationSaving = true;
    skipNextInterstitial = true;
    lastExternalAt = performance.now();
    syncPauseState();
    const flags = (metadata(progress).flags ??= []);
    const firstRequest = !flags.includes("reminder_permission_requested");
    if (firstRequest) flags.push("reminder_permission_requested");
    try {
      // Save before Android's dialog so a process restart cannot repeat the request.
      await save();
      if (saveFailed || storageConflict || futureSave) {
        if (firstRequest)
          flags.splice(flags.indexOf("reminder_permission_requested"), 1);
        return;
      }
      if (firstRequest) track("reminder_permission_requested");
      notificationSaving = false;
      updateReminderSettings();
      const state = await requestNotificationPermission(engagementBridge);
      if (!state.available) throw new Error("notification_unavailable");
      notificationGranted = state.granted;
      const errorIndex = flags.indexOf("reminder_permission_error");
      if (errorIndex >= 0) flags.splice(errorIndex, 1);
      track("reminder_permission", { granted: state.granted });
    } catch {
      if (!flags.includes("reminder_permission_error"))
        flags.push("reminder_permission_error");
      // Preserve the reminder preference on a bridge failure; this is not a
      // user's denial. Keep the failed request retryable across process restarts.
      await save();
      return;
    } finally {
      engagementActive = false;
      notificationRequestPending = false;
      notificationSaving = false;
      lastExternalAt = performance.now();
      syncPauseState();
      updateReminderSettings();
    }
  }
  settings.reminders = enabled && notificationGranted;
  settingsDirty.reminders = settings.reminders;
  await save();
  track("reminder_toggle", { enabled: settings.reminders });
  updateReminderSettings();
}
$("notification-system-settings").onclick = () => {
  lastExternalAt = performance.now();
  void engagementBridge?.openNotificationSettings?.().catch(() => {});
};
$("notification-permission-request").onclick = () => {
  void enableReminder(true);
};
$("reminders").onchange = () => {
  void enableReminder($<HTMLInputElement>("reminders").checked);
};
$("result-reminder").onclick = () => {
  void enableReminder(true);
};
$("reminder-time").onchange = () => {
  const time = $<HTMLInputElement>("reminder-time").value;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  settings.reminderTime = time;
  settingsDirty.reminderTime = time;
  void save();
};
async function openDailyNotification() {
  if (
    !bootComplete ||
    !pendingDailyOpen ||
    paused ||
    busy ||
    adActive ||
    rewardRequest ||
    engagementActive ||
    futureSave ||
    storageConflict
  )
    return;
  pendingDailyOpen = false;
  skipNextInterstitial = true;
  track("reminder_open");
  await switchGame(daily(today()).id);
}
async function tryResultEngagement() {
  if (
    engagementAvailable &&
    settings.reminders &&
    !notificationGranted &&
    !metadata(progress).flags?.includes("reminder_permission_requested") &&
    progress.active === `daily-v1-${today()}` &&
    bootComplete &&
    lesson < 0 &&
    !occupied(board()) &&
    !busy &&
    !paused &&
    !dialog.open &&
    !hintOffer.open &&
    !saveFailed &&
    !storageConflict &&
    !futureSave
  ) {
    await enableReminder(true);
    return;
  }
  await tryReview();
}
async function tryReview() {
  if (
    reviewPreparing ||
    !engagementAvailable ||
    !engagementBridge ||
    busy ||
    paused ||
    dialog.open ||
    hintOffer.open ||
    occupied(board()) ||
    lesson >= 0 ||
    saveFailed ||
    storageConflict ||
    futureSave ||
    performance.now() - lastExternalAt < 30000 ||
    !reviewEligible(progress)
  )
    return;
  // Give the first daily result to notifications without a second native dialog.
  if (
    progress.active.startsWith("daily") &&
    !metadata(progress).flags?.includes("reminder_permission_requested") &&
    !notificationGranted
  )
    return;
  const e = experience(progress);
  e.reviewAttempts++;
  e.lastReviewAt = Date.now();
  const completedSession = session;
  await save();
  if (
    saveFailed ||
    storageConflict ||
    futureSave ||
    session !== completedSession ||
    dialog.open ||
    occupied(board()) ||
    paused
  )
    return;
  track("review_request");
  reviewPreparing = true;
  skipNextInterstitial = true;
  try {
    const preparation = engagementBridge.prepareReview
      ? await engagementBridge.prepareReview()
      : { status: "ready" };
    if (preparation.status !== "ready") {
      if (preparation.status === "exists")
        experience(progress).reviewDone = true;
      track("review_flow", { status: preparation.status });
      await save();
      return;
    }
  } catch {
    track("review_flow", { status: "prepare_error" });
    return;
  } finally {
    reviewPreparing = false;
  }
  // Preparing the store form does not freeze input. A user who continued playing is left alone.
  if (
    session !== completedSession ||
    occupied(board()) ||
    dialog.open ||
    paused ||
    busy ||
    adActive ||
    rewardRequest ||
    saveFailed ||
    storageConflict ||
    futureSave ||
    performance.now() - lastExternalAt < 30000
  )
    return;
  engagementActive = true;
  skipNextInterstitial = true;
  lastExternalAt = performance.now();
  syncPauseState();
  try {
    const result = await engagementBridge.review();
    if (result.status === "exists") experience(progress).reviewDone = true;
    track("review_flow", { status: result.status });
    await save();
  } catch {
    track("review_flow", { status: "bridge_error" });
  } finally {
    engagementActive = false;
    lastExternalAt = performance.now();
    syncPauseState();
  }
}
setInterval(() => {
  const now = performance.now(),
    delta = Math.min(5000, Math.max(0, now - activeTick));
  activeTick = now;
  if (
    !paused &&
    !dialog.open &&
    lesson < 0 &&
    occupied(board()) > 0 &&
    now - lastInputAt < 30000
  ) {
    experience(progress).activeMs += Math.round(delta);
    activeSinceSave += delta;
    if (activeSinceSave >= 30000) {
      activeSinceSave = 0;
      void save();
    }
  }
  if (pendingDailyOpen) void openDailyNotification();
}, 5000);

if (import.meta.env.DEV || import.meta.env.VITE_SEEDS_QA_PROFILE) {
  const qaTools=document.createElement("section");qaTools.id="qa-help-tools";
  if(qaProfile==="all"){qaTools.innerHTML='<h3>Проверка новых фич</h3>';$("menu-content").append(qaTools);}
  installHelpLab(qaProfile,qaProfile==="all"?qaTools:$("menu-content"),assistFeedback);
  const scenes=qaProfile==="all"?["magnet","plan","a3"]:[qaProfile].filter(profile=>["magnet","plan","a3"].includes(profile));
  for (const scene of scenes) {
    const scenario = document.createElement("button"); scenario.id = qaProfile==="all"?`qa-${scene}-scene`:"qa-help-scene"; scenario.className = "secondary";
    scenario.textContent = scene === "magnet" ? "QA: пример Магнита" : scene === "plan" ? "QA: пример плана" : "QA: подсказки за видео";
    if(qaProfile==="all")qaTools.append(scenario);else $("home-goal").after(scenario);
    scenario.onclick = async () => {
      if (busy || rewardRequest || adActive) return;
      const candidate = cloneProgress(progress);
      startAttempt(candidate,"classic"); candidate.active = "classic";
      const fixture = await import("../fixtures/assistance/magnet-example.json");
      let game = newSession();
      if (scene === "magnet") {
        game.current.board = [...fixture.default.start];
        for (const [a,b] of fixture.default.normal_prefix) game = commit(game,removePair(game.current.board,a,b),"pair",0);
        hintAttempt(candidate).help = {version:1,assisted:false};
        jars(candidate).highWater = game.current.moves;
      } else if(scene === "plan") {
        game.current.board = [5,5,0,0,0,0,0,0,0,7,3,2,8];
        hintAttempt(candidate).help={version:1,assisted:false};
      } else {
        game.current.board = Array(18).fill(5);
        hintAttempt(candidate).hintKeys = ["qa-used-1","qa-used-2","qa-used-3"];
      }
      candidate.sessions.classic = game;
      if (await persistHelp(candidate,game)) {clearSelection();closeMenu();render();message("QA-пример. Данные исключены из коммерческих расчётов.");}
    };
  }
}
