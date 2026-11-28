import {optionalResult, optionalSingleFlight} from "./optional-service";
import { syncGameAppearance } from "./appearance";
import "./content-pilot.css";
import { t, plural, choice, localName, word, activeLanguage, launchLanguages, languageNames, resolveLocale, useLanguage, staticCopy, type LanguageChoice } from "./i18n";
import { WebAcquisition, activityDate, type InstallContext } from "./distribution";
import type { EventData } from "./analytics";
import {firstSessionEnabled, firstGuideId as guideId, openingGoal, edgeCue, acrossGap, openingSelection, requiredRule, taskDate} from "./first-session";
import {captureHelpFrame,presentHelpChange,presentHelpStep,clearHelpEffects,helpEffectEpoch} from "./help-presentation";
import {installHelpLab,closeHelpLab} from "./help-lab-ui";
import {requestHelp} from "./help-client";
import {helpIntent, applyMagnet, storedHelp, provenMagnet, nextMagnetApplication, applyPlan, planPosition, planBoards} from "./help-actions";
import {removePair as proofRemovePair} from "./core";
import {helpFlags, helpPaused, qaProfile, assignHelp} from "./help-config";
import {receiptProduct, sameBoard, freezeIntent, type HelpIntent, type HelpProduct} from "./help-contract";
import { dailyRun, streakReward } from "./daily-run";
import { homeDailySnapshot, homeDailyStatus } from "./home-daily";
import { hintExplanation } from "./hint-explanation";
import { readClassicDeals, restartClassic } from "./classic-deals";
import {
  CLASSIC_DEFAULT,
  CLASSIC_MIN,
  CLASSIC_MAX,
  CLASSIC_LEVELS,
  CLASSIC_START_COUNTS,
  isClassicDifficulty,
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
import { volumeOf, volumeTasks, puzzleNumberInVolume, VOLUMES, themeOf } from "./notebooks";
import { hasPlayed, unfinished, notebookStarted, notebookTarget, notebookBrowseStatus, recordNotebookPlay, forgetNotebookPlay, MAIN_BOOKS } from "./notebook-navigation";
import { loadBookV5 } from "./content-v5";
import { dailyDay, dailyDone, dailyIdFor, versionedDay, bookRevisionFor, legacyBookNumber, validContentId, LEGACY_BOOK_TASKS } from "./content-ids";
import { playSound, suspendSound, blockSound, warmSound, type SoundCue } from "./sound";
import { SeedFlight } from "./seed-flight";
import { JarSpill } from "./jar-spill";
import { icon } from "./icons";
import { installInterfaceMotion, presentMenuChange, clearInterfaceMotion } from "./ui-motion";
import type { HapticCue } from "./haptics";
import {
  createValueTransferPlan,
  valueAfterVisualArrival,
} from "./vendor/mini-games-kit/value-transfer";
import { OwnedDomMotion } from "./vendor/mini-games-kit/owned-dom-motion";
import { BoardView } from "./board-view";
import { requestAdvice } from "./advice-client";
import { trophyMark, celebrateTrophy } from "./trophies";
import "./style.css";
import "./ui-polish.css";
import "./ui-adaptation.css";
import "./calm-screens.css";
import "./compact-navigation.css";
import "./quiet-table.css";
import "./visual-acceptance.css";
import "./final-ui.css";
import "./tutorial-ui.css";
import {
  resultKind,
  resultArtwork,
  celebrateResult,
} from "./result-presentation";
import {
  WIDTH,
  MAX_CELLS,
  classic,
  occupied,
  pairs,
  checkPair,
  connectionCells,
  pairBlockers,
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
  notebookForTask,
  loadNotebook,
  nextTask,
  dailyForTask,
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
  ProtectedContentProgress,
  ProtectedEarnedProgress,
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
  sound: true,
  vibration: true,
  tutorialDone: false,
  reminders: true,
  reminderTime: "12:30",
  languageChoice: "auto" as LanguageChoice,
};
let nativeAcquisition: (InstallContext & {enabled:boolean;build_channel:string}) | undefined;
let languageReady = false;
let localeState = resolveLocale("auto", undefined, []);
let deviceLanguages: readonly string[] = navigator.languages;
let webAcquisition: WebAcquisition | undefined;
let nativeActiveDay = "";
function localeContext(): EventData {
  const tag = localeState.requested;
  const requested = /^(pt-BR|pt-PT|es-MX|es-ES|en-GB|ru-KZ|tr-TR|fr-CA|de-AT|it-IT|vi-VN|id-ID|zh-Hans|zh-Hant)$/.test(tag) ? tag
    : tag.split("-")[0];
  return {
    distribution_schema:1, surface:platform.native?"android":"web",
    build_channel:nativeAcquisition?.build_channel ?? (platform.marketQA?"preview":"web"),
    ui_language:localeState.ui, language_mode:settings.languageChoice==="auto"?"auto":"manual",
    locale_source:localeState.source, fallback_reason:localeState.reason, requested_locale:requested,
    qa:Boolean(qaProfile || platform.marketQA),
    ...(nativeAcquisition ? { install_store:nativeAcquisition.install_store,
      artifact_channel:nativeAcquisition.artifact_channel, store_evidence:nativeAcquisition.store_evidence,
      acquisition_state:nativeAcquisition.acquisition_state } : {}),
  };
}
function marketEvent(name:string, extra:EventData = {}) {
  const data = {...localeContext(), ...extra};
  if (webAcquisition) void webAcquisition.event(name,data).catch(()=>{});
  else if (nativeAcquisition?.enabled) {
    durableEvent(name,data);
    void save();
  }
}
function fieldActivity() {
  if (!languageReady || (!enteredGame && lesson<0) || busy || dialog.open || document.hidden) return;
  const data=localeContext(), date=activityDate();
  if (webAcquisition) void webAcquisition.activity(data).catch(()=>{});
  else if (nativeAcquisition?.enabled && nativeActiveDay!==date) {
    nativeActiveDay=date;
    marketEvent("activity_day",{activity_day:date});
  }
}
let lastStored: string | null = null,
  storageConflict = false,
  futureSave = false,
  switching = false,
  recoveryAvailable = false;
let hintGeneration = 0;
let hintPending = false;
let helpSearchStop = () => {};
let readWarning = "";
let protectedContent = false;
let preV5BackedUp = false;
let preV6BackedUp = false;
const settingsDirty: Record<string, unknown> = {};
let saveQueue = Promise.resolve(),
  hintIndex = 0,
  lesson = -1,
  lessonBoard: number[] = [],
  lessonPhase = 0;
let jarShelfPage = 0;
let selectedVolume = 0,
  bookRange = 0,
  bookThemes = false,
  trophyYear = today().slice(0, 4);
let rewardSeenDuringBoot = false;
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
let confirmedSeeds: number | undefined;
let confirmedJars: ReturnType<typeof jars> | undefined;
let confirmedDaily: ReturnType<typeof homeDailySnapshot> | undefined;
const storedJarView = () => confirmedJars ?? jars(progress);
let jarPending = false;
let rewardScene: Promise<void> | undefined;
let completedJar:
  { index: number; capacity: number } | undefined;
let clearContact = () => {};
let clearTrophyCelebration = () => {};
let clearResultCelebration = () => {};
let resultArtKey = "";
let jarMilestone: Promise<void> | undefined;
const presentationWaits = new Set<() => void>();
let resultMilestone: {session: Session; kind: ReturnType<typeof resultKind>} | undefined;
let boardRevealCancel: (() => void) | undefined;
let pendingResult:
  { session: Session; rects: DOMRect[]; saved: boolean } | undefined;
let resultAwaitingSave: Session | undefined;
const removedPairs = new WeakMap<number[], readonly [number, number]>();
const flights = new SeedFlight();
const jarSpill = new JarSpill();
let presentationRevision = 0;
const lessons = [
  {
    get title() { return t("lesson.equal.title"); },
    get text() { return t("lesson.equal.body"); },
    cells: [4, 4],
    pair: [0, 1],
  },
  {
    get title() { return t("lesson.ten.title"); },
    get text() { return t("lesson.ten.body"); },
    cells: [3, 7],
    pair: [0, 1],
  },
  {
    get title() { return t("lesson.gap.title"); },
    get text() { return t("lesson.gap.body"); },
    cells: [2, 0, 0, 2],
    pair: [0, 3],
  },
  {
    get title() { return t("lesson.diagonal.title"); },
    get text() { return t("lesson.diagonal.body"); },
    cells: [8, ...Array(19).fill(0), 2],
    pair: [0, 20],
  },
  {
    get title() { return t("lesson.edge.title"); },
    get text() { return t("lesson.edge.body"); },
    cells: [...Array(8).fill(0), 6, 4],
    pair: [8, 9],
  },
  {
    get title() { return t("lesson.undo.title"); },
    get text() { return t("lesson.undo.body"); },
    cells: [1, 2],
    pair: [],
  },
];
$("app").innerHTML =
  `<main class="game"><header><button id="menu" class="plain" aria-label="${t("home.menu")}">${icon("menu")}</button><div class="brand">${t("ui.seeds-bits")}</div><button id="book-top" class="plain" aria-label="${t("home.book.open")}">${icon("book")}</button></header><button id="jar-meter" class="jar-meter" hidden aria-label="${t("ui.jar-collection")}">${jarGlass("jar-glass")}<span class="jar-caption"><strong id="jar-name"></strong><span class="jar-level"><span id="jar-percent"></span><span id="jar-collected" aria-hidden="true">${icon("check")}</span></span></span></button><section class="game-meta"><span id="mode">${t("ui.classic-game")}</span><span><strong id="remaining">28</strong> <span id="noun">${t("ui.numbers")}</span></span></section><div id="page-progress" hidden></div><section id="lesson" hidden><div class="lesson-top"><span id="lesson-step"></span><button id="skip" class="text-button">${t("action.skip")}</button></div><h1 id="lesson-title"></h1><p id="lesson-text"></p><button id="lesson-next" class="primary" hidden>${t("action.next")}</button></section><div id="viewport" tabindex="0" aria-label="${t("ui.vertically-scrollable-board")}"><div id="board-wrap"><div id="board" role="group" aria-label="${t("ui.numbers-on-the-board")}"></div><svg id="paths" aria-hidden="true"></svg></div><div id="win" hidden><span class="win-symbol" aria-hidden="true">${icon("check")}</span><h1>${t("ui.all-pairs-found")}</h1><section class="result-details" aria-label="${t("ui.game-results")}"><p id="win-stats"></p></section><div id="award" hidden></div><p id="completion-status"></p><p id="result-gains" role="status"></p><button id="try-notebook" class="secondary" hidden>${t("home.book.open")}</button><button id="play-again" class="primary">${t("result.again")}</button></div></div><div class="status-wrap"><button id="hint-jump" class="text-button" hidden></button><p id="status" role="status" aria-live="polite"></p><button id="recover-task" class="text-button" hidden></button><button id="restart-task" class="text-button" hidden>${t("ui.restart-puzzle")}</button><button id="retry-save" class="text-button" hidden>${t("save.retry")}</button></div><footer><button id="undo" class="action">${icon("undo")}<span>${t("action.undo")}</span></button><button id="hint" class="action">${icon("hint")}<span id="hint-label"><span class="action-label">${t("action.hint")}</span><span id="hint-count" class="action-count" aria-hidden="true"></span></span></button><button id="add" class="action">${icon("add")}<span id="add-label"><span class="action-label">${t("action.add")}</span><span id="add-count" class="action-count" aria-hidden="true"></span></span></button></footer></main><dialog id="dialog" aria-label="${t("ui.seeds-bits-menu")}"><div class="dialog-head"><h2>${t("ui.seeds-bits-2")}</h2></div><div id="menu-content"><div class="home-title"><svg class="seed-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="M29 40C8 40 8 20 24 5c12 16 16 30 5 35Z"/><path d="M35 39c-3-15 5-25 24-26-1 20-9 30-24 26Z"/><path class="seed-line" d="m24 15 4 20m24-15-12 14"/></svg><h1>${t("ui.seeds-bits")}</h1></div><button id="resume" class="primary">${t("action.resume")}</button><p id="resume-context"></p><nav class="mode-nav"><button id="classic-mode" class="mode-link"><span>${t("home.classic")}<small>${t("home.classic.detail")}</small></span><span aria-hidden="true">${icon("arrow")}</span></button><button id="book-mode" class="mode-link"><span>${t("home.books")}<small><span id="book-count">${t("home.books.detail")}</span></small></span><span aria-hidden="true">${icon("arrow")}</span></button><button id="daily-mode" class="mode-link"><span>${t("notification.channel")}<small><span id="daily-state">${t("action.start")}</span></small><small id="daily-series" hidden></small></span><span aria-hidden="true">${icon("arrow")}</span></button></nav><button id="calendar-open" class="archive-link"><span id="calendar-open-label">${t("ui.other-days")}</span>${icon("arrow")}</button><div class="home-links"><button id="progress-open" class="text-button">${t("home.progress")}</button><button id="learn" class="text-button">${t("home.how")}</button><button id="settings-open" class="text-button">${t("home.settings")}</button></div></div><section id="settings-panel" hidden><div class="screen-heading"><button id="settings-back" class="text-button" aria-label="${t("ui.back")}">${icon("back")}</button><h2>${t("home.settings")}</h2></div><div class="settings"><label>${t("settings.dark")}<input id="dark" type="checkbox"></label><label>${t("settings.sound")}<input id="sound" type="checkbox"></label><label>${t("settings.vibration")}<input id="vibration" type="checkbox"></label></div><p id="hint-wallet" class="fine"></p><button id="new" class="secondary restart-action">${t("ui.restart-current-game")}</button><p class="intro">${t("settings.autoSave")}</p><button id="privacy-open" class="text-button">${t("ui.privacy")}</button></section><div id="confirm-content" hidden><p>${t("ui.start-a-new-game-the-board-and-undo-history")}</p><button id="confirm-new" class="primary">${t("ui.restart")}</button><button id="cancel-new" class="secondary">${t("ui.keep-current-game")}</button></div><section id="collection" hidden></section></dialog>`;
let refreshStaticCopy = () => {};
const globe = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
const languageFlags: Record<(typeof launchLanguages)[number], string> = {
  ru: '<path fill="#fff" d="M0 0h30v20H0z"/><path fill="#2853a0" d="M0 6.67h30v6.66H0z"/><path fill="#d5363b" d="M0 13.33h30V20H0z"/>',
  en: '<path fill="#253c72" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="4.5" d="m0 0 30 20m0-20L0 20"/><path stroke="#c82145" stroke-width="1.7" d="m0 0 30 20m0-20L0 20"/><path stroke="#fff" stroke-width="7" d="M15 0v20M0 10h30"/><path stroke="#c82145" stroke-width="4" d="M15 0v20M0 10h30"/>',
  es: '<path fill="#bc2833" d="M0 0h30v20H0z"/><path fill="#f4c748" d="M0 5h30v10H0z"/><path fill="#b3323c" d="M8 8h4v3c0 1.2-.8 2-2 2s-2-.8-2-2z"/><path fill="#fff0b5" d="M9 8.5h1v3H9z"/>',
  tr: '<path fill="#dc293a" d="M0 0h30v20H0z"/><path fill="#fff" d="M14.4 6a4.7 4.7 0 1 0 0 8 4 4 0 1 1 0-8zm4.6 4.1 1.8 1.2-2.2.1-.7 2.1-.8-2.1-2.2.1 1.7-1.4-.7-2.1 1.8 1.2 1.7-1.4z"/>',
  "pt-BR": '<path fill="#25854e" d="M0 0h30v20H0z"/><path fill="#f2cc55" d="m15 2.7 12 7.3L15 17.3 3 10z"/><circle cx="15" cy="10" r="4.5" fill="#2a4389"/><path fill="none" stroke="#fff" stroke-width=".9" d="M10.9 9.1a10 10 0 0 1 8.2 3.1"/>',
};
const languageSheet = document.createElement("dialog");
languageSheet.id="language-sheet";
languageSheet.setAttribute("aria-labelledby","language-title");
languageSheet.innerHTML='<div class="language-heading"><h2 id="language-title"></h2><button id="language-close" class="plain" type="button">'+icon("close")+'</button></div><div id="language-options" role="group"></div><p id="language-save-error" role="status" hidden></p>';
$("app").append(languageSheet);
// Own bottom sheet, layered above (but not replacing) the current-party menu.
const classicNewSheet = document.createElement("dialog");
classicNewSheet.id = "classic-new-sheet";
classicNewSheet.setAttribute("aria-labelledby", "classic-new-title");
classicNewSheet.innerHTML =
  '<div class="classic-sheet-head"><h2 id="classic-new-title"></h2><button type="button" id="classic-new-close" class="plain" aria-label="'+t("ui.close-menu")+'">'+icon("close")+'</button></div>'+
  '<p id="classic-new-help" class="classic-sheet-help"></p>'+
  '<div id="classic-entry"><button type="button" id="classic-resume" class="primary"></button><button type="button" id="next-classic" class="secondary"></button></div>'+
  '<div id="classic-difficulty-list" class="classic-difficulty-list" role="group"></div>';
$("app").append(classicNewSheet);
const classicNewOptions = $("classic-difficulty-list");
for (const level of CLASSIC_LEVELS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "classic-difficulty-option";
  button.dataset.classicLevel = String(level);
  button.innerHTML = '<span class="classic-level-mark" aria-hidden="true">'+(level+1)+'</span>'+
    '<span class="classic-level-copy"><strong></strong><small></small></span>'+
    '<span class="classic-level-current" hidden></span>';
  classicNewOptions.append(button);
}
function classicParked() {
  const game = progress.sessions.classic;
  if (!unfinished(game)) return false;
  const meta = metadata(progress);
  return hasPlayed(game) || Boolean(meta.classicRun?.current || meta.classicDeals?.current) ||
    game!.current.board.join("") !== classic().join("");
}
let choosingClassicDifficulty = false;
function renderClassicNewSheet() {
  $("classic-new-title").textContent = t("calm.classic.choose");
  $("classic-new-close").setAttribute("aria-label", t("ui.close-menu"));
  $("classic-new-title").textContent = choosingClassicDifficulty ? t("calm.classic.choose") : t("home.classic");
  $("classic-new-help").textContent = !choosingClassicDifficulty
    ? t("nav.classicParked")
    : classicParked() ? t("calm.classic.confirmNote") : t("calm.classic.startNote");
  $("classic-entry").hidden = choosingClassicDifficulty;
  classicNewOptions.hidden = !choosingClassicDifficulty;
  $("classic-resume").textContent = t("ui.resume-classic");
  $("next-classic").textContent = t("calm.classic.new");
  for (const button of classicNewOptions.querySelectorAll<HTMLButtonElement>("button")) {
    const level = Number(button.dataset.classicLevel) as ClassicDifficulty;
    const name = localName(classicDifficultyNames[level]);
    const counts = CLASSIC_START_COUNTS[level];
    const detail = t("calm.classic.startRange", { "0": counts[0], "1": counts[2] });
    button.querySelector("strong")!.textContent = name;
    button.querySelector("small")!.textContent = detail;
    const current = button.querySelector<HTMLElement>(".classic-level-current")!;
    current.hidden = level !== classicDifficulty();
    current.textContent = t("calm.classic.current");
    button.setAttribute("aria-label", name+". "+detail+
      (current.hidden ? "" : ". "+current.textContent));
  }
}
function openClassicNewSheet(fromResult = false) {
  const resultEntry = fromResult && progress.active === "classic" && !occupied(board());
  if (classicNewSheet.open || (!resultEntry && (!dialog.open || dialog.dataset.screen !== "home")) ||
      busy || saveFailed || futureSave || storageConflict || adActive || rewardRequest ||
      engagementActive || lesson >= 0) return;
  choosingClassicDifficulty = !classicParked();
  renderClassicNewSheet();
  classicNewSheet.showModal();
  if (!choosingClassicDifficulty) { $("classic-resume").focus({preventScroll:true}); return; }
  classicNewOptions.querySelector<HTMLButtonElement>('button[data-classic-level="'+classicDifficulty()+'"]')?.focus({preventScroll:true});
}
$("classic-new-close").onclick = () => classicNewSheet.close();
$("next-classic").onclick = () => {
  choosingClassicDifficulty = true;
  renderClassicNewSheet();
  classicNewOptions.querySelector<HTMLButtonElement>("button")?.focus();
};
$("classic-resume").onclick = () => {
  classicNewSheet.close();
  void switchGame("classic", "classic-resume");
};
classicNewSheet.addEventListener("click", (event) => {
  if (event.target === classicNewSheet) classicNewSheet.close();
});
const languageRow = document.createElement("button");
languageRow.id="language-open";
languageRow.className="language-row";
languageRow.innerHTML=globe+'<span id="language-label"></span><span id="language-current"></span>';
$("settings-panel").querySelector(".settings")!.before(languageRow);
const pauseLanguage = document.createElement("button");
pauseLanguage.id="pause-language";
pauseLanguage.className="text-button";
pauseLanguage.innerHTML=globe+'<span id="pause-language-label"></span>';
$("menu-content").querySelector(".home-links")!.append(pauseLanguage);
let languageEntry: "settings" | "pause" = "settings";
let changingLanguage=false;
function drawLanguage() {
  $("language-label").textContent=t("language.label");
  $("language-title").textContent=t("language.label");
  $("language-close").setAttribute("aria-label",t("ui.close-menu"));
  pauseLanguage.setAttribute("aria-label",t("language.label"));
  $("pause-language-label").textContent=t("language.label");
  $("language-current").textContent=settings.languageChoice==="auto"
    ? t("language.autoCurrent",{language:languageNames[localeState.ui]})
    : languageNames[settings.languageChoice];
  const options=$("language-options");
  if(!options.childElementCount) {
    for(const code of ["auto",...launchLanguages] as const) {
      const button=document.createElement("button");
      button.type="button";
      button.dataset.language=code;
      const mark = code === "auto" ? globe : '<svg viewBox="0 0 30 20" aria-hidden="true">'+languageFlags[code]+'</svg>';
      button.innerHTML='<span class="language-mark" aria-hidden="true">'+mark+'</span><span class="language-option-copy"><span></span><small hidden></small></span><span class="language-check" aria-hidden="true">'+icon("check")+'</span>';
      if(code!=="auto")button.lang=code;
      button.onclick=()=>void changeLanguage(code);
      options.append(button);
    }
  }
  for(const button of options.querySelectorAll<HTMLButtonElement>("button")) {
    const code=button.dataset.language as LanguageChoice;
    button.querySelector(".language-option-copy > span")!.textContent=code==="auto"?t("language.auto"):languageNames[code];
    const current=button.querySelector("small")!;
    current.textContent=code==="auto"?t("calm.language.current",{language:languageNames[localeState.ui]}):"";
    current.hidden=code!=="auto";
    button.setAttribute("aria-pressed",String(code===settings.languageChoice));
  }
}
function applyLanguage() {
  localeState=resolveLocale(settings.languageChoice, platform.platformLocale(), deviceLanguages,
    platform.isYandex?"yandex_games":undefined, platform.isYandex && !platform.platformLocale());
  useLanguage(localeState.ui);
  refreshStaticCopy();
  $("calendar-open-label").textContent = t("ui.other-days");
  document.title=t("ui.document-title");
  document.querySelector('meta[name="description"]')?.setAttribute("content",t("store.short"));
  drawLanguage();
  if (languageReady) {
    const scroll=viewport.scrollTop;
    boardView.relabel();
    render();
    if(lesson>=0) renderLessonCopy();
    viewport.scrollTop=scroll;
    updateHome();
    if(dialog.dataset.screen==="home")renderHomeCurrent();
    else if(dialog.open && (dialog.dataset.screen==="book" || dialog.dataset.screen==="book-picker"))
      openCollection(dialog.dataset.screen,true);
    updateEngagementCopy();
    showSaveState();
  }
}
function openLanguage(entry: "settings"|"pause") {
  if(languageSheet.open) return;
  languageEntry=entry;
  $("language-save-error").hidden=true;
  drawLanguage();
  languageSheet.showModal();
  const current=languageSheet.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!;
  current.focus({preventScroll:true});
  current.scrollIntoView({block:"nearest"});
  marketEvent("language_picker_open",{entry_point:entry});
}
async function changeLanguage(code:LanguageChoice) {
  if(code===settings.languageChoice || changingLanguage) return;
  const from=settings.languageChoice, before=localeState.ui;
  changingLanguage=true;
  try {
    await saveQueue;
    const merged=await platform.writeSettingsPatch(SETTINGS,JSON.stringify(settings),{languageChoice:code});
    applySettings(merged);
    $("language-save-error").hidden=true;
    marketEvent("language_changed",{entry_point:languageEntry,from_mode:from==="auto"?"auto":"manual",
      to_mode:code==="auto"?"auto":"manual",from_language:before,to_language:localeState.ui});
  } catch {
    $("language-save-error").textContent=t("ui.language-save-error");
    $("language-save-error").hidden=false;
  } finally {changingLanguage=false;}
}
languageRow.onclick=()=>openLanguage("settings");
pauseLanguage.onclick=()=>openLanguage("pause");
$("language-close").onclick=()=>languageSheet.close();
const resultNext = document.createElement("div");
resultNext.id = "result-next";
resultNext.className = "result-next";
resultNext.setAttribute("role", "group");
resultNext.setAttribute("aria-label", t("ui.next-game"));
$("play-again").before(resultNext);
resultNext.append($("play-again"));
const resultHome = document.createElement("button");
resultHome.id = "result-home";
resultHome.className = "text-button";
resultHome.hidden = true;
resultHome.onclick = () => void goHomeFromBoard();
resultNext.append(resultHome);
const difficultyCaption = document.createElement("p");
difficultyCaption.id = "classic-difficulty";
difficultyCaption.hidden = true;
resultNext.before(difficultyCaption);
const resultDock = document.createElement("section");
resultDock.id = "result-actions";
resultDock.hidden = true;
resultDock.setAttribute("aria-label", t("ui.continue-playing"));
resultDock.append(
  difficultyCaption,
  resultNext,
  $("try-notebook"),
);
document.querySelector(".game")!.append(resultDock);
const gameDifficulty = document.createElement("small");
gameDifficulty.id = "game-difficulty";
const modeDescription = document.createElement("span");
modeDescription.className = "mode-description";
$("mode").before(modeDescription);
const fieldDateArt = document.createElement("span");
fieldDateArt.className = "field-date-art";
fieldDateArt.hidden = true;
modeDescription.append(fieldDateArt, $("mode"), gameDifficulty);
const resultTitle = document.querySelector<HTMLElement>("#win h1")!;
const resultSubtitle = document.createElement("p");
resultSubtitle.id = "result-subtitle";
resultTitle.after(resultSubtitle);
const resultJarCard = document.createElement("section");
resultJarCard.id = "result-jar-card";
resultJarCard.hidden = true;
resultJarCard.innerHTML = `<div class="jar-picture" aria-hidden="true">${jarGlass("result-jar-glass")}</div><p id="result-jar-amount"></p>`;
const resultBookCard = document.createElement("div");
resultBookCard.id = "result-book-card";
resultBookCard.hidden = true;
resultSubtitle.after(resultJarCard, resultBookCard);
const resultDateArt = document.createElement("div");
resultDateArt.id = "result-date-art";
resultDateArt.hidden = true;
resultTitle.before(resultDateArt);
const resultPaper = document.createElement("section");
resultPaper.className = "quiet-result-page";
const resultRibbon = document.createElement("span");
resultRibbon.className = "result-ribbon";
resultRibbon.setAttribute("aria-hidden", "true");
resultPaper.append(resultRibbon);
const winSymbol = document.querySelector<HTMLElement>("#win .win-symbol")!;
winSymbol.before(resultPaper);
resultPaper.append(winSymbol, resultDateArt, resultTitle, resultSubtitle);
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
      // Keep the CSS size relative to its source. WebView applies text zoom to it.
      label.style.fontSize = `max(10px, calc(${base || "1em"} * ${available / width}))`;
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
  '<div class="home-current-copy"><h2 id="home-game-title"></h2></div>';
const homePreview = document.createElement("div");
homePreview.className = "quiet-mini-board";
homePreview.setAttribute("aria-hidden", "true");
const homeJar = document.createElement("button");
homeJar.id = "home-jar";
homeJar.className = "plain";
homeJar.onclick = () => {
  collectionTab = "jars";
  openCollection("trophies");
};
$("menu-content").querySelector(".home-title")!.append(homeJar);
const homeGoal = document.createElement("div");
homeGoal.id = "home-goal";
homeGoal.innerHTML = '<span id="home-goal-caption"></span><progress max="24" aria-hidden="true"></progress>';
$("new").className = "secondary restart-action";
homeCurrent.querySelector(".home-current-copy")!.append($("resume-context"), homePreview, homeGoal);
// The hit target stays on the table; only the illustrated child floats.
const homeNotebook = document.createElement("div");
homeNotebook.id = "home-notebook";
homeNotebook.className = "home-notebook-hit";
homeNotebook.setAttribute("role", "button");
homeNotebook.setAttribute("aria-labelledby", "home-game-title resume");
homeNotebook.tabIndex = 0;
const homeNotebookArt = homeCurrent.querySelector<HTMLElement>(".home-current-copy")!;
homeNotebookArt.before(homeNotebook);
homeNotebook.append(homeNotebookArt);
homeNotebook.onclick = () => {
  const resume = $<HTMLButtonElement>("resume");
  if (dialog.open && dialog.dataset.screen === "home" && !busy &&
      !paused && !resume.hidden && !resume.disabled) resume.click();
};
homeNotebook.addEventListener("keydown", event => {
  if (event.repeat || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Enter") homeNotebook.click();
  else homeNotebook.setAttribute("data-held", "");
});
homeNotebook.addEventListener("keyup", event => {
  if (event.key !== " ") return;
  event.preventDefault();
  const held = homeNotebook.hasAttribute("data-held");
  homeNotebook.removeAttribute("data-held");
  if (held) homeNotebook.click();
});
homeNotebook.addEventListener("blur", () => homeNotebook.removeAttribute("data-held"));
homeCurrent.append($("resume"));
const homeModes = document.createElement("section");
homeModes.className = "home-modes";
homeModes.setAttribute("aria-label", t("ui.game-modes"));
const homeBookCard = document.createElement("div");
homeBookCard.className = "home-book-card";
const bookQuick = document.createElement("button");
bookQuick.id = "book-quick";
bookQuick.className = "text-button";
$("book-mode").before(homeBookCard);
homeBookCard.append($("book-mode"), bookQuick);
const homeCalendar = document.createElement("div");
homeCalendar.className = "home-calendar";
homeCalendar.append($("daily-mode"), $("calendar-open"));
const bookTaskCaption = document.createElement("span");
bookTaskCaption.id = "home-book-task";
$("book-count").after(bookTaskCaption);
const homeModeGrid = document.querySelector(".mode-nav")!;
homeModeGrid.append(homeCalendar);
homeModes.append(homeModeGrid);
homeLayout.append(homeCurrent, homeModes);
$("menu-content").insertBefore(
  homeLayout,
  document.querySelector(".home-links"),
);
const classicPicture = '<span class="tile-picture" aria-hidden="true"><i>3</i><i>7</i></span>';
for (const [id, art] of [
  ["classic-mode", classicPicture],
  ["book-mode", bookPicture(selectedVolume + 1)],
  ["daily-mode", '<span id="home-today-art" aria-hidden="true"></span>'],
] as const) {
  const button = $(id);
  button.lastElementChild?.remove();
  button.insertAdjacentHTML("afterbegin", art);
}
for (const [id, name] of [["progress-open","progress"],["learn","help"],["settings-open","settings"]] as const)
  $(id).insertAdjacentHTML("afterbegin", icon(name));
const settingsBasics = document.createElement("section");
settingsBasics.className = "settings-basics";
for (const node of [...$("settings-panel").children])
  if (!node.matches(".screen-heading"))
    settingsBasics.append(node);
$("settings-panel").append(settingsBasics);
const settingsRows = document.createElement("section");
settingsRows.className = "settings-rows";
settingsRows.append(languageRow, settingsBasics.querySelector(".settings")!);
settingsBasics.prepend(settingsRows);
const hintReserve = document.createElement("section");
hintReserve.className = "settings-reserve";
$("hint-wallet").before(hintReserve);
hintReserve.innerHTML = `<strong id="settings-reserve-title">${t("calm.settings.stock")}</strong>`;
hintReserve.append($("hint-wallet"));
for (const id of ["dark", "sound", "vibration"])
  $(id).setAttribute("role", "switch");
let enteredGame = false;
const openingErrors: Record<string, string> = {
  value: "error.sum",
  blocked: "error.blocked",
  direction: "error.path",
};
function inOpening() {
  return firstSessionEnabled && lesson < 0 && progress.active === "book-v1-1" &&
    progress.seen.includes(guideId) && !progress.done.includes(progress.active);
}
function notebookEdgeUnseen() {
  return firstSessionEnabled && lesson < 0 && progress.active.startsWith("book-v1-") &&
    !progress.seen.includes("reading");
}
function needsNotebookEdge(available: readonly Connection[]) {
  return notebookEdgeUnseen() && available.length > 0 &&
    available.every(pair => pair.kind === "reading");
}
function dailyFieldTitle(id: string, currentDate = today()) {
  const day = id.slice(9);
  const mode = day === currentDate ? t("notification.channel") : t("ui.archived-puzzle");
  return `${mode} · ${taskDate(day, day.slice(0, 4) !== currentDate.slice(0, 4))}`;
}
document.querySelector("header")!.insertBefore($("jar-meter"), $("book-top"));
const noPairsTitle = document.createElement("strong");
noPairsTitle.id = "no-pairs-title";
noPairsTitle.hidden = true;
$("status").before(noPairsTitle);
const noMovesCard = document.createElement("section");
noMovesCard.id = "no-moves-card";
noMovesCard.hidden = true;
noMovesCard.setAttribute("role", "status");
noMovesCard.innerHTML = '<strong></strong><p></p><div><button id="no-moves-primary" class="primary"></button><button id="no-moves-undo" class="secondary"></button></div>';
document.querySelector(".game")!.append(noMovesCard);
function positionNoMoves() {
  if (noMovesCard.hidden) return;
  const frame = viewport.getBoundingClientRect();
  noMovesCard.style.left = `${frame.left + 8}px`;
  noMovesCard.style.width = `${frame.width - 16}px`;
  noMovesCard.style.maxHeight = `${frame.height - 16}px`;
  noMovesCard.style.top = `${Math.max(frame.top + 8, frame.bottom - noMovesCard.offsetHeight - 10)}px`;
}
new ResizeObserver(positionNoMoves).observe($("viewport"));
const gameTop = document.createElement("div");
gameTop.className = "game-top";
const lessonToolbar = document.querySelector<HTMLElement>(".lesson-top")!;
const lessonStep = $("lesson-step");
let lessonReturnToMenu = false;
let lessonReturnEnteredGame = false;
lessonToolbar.hidden = true;
gameTop.append(
  document.querySelector("header")!,
  document.querySelector(".game-meta")!,
  $("page-progress"),
);
gameTop.querySelector("header")!.append(lessonToolbar);
const gameScreen = document.querySelector(".game")!;
gameScreen.insertBefore(gameTop, $("viewport"));
$("viewport").after($("lesson"));
const openingInstructions = document.createElement("div");
openingInstructions.id = "opening-instructions";
openingInstructions.className = "context-guide";
openingInstructions.hidden = true;
document.querySelector(".status-wrap")!.prepend(openingInstructions, $("lesson"));
const gameActions = document.createElement("div");
gameActions.className = "game-actions";
gameActions.append(
  document.querySelector(".status-wrap")!,
  document.querySelector("footer")!,
);
document.querySelector(".game")!.insertBefore(gameActions, resultDock);
const hintDock = document.createElement("div");
hintDock.id = "hint-dock";
hintDock.hidden = true;
gameActions.insertBefore(hintDock, document.querySelector("footer"));
$("hint-jump").textContent = t("ui.second-number-below");
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
function updateBoardEdges() {
  const limit = viewport.scrollHeight - viewport.clientHeight;
  const top = viewport.scrollTop;
  // Avoid a fade on an edge reached to within WebView scroll rounding.
  viewport.toggleAttribute("data-scroll-above", limit > 1 && top > 1);
  viewport.toggleAttribute("data-scroll-below", limit > 1 && limit - top > 1);
}
const boardEdgeObserver = new ResizeObserver(updateBoardEdges);
boardEdgeObserver.observe(viewport);
boardEdgeObserver.observe($("board-wrap"));
const notebookDock = document.createElement("div");
notebookDock.id = "notebook-dock";
notebookDock.hidden = true;
dialog.append(notebookDock);
const dialogHeader = dialog.querySelector<HTMLElement>(".dialog-head")!;
const settingsHeading =
  $("settings-panel").querySelector<HTMLElement>(".screen-heading")!;
const confirmHeading = document.createElement("div");
confirmHeading.className = "screen-heading";
confirmHeading.innerHTML = `<button id="confirm-back" class="text-button" aria-label="${t("ui.back")}">${icon("back")}</button><h2>${t("ui.restart-2")}</h2>`;
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
  actionsFrame = requestAnimationFrame(layoutActions);
}
function layoutActions() {
  fitResultLabels();
  const footer = document.querySelector<HTMLElement>("footer")!;
  const actions = [...footer.querySelectorAll<HTMLElement>(".action")].filter(
    (b) => getComputedStyle(b).display !== "none" && (!b.hidden || (lesson >= 0 && b.id === "lesson-next")),
  );
  footer.style.setProperty("--help-actions",String(actions.length));
  const hasAssist=actions.some(button=>button.id==="magnet"||button.id==="plan");
  let widest = 44;
  const required = actions.reduce(
    (width, button) => {
      const label =
        button.querySelector<HTMLElement>(".action-label") ??
        button.querySelector<HTMLElement>("span") ?? button;
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
    ((lesson >= 0 && shortLesson) ||
      (game.classList.contains("compact-game") && innerWidth<=600 && innerHeight<=340) ||
      required > sideWidth ||
      (actions.length === 2 && widest > (sideWidth - 2) / 2));
  game.classList.toggle("docked-actions", dock);
  const status = document.querySelector<HTMLElement>(".status-wrap")!;
  const statusParent = dock ? hintDock : gameActions;
  if (status.parentElement !== statusParent) {
    if (statusParent === gameTop) gameTop.append(status);
    else statusParent.prepend(status);
  }
  hintDock.hidden = !landscape;
  const jump = $("hint-jump");
  const jumpParent = landscape ? hintDock : status;
  if (jump.parentElement !== jumpParent) jumpParent.prepend(jump);
  const availableWidth = dock ? game.clientWidth - 32 : footer.clientWidth;
  footer.style.setProperty("--assist-columns",actions.length>4&&widest+12<=(availableWidth-12)/3?"3":widest+12>(availableWidth-8)/2?"1":"2");
  game.classList.toggle(
    "stacked-actions",
    availableWidth > 0 && actions.length > 0 &&
      (required > availableWidth ||
        ((!landscape || hasAssist) &&
          widest >
            (availableWidth - Math.max(0, actions.length - 1) * 2) /
              actions.length)),
  );
  const win = $("win");
  const viewport = $("viewport");
  if (document.querySelector("#save-notice:not([hidden])")) {
    const row = document.querySelector("#board .cell")?.getBoundingClientRect();
    if (row?.height) {
      const minimum = `${Math.ceil(Math.max(44, row.height + 2))}px`;
      if (viewport.style.getPropertyValue("--minimum-field-row") !== minimum)
        viewport.style.setProperty("--minimum-field-row", minimum);
    }
  }
  const classicResult = !win.hidden && win.dataset.resultKind === "classic";
  win.classList.toggle(
    "compact-result",
    classicResult && viewport.clientHeight < 440,
  );
  win.classList.remove("minimal-result");
  if (classicResult && win.scrollHeight > viewport.clientHeight + 1)
    win.classList.add("minimal-result");
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
$("app").classList.add("locale-pending");
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
let moveSaveRevision = 0, moveSavePending = false, postSaveMessage = "";
let storageUnsupported = false;
function message(text: string) {
  if (moveSavePending && !saveFailed) {
    postSaveMessage = text;
    $("status").textContent = t("ui.saving-game");
    return;
  }
  const copy = document.querySelector<HTMLElement>(".opening-copy");
  if (inOpening() && copy && highlight) {
    $("status").textContent = "";
    copy.textContent = hintExplanation(board(), highlight);
    return;
  }
  $("status").textContent = lesson >= 0 ? "" : text;
  if (lesson >= 0) $("lesson-feedback").textContent = text;
}
const notice = document.createElement("aside");
notice.id = "save-notice";
notice.setAttribute("role", "status");
notice.hidden = true;
notice.innerHTML =
  `<p id="save-warning"></p><button id="load-latest" class="text-button" hidden>${t("ui.load-saved-game")}</button>`;
notice.append($("retry-save"));
const readNotice = document.createElement("aside");
readNotice.id = "read-notice";
readNotice.setAttribute("role", "alert");
readNotice.hidden = true;
const readText = document.createElement("p"),
  dismissRead = document.createElement("button");
dismissRead.className = "text-button";
dismissRead.textContent = t("ui.got-it");
dismissRead.onclick = () => {
  readWarning = "";
  showSaveState();
};
const restoreRead = document.createElement("button");
restoreRead.id = "restore-backup";
restoreRead.className = "text-button";
restoreRead.textContent = t("ui.restore-backup");
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
      serializeProgress(restored),
      lastStored,
      SETTINGS,
      JSON.stringify(settings),
      {},
    );
    location.reload();
  } catch {
    if (!validCopy) recoveryAvailable = false;
    readWarning = validCopy
      ? t("ui.could-not-save-the-restored-game-the-current-game")
      : t("ui.the-backup-is-damaged-and-cannot-be-restored-the");
    showSaveState();
  } finally {
    busy = false;
    restoreRead.disabled = false;
  }
};
readNotice.append(readText, restoreRead, dismissRead);
document.querySelector(".status-wrap")!.prepend(notice);
$("load-latest").onclick = () => location.reload();
function showSaveState() {
  const parent = dialog.open
    ? dialogScroller()
    : lesson < 0 && !occupied(board())
      ? $("win")
      : document.querySelector(".status-wrap")!;
  if (notice.parentElement !== parent) parent.prepend(notice);
  if (readNotice.parentElement !== parent) parent.prepend(readNotice);
  readNotice.hidden = !readWarning;
  restoreRead.hidden = !recoveryAvailable || futureSave;
  dismissRead.hidden = futureSave;
  readText.textContent = readWarning;
  notice.hidden = !saveFailed;
  $("save-warning").textContent = storageUnsupported ? t("save.atomicUnavailable") : storageConflict
    ? t("ui.another-tab-has-a-newer-save-the-newer-save")
    : t("ui.could-not-save-the-game-keep-it-open-and");
  $("load-latest").hidden = !storageConflict;
  $("retry-save").hidden = !saveFailed || storageConflict;
  // The notice owns the error and recovery action; do not announce it twice.
  $("status").hidden = saveFailed;
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
  // Layout may still be missing its native banner reserve during boot.
  if (bootComplete && enteredGame && lesson < 0 && !busy && !dialog.open) game.current.scroll = viewport.scrollTop;
  state.sessions[state.active] = game;
  const committedEvents = [...(metadata(state).analytics ?? [])];
  const savedJars = { ...jars(state) };
  const savedSeeds = savedJars.meter;
  const savedDaily = homeDailySnapshot(state);
  const bundle = serializeProgress(state),
    prefs = JSON.stringify(settings),
    patch = { ...settingsDirty };
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (storageConflict || futureSave) return;
      try {
        const version = JSON.parse(bundle).version;
        if (!preV5BackedUp && version >= 9) {
          const key = PROGRESS + ".pre-v5";
          if (lastStored && JSON.parse(lastStored).version < 9 && !(await platform.read(key)))
            await platform.write(key, lastStored);
          preV5BackedUp = true;
        }
        if (!preV6BackedUp && version === 10) {
          const key = PROGRESS + ".pre-v6";
          if (lastStored && JSON.parse(lastStored).version < 10 && !(await platform.read(key)))
            await platform.write(key, lastStored);
          preV6BackedUp = true;
        }
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
        if (resultAwaitingSave === game) resultAwaitingSave = undefined;
        if (pendingResult?.session === game) pendingResult.saved = true;
        lastStored = bundle;
        const jarViewChanged = !confirmedJars || confirmedJars.meter !== savedJars.meter ||
          confirmedJars.seeds !== savedJars.seeds || confirmedJars.wins !== savedJars.wins;
        confirmedJars = savedJars;
        confirmedSeeds = savedSeeds;
        confirmedDaily = savedDaily;
        updateHomeDaily();
        // A cancelled/static scene follows a later acknowledgement without replay.
        if (!flights.running && !completedJar && !jarMilestone && !rewardScene && !pendingResult) {
          visualSeeds = Math.max(visualSeeds ?? 0, confirmedSeeds);
          renderJar();
        }
        // Dispatch only events contained in this successfully written snapshot.
        // A crash before the next cleanup write can replay IDs; native deduplicates.
        if (adsBridge || webAcquisition)
          void committedAnalytics.publish(committedEvents, (id) => {
            acknowledgeAnalytics(metadata(state), id);
            if (state !== progress)
              acknowledgeAnalytics(metadata(progress), id);
          });
        const recovered = saveFailed;
        storageUnsupported = false;
        saveFailed = false;
        showSaveState();
        if (jarViewChanged) refreshStaticJarViews();
        if (jarPending && completedJar && !pendingResult && !jarMilestone)
          void presentFullJar(jarStateForHold(completedJar), resultJarCard.hidden ? $("jar-glass") : $("result-jar-glass"), presentationRevision);
        if (lesson < 0 && !occupied(board())) {
          renderWin();
          maybeCelebrateResult();
          if (recovered) setTimeout(() => void tryResultEngagement(), 1500);
        }
        if (recovered) {
          track("save_recovered", { stage: "persist" });
          saveRecovered = true;
          message(t("ui.game-saved"));
        }
      } catch (error) {
        storageUnsupported = error instanceof platform.AtomicStorageUnavailable;
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
function persistMove() {
  // Gameplay stays synchronous, including remapping and bursts of legal moves.
  // Only the latest move's completed write can acknowledge the visible party.
  const revision = ++moveSaveRevision;
  $("board").setAttribute("aria-busy", "true");
  document.querySelector<HTMLElement>(".game")!.dataset.persistence = "pending";
  if (!moveSavePending) postSaveMessage = $("status").textContent ?? "";
  moveSavePending = true;
  $("status").textContent = t("ui.saving-game");
  return Promise.resolve(save()).then(() => {
    if (revision !== moveSaveRevision) return;
    $("board").removeAttribute("aria-busy");
    moveSavePending = false;
    document.querySelector<HTMLElement>(".game")!.dataset.persistence =
      saveFailed || storageConflict || futureSave ? "failed" : "saved";
    if (!saveFailed) {
      message(postSaveMessage);
      if (pendingDailyOpen) void openDailyNotification();
    }
  });
}
function applySettings(incoming: Record<string, unknown>) {
  if (Object.hasOwn(incoming,"languageChoice")) {
    const next=choice(incoming.languageChoice);
    if (settings.languageChoice!==next) {
      settings.languageChoice=next;
      if(languageReady) applyLanguage();
    }
  }
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
  updateEngagementCopy();
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
  syncGameAppearance(settings.theme === "dark");
  if (document.documentElement.dataset.theme === settings.theme) return;
  clearMotions();
  document.documentElement.dataset.theme = settings.theme;
  $<HTMLInputElement>("dark").checked = settings.theme === "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      settings.theme === "dark" ? "#303e31" : "#e5ddbe",
    );
}
function setTheme(dark: boolean) {
  settings.theme = dark ? "dark" : "light";
  settingsDirty.theme = settings.theme;
  applyTheme();
  feedback("button");
  save();
}
type PilotHaptic = Extract<HapticCue, `feel-${string}`>;
function feedback(
  kind: Exclude<HapticCue, "deal" | PilotHaptic> | "add" = "pair",
  tactile = true,
  sound?: SoundCue,
  touch?: PilotHaptic,
) {
  if (paused || document.hidden) return;
  const nextTouch = kind === "select" ? "feel-select" : kind === "undo" ? "feel-undo" :
    kind === "add" ? "feel-add" : kind === "reject" ? "feel-reject" : undefined;
  if (settings.vibration && tactile)
    void platform.haptic(touch ?? nextTouch ??
      (kind === "add" ? "button" : kind)).catch(() => {});
  if (sound) playSound(sound, settings.sound);
  else if (kind !== "reject") playSound(kind, settings.sound);
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
  boardRevealCancel?.();
  boardRevealCancel = undefined;
}
function revealAddedCells(start: number, end: number) {
  clearBoardReveal();
  const first = cell(start)?.getBoundingClientRect();
  if (!first?.height) return;
  const view = viewport.getBoundingClientRect();
  const scroll = viewport.scrollTop;
  const target = Math.min(
    Math.max(0, scroll + (first.top + first.bottom - view.top - view.bottom) / 2),
    viewport.scrollHeight - viewport.clientHeight,
  );
  if (reduced() || document.hidden) {
    viewport.scrollTop = target;
    feedback("add");
    return;
  }
  const firstRow = Math.floor(start / WIDTH);
  const lastRow = firstRow + Math.ceil((view.bottom - first.top - scroll + target) / first.height);
  const last = Math.min(end, lastRow * WIDTH, start + 54);
  const digits: { digit: HTMLElement; delay: number }[] = [];
  for (let index = start; index < last; index++) {
    const digit = cell(index)?.querySelector<HTMLElement>(".digit");
    if (!digit) continue;
    const row = Math.floor(index / WIDTH) - firstRow;
    const column = index % WIDTH - (row === 0 ? start % WIDTH : 0);
    digits.push({ digit, delay: column * 9 + Math.min(row, 3) * 12 });
    digit.classList.add("add-pending");
  }
  const current = board();
  const reveal = () => {
    clearBoardReveal();
    if (board() !== current || dialog.open || paused || document.hidden || reduced()) return;
    const animations: Animation[] = [];
    const bounds = viewport.getBoundingClientRect();
    const visible = digits.filter(({ digit }) => {
      const box = digit.getBoundingClientRect();
      return box.bottom > bounds.top && box.top < bounds.bottom;
    });
    for (const { digit, delay } of visible) {
      const animation = ownedDomMotion.animate(digit, [
        { opacity: 0, transform: "translateY(-6px) scale(.82)" },
        { opacity: 1, transform: "translateY(1px) scale(1.05)", offset: .62 },
        { opacity: 1, transform: "none" },
      ], { duration: 122, delay, easing: "ease-out", fill: "backwards" });
      if (animation) {
        animation.id = "board-add";
        animations.push(animation);
      }
    }
    boardRevealCancel = () => animations.forEach(animation => animation.cancel());
  };
  boardRevealCancel = () => {
    for (const { digit } of digits) digit.classList.remove("add-pending");
  };
  feedback("add");
  if (Math.abs(scroll - target) >= 2) viewport.scrollTop = target;
  reveal();
}
function settlePresentation() {
  presentationRevision++;
  clearMotions();
  clearInterfaceMotion();
  jarSpill.clear();
  clearContact();
  clearTrophyCelebration();
  clearResultCelebration();
  clearBoardReveal();
  clearPairFeedback();
  for (const cancel of [...presentationWaits]) cancel();
  completedJar = undefined;
  jarPending = false;
  rewardScene = undefined;
  pendingResult = undefined;
  flights.clear();
  jarMilestone=undefined;
  document.querySelectorAll("[data-reward-phase]").forEach(node=>node.removeAttribute("data-reward-phase"));
  visualSeeds = confirmedSeeds ?? jars(progress).meter;
  renderJar();
}
/** This wait owns presentation only; cancellation resolves it without continuation. */
function presentationPause(ms: number) {
  return new Promise<boolean>(resolve => {
    const cancel = () => finish(false);
    const finish = (active: boolean) => { clearTimeout(timer); presentationWaits.delete(cancel); resolve(active); };
    const timer = setTimeout(() => finish(true), ms);
    presentationWaits.add(cancel);
  });
}
function presentationActive(revision: number) {
  return revision === presentationRevision && !paused && !document.hidden &&
    !dialog.open && !hintOffer.open && !languageSheet.open && !classicNewSheet.open;
}
function jarStateForHold(held: {index: number; capacity: number}) {
  return {...jarState(0),...held,filled:held.capacity,percent:100,name:localName(jarNames[held.index%6]),color:jarColors[held.index%6]};
}
async function presentFullJar(before: ReturnType<typeof jarState>, target: HTMLElement, revision: number) {
  if (jarMilestone) return jarMilestone;
  // Keep the receiving vessel in place even if its flight beats disk commit.
  completedJar ??= {index:before.index,capacity:before.capacity};
  jarPending = true;
  renderJar();
  // The captured write, never an animation, authorizes the earned accent.
  await saveQueue;
  if (!presentationActive(revision) || saveFailed || storageConflict || futureSave || reduced()) return;
  if (jarMilestone) return jarMilestone;
  if (jarState(confirmedSeeds ?? 0).index <= before.index) return;
  jarPending = false;
  const run = async () => {
    completedJar = {index: before.index, capacity: before.capacity};
    renderJar();
    target.dataset.rewardPhase = "full";
    if (!await presentationPause(180) || !presentationActive(revision)) return;
    target.dataset.rewardPhase = "closing";
    feedback("full");
    await jarSpill.play(target);
    if (!presentationActive(revision)) return;
    completedJar = undefined;
    visualSeeds = flights.running
      ? Math.min(visualSeeds ?? 0, confirmedSeeds ?? 0)
      : confirmedSeeds ?? 0;
    renderJar();
    target.dataset.rewardPhase = "next";
    const a = motion(target,[{opacity:.75,transform:"scale(.94)"},{opacity:1,transform:"none"}],160);
    await a?.finished.catch(()=>{});
    if (presentationActive(revision)) delete target.dataset.rewardPhase;
  };
  const current = run(); jarMilestone = current;
  try { await current; } finally { if (jarMilestone === current) jarMilestone = undefined; }
}
function animateSeeds(rects: DOMRect[], amount: number, result = false): Promise<void> {
  if (!amount || !rects.length) return Promise.resolve();
  const revision = presentationRevision;
  if (reduced() || !presentationActive(revision)) {
    visualSeeds = confirmedSeeds ?? jars(progress).meter;
    renderJar(); return Promise.resolve();
  }
  const plan = createValueTransferPlan(amount, {
    minDurationMs:420,maxDurationMs:720,maxVisualTokens:2,maxAudioEvents:2,
  });
  const tokens = Array.from({length:plan.visualTokenCount},(_,i)=>rects[i%rects.length]);
  const target = result && !resultJarCard.hidden ? $("result-jar-glass") : $("jar-glass");
  const start = jarState(visualSeeds ?? 0);
  let remaining=tokens.length;
  let fullPromise: Promise<void> | undefined;
  return new Promise(resolve => {
    flights.fly(tokens,target,(index,silent)=>{
      if (!presentationActive(revision)) { if (!--remaining) resolve(); return; }
      const quantity=valueAfterVisualArrival(plan,index)-(index?valueAfterVisualArrival(plan,index-1):0);
      visualSeeds=Math.min(jars(progress).meter,(visualSeeds??0)+quantity);
      // Establish the old-vessel hold before the first threshold render.
      if (jarState(visualSeeds).index>start.index && !completedJar) {
        completedJar={index:start.index,capacity:start.capacity};jarPending=true;
      }
      renderJar();
      if (!silent && presentationActive(revision) && jarState(visualSeeds).index===start.index && !completedJar) {
        feedback("land",!result);
        motion(target,[{transform:"rotate(-3deg) scale(1.05)"},{transform:"rotate(2deg)"},{transform:"none"}],180);
      }
      if (!silent && presentationActive(revision) && jarState(visualSeeds).index>start.index && !fullPromise)
        fullPromise=presentFullJar(start,target,revision);
      if (--remaining) return;
      if (!fullPromise && !completedJar && !flights.running) {
        visualSeeds = Math.max(visualSeeds ?? 0, confirmedSeeds ?? 0);
        renderJar();
      }
      if (fullPromise) void fullPromise.then(resolve); else resolve();
    });
  });
}
function maybeCelebrateResult() {
  const pending=pendingResult;
  if (!pending || pending.session!==session || !pending.saved || busy || paused ||
      dialog.open || occupied(board()) || saveFailed || storageConflict || futureSave) return;
  pendingResult=undefined;
  // Hand off any still-flying field feedback to this one result scene.
  presentationRevision++;
  for (const cancel of [...presentationWaits]) cancel();
  flights.clear();jarSpill.clear();completedJar=undefined;jarPending=false;jarMilestone=undefined;
  const revision=presentationRevision, current=session, amount=earnedSeeds+resultPairSeeds;
  visualSeeds=Math.max(0,jars(progress).meter-amount);renderJar();
  const kind=resultMilestone?.session===session ? resultMilestone.kind : resultKind(progress.active,progress.done,notebook,false);
  const award=earnedAward;
  feedback(kind==="classic"?"win":kind==="daily"?"task":kind);
  clearResultCelebration();
  if (reduced()) { visualSeeds=jars(progress).meter;renderJar();return; }
  const scene=celebrateResult(resultPaper,kind,reduced());
  clearResultCelebration=scene;
  // One hierarchy: readable win → newly earned medal → jar transaction.
  // Every next action stays live; leaving settles directly to the durable totals.
  const sequence = (async()=>{
    await scene.finished;
    if (!presentationActive(revision) || session!==current) return;
    if (progress.active.startsWith("daily") && amount) {
      const month=progress.active.slice(9,16), mark=trophy(month,progress.done);
      for (const fill of $("award").querySelectorAll<SVGElement>(".medal-liquid,.medal-ink-level")) {
        const target=Number(fill.dataset.target), after=Math.min(mark.count,target);
        motion(fill,[{transform:`scaleY(${after?Math.min(Math.max(0,mark.count-1),target)/after:1})`},{transform:"scaleY(1)"}],300);
      }
      if (award) {
        feedback("full");
        const medal=celebrateTrophy($("award"),mark.tier,reduced());
        clearTrophyCelebration=medal;
        await medal.finished;
        if (!presentationActive(revision) || session!==current) return;
      }
    }
    if (amount) await animateSeeds(pending.rects,amount,true);
  })();
  rewardScene=sequence;
  void sequence.finally(()=>{if(rewardScene===sequence){rewardScene=undefined;if(presentationActive(revision)&&session===current)void tryResultEngagement();}});
}
function cellCenter(index: number, origin: DOMRect, boardBox: DOMRect) {
  const box = cell(index)?.getBoundingClientRect();
  const width = boardBox.width / WIDTH;
  return box
    ? {x: box.left + box.width / 2 - origin.left, y: box.top + box.height / 2 - origin.top}
    : {x: boardBox.left - origin.left + (index % WIDTH + 0.5) * width,
       y: boardBox.top - origin.top + (Math.floor(index / WIDTH) + 0.5) * width};
}
function edgeArrows(path: Connection, origin: DOMRect, sequence: boolean) {
  const boardBox = $("board").getBoundingClientRect();
  const upper = cellCenter(Math.min(path.a, path.b), origin, boardBox);
  const lower = cellCenter(Math.max(path.a, path.b), origin, boardBox);
  const inset = boardBox.width / WIDTH * 0.24;
  const right = boardBox.right - origin.left - 3, left = boardBox.left - origin.left + 3;
  const exit = `M${Math.min(right - 5, upper.x + inset)},${upper.y}H${right}m-4,-4l4,4 -4,4`;
  const entry = `M${left},${lower.y}H${Math.max(left + 5, lower.x - inset)}m-4,-4l4,4 -4,4`;
  return sequence
    ? `<path class="edge-exit" d="${exit}"/><path class="edge-entry" d="${entry}"/>`
    : `<path d="${exit} ${entry}"/>`;
}
function drawPath(path: Connection | null, sequence = false) {
  const overlay = $("paths");
  const next = path?.kind === "reading" ? edgeArrows(path, overlay.getBoundingClientRect(), sequence) : "";
  if (sequence || overlay.innerHTML !== next) overlay.innerHTML = next;
  updateJump();
}
let pairTrace: SVGSVGElement | undefined;
let pairWave: HTMLElement | undefined;
let blockerKick: Animation | null = null;
let outlinedBlockers: HTMLElement[] = [];
let pairFeedbackTimer: ReturnType<typeof setTimeout>;
function clearPairFeedback() {
  clearTimeout(pairFeedbackTimer);
  pairTrace?.remove();
  pairTrace = undefined;
  pairWave?.remove();
  pairWave = undefined;
  blockerKick?.cancel();
  blockerKick = null;
  for (const blocker of outlinedBlockers) blocker.classList.remove("pair-blocker");
  outlinedBlockers = [];
}
function showPairBlockers(indices: readonly number[]) {
  for (const index of indices) {
    const node = cell(index);
    if (node) {
      node.classList.add("pair-blocker");
      outlinedBlockers.push(node);
    }
  }
  if (outlinedBlockers.length) pairFeedbackTimer = setTimeout(clearPairFeedback, 850);
}
function clipPairTrace() {
  const effect = pairWave ?? pairTrace;
  if (!effect) return;
  const trace = effect.getBoundingClientRect(), view = viewport.getBoundingClientRect();
  effect.style.clipPath = `inset(${Math.max(0, view.top - trace.top)}px ${Math.max(0, trace.right - view.right)}px ${Math.max(0, trace.bottom - view.bottom)}px ${Math.max(0, view.left - trace.left)}px)`;
}
function showPairTrace(path: Connection) {
  const view = viewport.getBoundingClientRect();
  const trace = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  trace.id = "pair-trace";
  trace.setAttribute("aria-hidden", "true");
  Object.assign(trace.style, {left: `${view.left}px`, top: `${view.top}px`, width: `${view.width}px`, height: `${view.height}px`});
  if (path.kind === "reading") {
    trace.innerHTML = edgeArrows(path, view, true);
    $("paths").replaceChildren();
  } else {
    const boardBox = $("board").getBoundingClientRect();
    const a = cellCenter(path.a, view, boardBox), b = cellCenter(path.b, view, boardBox);
    trace.innerHTML = `<path class="gap-trail" d="M${a.x},${a.y} L${b.x},${b.y}"/>`;
  }
  $("app").append(trace);
  pairTrace = trace;
  pairFeedbackTimer = setTimeout(clearPairFeedback, 360);
}
function showPairWave(path: Connection, blocked = false) {
  if (reduced() || document.hidden) return false;
  const view = viewport.getBoundingClientRect();
  const firstCell = cell(0)?.getBoundingClientRect();
  if (!firstCell?.height || !view.height) return false;
  const firstRow = Math.floor((view.top - firstCell.top) / firstCell.height) - 1;
  const lastRow = Math.floor((view.bottom - firstCell.top) / firstCell.height) + 1;
  const indices = connectionCells(path);
  const step = Math.min(19, (blocked ? 90 : 67) / (indices.length - 1));
  const wave = document.createElement("div");
  wave.className = "pair-wave";
  wave.dataset.kind = blocked ? "blocked" : "match";
  wave.setAttribute("aria-hidden", "true");
  Object.assign(wave.style, {
    left: `${view.left}px`, top: `${view.top}px`, width: `${view.width}px`, height: `${view.height}px`,
  });
  for (const [order, index] of indices.entries()) {
    const row = Math.floor(index / WIDTH);
    if (row < firstRow || row > lastRow) continue;
    const node = cell(index);
    if (!node) continue;
    const box = node.getBoundingClientRect();
    const tile = document.createElement("span");
    tile.className = "pair-wave-cell";
    tile.dataset.waveIndex = String(index);
    const impact = blocked && index === path.b;
    if (impact) tile.classList.add("pair-wave-impact");
    const delay = order * step;
    Object.assign(tile.style, {
      left: `${box.left - view.left + 2}px`, top: `${box.top - view.top + 2}px`,
      width: `${box.width - 4}px`, height: `${box.height - 4}px`, animationDelay: `${delay}ms`,
    });
    wave.append(tile);
    if (impact) {
      const approach = indices[order - 1];
      const dx = path.kind === "reading" ? Math.sign(path.b - path.a) : Math.sign(index % WIDTH - approach % WIDTH);
      const dy = path.kind === "reading" ? 0 : Math.sign(Math.floor(index / WIDTH) - Math.floor(approach / WIDTH));
      blockerKick = ownedDomMotion.animate(node.querySelector(".digit"), [
        {transform: "none"},
        {transform: `translate(${3 * dx}px, ${3 * dy}px) scale(1.13)`, offset: .24},
        {transform: `translate(${-2 * dx}px, ${-2 * dy}px) scale(.98)`, offset: .54},
        {transform: "none"},
      ], {duration: 170, delay, easing: "ease-out"});
    }
  }
  if (!wave.childElementCount) return false;
  $("app").append(wave);
  pairWave = wave;
  if (!blocked) pairFeedbackTimer = setTimeout(clearPairFeedback, 240);
  return true;
}
const reducedPreference = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => reducedPreference.matches;
reducedPreference.addEventListener("change",()=>settlePresentation());
const ownedDomMotion = new OwnedDomMotion();
const cellColorMotions = new Map<Element, {animation: Animation; selection: string}>();
const cellSelection = (el: Element) =>
  `${el.classList.contains("selected")}/${el.classList.contains("hinted")}/${el.classList.contains("reachable-valid")}/${el.classList.contains("reachable-invalid")}`;
function clearMotions() {
  ownedDomMotion.cancelAll();
  feelRowSlides = [];
  cellColorMotions.clear();
  resetRowSlideClip();
}
let eraseLayer: HTMLElement | undefined;
function eraseFeelPair(indices: readonly number[]) {
  if (reduced() || document.hidden) return;
  if (eraseLayer) {
    eraseLayer.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    eraseLayer.remove();
  }
  const view = viewport.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "feel-erase-layer";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    top: `${view.top}px`, left: `${view.left}px`,
    width: `${view.width}px`, height: `${view.height}px`,
  });
  $("app").append(layer);
  const animations: Animation[] = [];
  for (const [index, value] of indices.entries()) {
    const digit = cell(value)?.querySelector<HTMLElement>(".digit");
    if (!digit) continue;
    const rect = digit.getBoundingClientRect();
    if (rect.bottom <= view.top || rect.top >= view.bottom) continue;
    const ghost = document.createElement("span");
    const style = getComputedStyle(digit);
    ghost.textContent = digit.textContent;
    Object.assign(ghost.style, {
      top: `${rect.top - view.top}px`, left: `${rect.left - view.left}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, font: style.font,
      letterSpacing: style.letterSpacing, color: style.color,
    });
    layer.append(ghost);
    const animation = ownedDomMotion.animate(ghost, [
      { opacity: .9, transform: "scale(1)" },
      { opacity: 1, transform: "translateY(-2px) scale(1.16)", offset: .29 },
      { opacity: 0, transform: "translateY(-6px) scale(.62)" },
    ], { duration: 128, delay: index * 21, easing: "ease-out", fill: "backwards" });
    if (animation) animations.push(animation);
  }
  if (!animations.length) {
    layer.remove();
    return;
  }
  eraseLayer = layer;
  void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
    layer.remove();
    if (eraseLayer === layer) eraseLayer = undefined;
  });
}
let collapseScroll = 0;
let feelRowSlides: Animation[] = [];
let rowSlideClipTimer: ReturnType<typeof setTimeout>;
const collapseRows = new Set<HTMLElement>();
function resetRowSlideClip() {
  clearTimeout(rowSlideClipTimer);
  $("board").style.removeProperty("overflow-clip-margin");
}
function finishFeelRowSlide() {
  if (!feelRowSlides.length) return;
  for (const slide of feelRowSlides) slide.cancel();
  feelRowSlides = [];
  resetRowSlideClip();
}
function clearCollapseRows() {
  for (const row of collapseRows) row.getAnimations().forEach(animation => animation.cancel());
}
function showCollapsedRows(rows: readonly DOMRect[], view: DOMRect) {
  collapseScroll = viewport.scrollTop;
  for (const rect of rows) {
    const top = Math.max(view.top, rect.top);
    const bottom = Math.min(view.bottom, rect.bottom);
    if (bottom <= top) continue;
    const row = document.createElement("span");
    row.className = "collapsed-row";
    row.setAttribute("aria-hidden", "true");
    Object.assign(row.style, {
      top: `${top}px`, left: `${rect.left}px`,
      width: `${rect.width}px`, height: `${bottom - top}px`,
    });
    $("app").append(row);
    collapseRows.add(row);
    const remove = () => {
      collapseRows.delete(row);
      row.remove();
    };
    const animation = ownedDomMotion.animate(row, [
      { opacity: .89, transform: "scaleY(.95) scaleX(.99)" },
      { opacity: .72, transform: "scaleY(.42) scaleX(1)", offset: .39 },
      { opacity: 0, transform: "scaleY(.06) scaleX(.94)" },
    ], { duration: rows.length > 1 ? 155 : 132, easing: "ease-out" });
    if (animation) void animation.finished.then(remove, remove);
    else remove();
  }
}
function motion(el: Element | null, frames: Keyframe[], duration = 160) {
  const color = frames.some(frame => "background" in frame || "backgroundColor" in frame);
  const animation = ownedDomMotion.animate(el, frames, {duration, easing: "ease-out"}, {
    enabled: !reduced() && !paused && !document.hidden,
    fromCurrent: color ? "always" : "replace",
  });
  if (color && el?.matches(".cell")) {
    if (animation) cellColorMotions.set(el, {animation, selection: cellSelection(el)});
    else cellColorMotions.delete(el);
  }
  return animation;
}
function reconcileCellMotions() {
  for (const [el, owner] of cellColorMotions) {
    if (["idle", "finished"].includes(owner.animation.playState) || !el.isConnected) {
      cellColorMotions.delete(el);
      continue;
    }
    if (owner.selection === cellSelection(el)) continue;
    const visible = getComputedStyle(el).backgroundColor;
    const target = el.classList.contains("selected") ? "var(--selected)"
      : el.classList.contains("hinted") ? "var(--highlight)"
      : el.classList.contains("reachable-invalid") ? "var(--table-reachable-invalid)"
      : el.classList.contains("reachable-valid") ? "var(--table-reachable)" : "transparent";
    motion(el, [{background:visible}, {background:target}], 100);
  }
}
function cell(i: number) {
  return boardView.cell(i);
}
function updateJump() {
  const button = $("hint-jump");
  button.hidden = true;
  if (!highlight || lesson >= 0) return;
  const rect = viewport.getBoundingClientRect();
  const other =
    selected === highlight.a
      ? highlight.b
      : selected === highlight.b
        ? highlight.a
        : highlight.b;
  const c = cell(other)?.getBoundingClientRect();
  if (!c) return;
  const tolerance = 1; // Fractional WebView rows can extend a fraction of a CSS px.
  const above = c.top < rect.top - tolerance && viewport.scrollTop > tolerance;
  const below = c.bottom > rect.bottom + tolerance &&
    viewport.scrollTop < viewport.scrollHeight - viewport.clientHeight - tolerance;
  if (above || below) {
    button.hidden = false;
    button.textContent =
      above ? t("ui.second-number-above") : t("ui.second-number-below");
    button.onclick = () =>
      cell(other)?.scrollIntoView({
        block: "center",
        behavior: reduced() ? "instant" : "smooth",
      });
  }
}
function digitWord(n: number) {
  return word(n,t("ui.number"),t("ui.numbers-2"),t("ui.numbers"));
}
function activePuzzle(): Puzzle | undefined {
  return (
    notebookForTask(progress.active,progress) ??
    dailyForTask(progress.active)
  );
}
let appForeground = true;
let backgroundAt: number | undefined;
let platformPaused = false;
function syncPauseState() {
  const wasPaused = paused;
  paused =
    !appForeground ||
    platformPaused ||
    document.hidden ||
    adActive ||
    rewardRequest ||
    engagementActive;
  $("app").inert = adActive || rewardRequest || engagementActive;
  homeNotebook.toggleAttribute("data-paused", paused);
  if (paused) homeNotebook.removeAttribute("data-held");
  blockSound(paused);
  platform.setHapticState(settings.vibration, paused, !paused);
  if (paused) {
    settlePresentation();
    clearHelpEffects();
    cancelHint();
    suspendSound();
  }
  if (!busy) render();
  if (wasPaused && !paused) refreshStaticJarViews();
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
  `<div id="banner-viewport" aria-hidden="true"></div><div id="ad-space" aria-hidden="true"></div><dialog id="hint-offer" aria-labelledby="hint-offer-title"><div class="hint-heading"><h2 id="hint-offer-title">${t("ui.more-hints")}</h2><button id="close-hints" class="plain" aria-label="${t("ui.close-offer")}">${icon("close")}</button></div><div class="hint-copy"><p id="help-offer-copy">${t("ui.watch-a-video-to-reveal-this-pair-and-get")}</p><div id="help-pack" hidden></div><div id="help-steps" hidden></div><details id="help-details"><summary>${t("ui.how-it-works")}</summary><p id="help-details-copy"></p></details></div><div class="offer-terms"><strong id="help-price"></strong><span id="help-undo"></span></div><p id="rewarded-state" role="status"></p><div class="hint-actions"><button id="watch-hints" class="primary">${t("ui.watch-video-2-hints")}</button><button id="cancel-hints" class="secondary">${t("ui.continue-without-a-hint")}</button></div></dialog>`,
);
const hintOffer = $<HTMLDialogElement>("hint-offer");
const helpPreview = document.createElement("div"); helpPreview.id = "help-preview"; helpPreview.hidden = true;
$("help-offer-copy").after(helpPreview);
const lessonQuick = document.createElement("button");
lessonQuick.id = "lesson-quick";
lessonQuick.className = "secondary";
lessonQuick.textContent = t("ui.start-with-a-short-puzzle");
lessonQuick.hidden = true;
$("lesson-next").after(lessonQuick);
const lessonActions = document.createElement("div");
lessonActions.id = "lesson-actions";
lessonActions.hidden = true;
lessonActions.append($("lesson-next"), lessonQuick);
document.querySelector("footer")!.insertBefore(lessonActions, $("hint"));
$("lesson-next").className = "action ready";
const lessonDetail = document.createElement("p");
lessonDetail.id = "lesson-detail";
$("lesson-title").after(lessonDetail);
$("lesson").prepend($("lesson-text"));
const lessonFeedback = document.createElement("p");
lessonFeedback.id = "lesson-feedback";
lessonFeedback.setAttribute("role", "status");
$("lesson").append(lessonFeedback);
document.querySelector(".mode-description")!.append($("lesson-title"));
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
  if (!adsBridge) return webAcquisition?.product(event) ?? false;
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
  if (adsBridge || (webAcquisition && platform.webAnalyticsEnabled()))
    enqueueAnalytics(metadata(progress), name, {
      ...localeContext(),
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
  fieldActivity();
  if (lesson >= 0 || (!adsBridge && !(webAcquisition && platform.webAnalyticsEnabled()))) return;
  const attempt = hintAttempt(progress);
  if (attempt.analyticsStarted) return;
  attempt.analyticsStarted = true;
  durableEvent("game_start", {
    mode: gameMode(),
    task: progress.active,
    attempt: attempt.id,
  });
}
function bannerEligible() {
  const guardedScreen = dialog.open && ["confirm","privacy"].includes(dialog.dataset.screen ?? "");
  return appForeground && !platformPaused && !rewardRequest && !engagementActive &&
    !document.hidden && (platform.native || document.hasFocus()) && lesson < 0 && !guardedScreen && !languageSheet.open && !classicNewSheet.open && !hintOffer.open &&
    !document.querySelector("dialog[open]:not(#dialog)");
}
function updateBanner() {
  if (!bannerEligible()) {
    cancelAnimationFrame(bannerFrame);
    bannerFrame = 0;
    void syncBanner(false);
    return;
  }
  if (bannerFrame) return;
  bannerFrame = requestAnimationFrame(() => {
    bannerFrame = 0;
    void syncBanner(bannerEligible());
  });
}
new MutationObserver(updateBanner).observe($("app"), {
  attributes:true, attributeFilter:["open","data-screen"], subtree:true,
});
new ResizeObserver(updateBanner).observe($("ad-space"));
new MutationObserver(updateBanner).observe(document.documentElement, {
  attributes:true, attributeFilter:["style"],
});
for (const event of ["resize","focus","blur","seeds:banner-refresh"]) window.addEventListener(event, updateBanner);
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
function recoverNativeReward() {
  return optionalSingleFlight("pending-reward", async () => {
    const pending = await adsBridge?.pending();
    if (pending?.reward) await receiveReward(pending.reward);
    return pending;
  });
}
function receiveReward(r: RewardReceipt): Promise<void> {
  if (!bootComplete) rewardSeenDuringBoot = true;
  rewardQueue = rewardQueue.catch(() => {}).then(async () => {
    if (switching) await saveQueue;
    if (futureSave || storageConflict || switching) return;
    const product = receiptProduct(r);
    if (!product) { track("assist_result", {outcome: "unsupported_receipt", receipt: typeof r?.token === "string" ? r.token.slice(0,100) : "invalid"}); readWarning ||= t("ui.the-reward-is-saved-on-your-device-but-its"); showSaveState(); return; }
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
    await optionalSingleFlight("reward-ack:"+r.token, async () => { await adsBridge?.acknowledge({token:r.token}); });
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
  $("rewarded-state").textContent=saveFailed?"Не сохранено. Заряд на месте.":reason==="pending_receipt"?t("video.restoring"):state==="ready"?t("ui.reward-for-watching-the-full-video"):state==="loading"?t("video.loading"):state==="disabled"?t("video.disabled"):t("video.unavailable");
  $<HTMLButtonElement>("watch-hints").disabled=helpChoiceBusy||saveFailed||(!charged&&state!=="ready");
}
function setHelpOffer(title:string,goal:string,price:string,cta:string,undo:string,details:string){
  $("hint-offer-title").textContent=title;$("help-offer-copy").textContent=goal;
  $("help-price").textContent=price;$("help-price").hidden=!price;$("help-undo").textContent=undo;$("help-undo").hidden=!undo;
  $("help-price").parentElement!.hidden=!price&&!undo;
  $("watch-hints").textContent=cta;$("cancel-hints").textContent=t("ui.not-now");
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
  planRail.innerHTML=`<span>${label}</span><span class="plan-dots" aria-label="${index<0?"Вернитесь к пути":t("ui.step-of", { "0": Math.min(index+1,steps), "1": steps })}">${Array.from({length:steps},(_,i)=>`<i class="${i<index||plan!.complete?"done":i===index?"current":""}">${i<index||plan!.complete?"✓":i+1}</i>`).join("")}</span>`;
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
  setHelpOffer("Магнит",magnetGoal(intent),source==="demo"?"Первый раз бесплатно":source==="replay"?"Повтор бесплатно":source==="charge"?"Из запаса: 1 заряд":"Видео → 1 Магнит",source==="demo"?"Попробовать":source==="replay"?"Повторить бесплатно":source==="charge"?"Применить":t("reward.watch"),"Отмена вернёт поле · повтор бесплатно","Магнит уберёт две выделенные цифры. Заряд не возвращается после отмены. Повтор именно этого эффекта на исходном поле бесплатный.");
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
  setHelpOffer(`План на ${intent.proof!.length} хода`,goal,source==="demo"?"Первый раз бесплатно":source==="charge"?"1 заряд — весь план":"Видео → 1 план",source==="demo"?"Открыть бесплатно":source?"Открыть план":t("reward.watch"),"Отмена вернёт шаг · продолжение бесплатно","Убирайте отмеченные пары сами. Один заряд открывает весь путь. После другого хода подсветка приостановится; возврат через отмену продолжит план бесплатно. Заряд не возвращается.");
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
  setHelpOffer(t("ui.reveal-hint"),t("reward.hint"),"",t("reward.watch"),"",t("ui.finish-the-video-to-reveal-this-pair-and-save"));
  $("help-pack").hidden=false;$("help-pack").innerHTML=`<span>${icon("hint")}<strong>${t("ui.1-now")}</strong></span><span>${icon("hint")}<strong>${t("ui.2-to-keep")}</strong></span>`;
  hintOffer.showModal(); updateOfferReadiness();
  helpEvent("offer", intent, {ready_state: rewardedReadiness.state});
  void refreshRewarded(true);
  if (rewardedReadiness.reason === "pending_receipt") void (async () => {
    const pending = await recoverNativeReward();
    if (pending?.reward) {await receiveReward(pending.reward); if (!saveFailed && offeredIntent?.id === intent.id) {hintOffer.close(); offeredIntent = undefined; message(t("ui.previously-earned-reward-restored"));}}
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
      message(intent.product === "hint_pack_3" ? t("ui.3-hints-added-to-your-balance") : "Заряд добавлен в запас");
      autoIntent = undefined; return;
    }
    if (intent.product === "plan_1" && await performPlan(intent)) {autoIntent = undefined; return;}
    if (intent.product === "magnet_1" && await performMagnet(intent)) {autoIntent = undefined; return;}
    if (intent.product === "hint_pack_3" && await revealHint(intent)) {
      message(t("ui.hint-revealed-left", { "0": metadata(progress).wallet }));
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
      outcomeMessage = result.status === "reward_pending" ? t("ui.the-reward-is-waiting-to-be-saved-keep-the") : result.status === "closed" ? (intent.product === "hint_pack_3" ? t("ui.video-closed-no-hints-were-added") : "Видео закрыто. Заряд не начислен.") : t("ui.ads-are-unavailable-now-try-again-later");
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
  resultPairSeeds = 0,
  earnedHints = 0;
function complete(rects: DOMRect[], pairSeeds = 0) {
  const alreadyCompleted =
    metadata(progress).attempts[progress.active]?.completed;
  const id = progress.active,
    month = id.slice(9, 16);
  const before = id.startsWith("daily")
    ? trophy(month, progress.done).tier
    : 0;
  const newlyCompleted = !progress.done.includes(id);
  const gains = recordCompletion(progress, id);
  resultMilestone = {session,kind:resultKind(id,progress.done,notebook,newlyCompleted)};
  resultAwaitingSave = session;
  pendingResult = { session, rects, saved: false };
  if (gains.hints)
    durableEvent("daily_reward", {
      days: metadata(progress).daily!.count,
      count: gains.hints,
      attempt: hintAttempt(progress).id,
    });
  earnedSeeds = gains.seeds;
  resultPairSeeds = pairSeeds;
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
  const after = id.startsWith("daily")
    ? trophy(month, progress.done).tier
    : 0;
  earnedAward =
    after > before
      ? t("ui.for", { "0": ["", t("ui.bronze"), t("ui.silver"), t("ui.gold")][after], "1": monthName(month) })
      : "";
}
function renderWin() {
  const id = progress.active;
  renderClassicChoices();
  const kind = resultMilestone?.session === session ? resultMilestone.kind : resultKind(id, progress.done, notebook, false);
  const dailyResult = kind === "daily";
  resultDateArt.hidden = !dailyResult;
  if (dailyResult) resultDateArt.innerHTML = calendarPicture(id.slice(9));
  $("win").dataset.resultKind = kind;
  const openingWin = firstSessionEnabled && id === "book-v1-1" && progress.seen.includes(guideId);
  $("win").classList.toggle("opening-win", openingWin);
  $("win").classList.toggle("daily-result", id.startsWith("daily"));
  const index = notebook.findIndex((p) => p.id === id);
  resultTitle.textContent =
    kind === "classic"
      ? t("result.clear")
      : kind === "daily"
        ? id.slice(9) === today() ? t("result.daily") : t("ui.puzzle-for-solved", { "0": taskDate(id.slice(9)) })
        : kind === "book"
          ? themeOf(volumeOf(id)) ? t("content.complete",{theme:volumeLabel(volumeOf(id))}) : t("result.book", { "book": volumeOf(id) + 1 })
          : kind === "page"
            ? t("ui.page-complete", { "0": (Math.floor(index / 6) % 4) + 1 })
            : t("result.puzzle");
  resultSubtitle.textContent =
    kind === "book"
      ? t("ui.all-four-pages-complete")
      : kind === "page"
        ? t("ui.6-of-6-puzzles")
        : kind === "daily"
          ? taskDate(id.slice(9), true)
          : "";
  if (index >= 0 && kind !== "book" && kind !== "page") {
    const solved = volumeTasks(volumeOf(id)).filter(task => progress.done.includes(task.id)).length;
    resultSubtitle.textContent = themeOf(volumeOf(id)) ? t("content.progress",{theme:volumeLabel(volumeOf(id)),solved}) : t("result.progress", { "book": volumeOf(id) + 1, "solved": solved });
  }
  resultSubtitle.hidden = !resultSubtitle.textContent;
  resultJarCard.hidden = false;
  resultBookCard.hidden = !openingWin;
  const resultGains = $("result-gains");
  updateResultJar();
  if (openingWin) {
    if (resultGains.parentElement !== resultJarCard) $("result-jar-amount").before(resultGains);
    resultBookCard.innerHTML = `${bookPicture(volumeOf(id) + 1)}<span><strong>${volumeLabel(volumeOf(id))}</strong><small>${t("ui.of-24-puzzles", { "0": volumeTasks(volumeOf(id)).filter(task => progress.done.includes(task.id)).length })}</small></span>`;
  } else if (resultGains.parentElement === resultJarCard) {
    $("completion-status").after(resultGains);
  }
  const symbol = document.querySelector<HTMLElement>(".win-symbol")!;
  if (resultArtKey !== kind) {
    symbol.innerHTML = resultArtwork(kind);
    resultArtKey = kind;
  }
  symbol.classList.toggle("paper-result", kind === "page" || kind === "book");
  symbol.classList.toggle("field-result", kind === "classic");
  $("win-stats").innerHTML = [
    [t("result.stats.pairs"), session.current.moves],
    ...(id === "classic" ? [[t("result.stats.additions"), session.current.additions]] : []),
    [t("result.stats.hints"), progress.hints[id] ?? 0],
  ]
    .map(
      ([label, value]) =>
        `<span class="result-stat"><strong>${value}</strong><span>${label}</span></span>`,
    )
    .join("");
  resultAssistance.textContent = !helpPaused && hintAttempt(progress).help?.assisted ? hintAttempt(progress).help?.plan ? hintAttempt(progress).help?.magnet ? "С Планом и Магнитом" : "С помощью Плана" : "С помощью Магнита" : "";
  resultAssistance.hidden = !resultAssistance.textContent;
  const i = index;
  const next = nextTask(id, progress.done, today(), day => dailyIdFor(day,progress));
  const nextButton = $("play-again");
  nextButton.dataset.destination = next ?? "";
  if (next?.startsWith("daily")) {
    const date = next.slice(9);
    nextButton.textContent = date === today()
      ? t("ui.todays-puzzle")
      : t("daily.archive", { date: taskDate(date, date.slice(0, 4) !== today().slice(0, 4)) });
  } else if (next && i >= 0) {
    const puzzle = puzzleNumberInVolume(next);
    nextButton.textContent = volumeOf(next) === volumeOf(id)
      ? t("result.nextTask", { puzzle })
      : taskLabel(next);
  } else {
    nextButton.textContent = i >= 0 ? t("books.back") : dailyResult ? t("result.calendar") : t("action.next");
  }
  $("completion-status").textContent =
    i >= 0 &&
    volumeTasks(volumeOf(id)).every((p) => progress.done.includes(p.id))
      ? t("books.completed")
      : next
        ? ""
        : i >= 0
          ? t("books.completed")
          : id.startsWith("daily")
            ? t("ui.all-available-days-complete")
            : "";
  $("result-gains").style.minHeight =
    earnedSeeds || earnedHints
      ? `${((earnedSeeds ? 1 : 0) + (earnedHints ? 1 : 0)) * 1.5}em`
      : "";
  $("result-gains").innerHTML = saveFailed || resultAwaitingSave === session
    ? t("ui.reward-waiting-to-be-saved")
    : [
        earnedSeeds
          ? t("ui.into-the-jar", { "0": earnedSeeds, "1": seedWord(earnedSeeds) })
          : "",
        earnedHints
          ? t("ui.streak-reward", { "0": earnedHints, "1": hintWord(earnedHints) })
          : "",
      ]
        .filter(Boolean)
        .map((text) => `<span>${text}</span>`)
        .join("");
  $("try-notebook").hidden = !helpFlags.result || id !== "classic" || !notebookTarget(progress);
  const award = $("award");
  if (dailyResult) resultPaper.append(award);
  else if (award.parentElement === resultPaper) $("completion-status").before(award);
  award.hidden = true;
  if (i >= 0) {
    const page = Math.floor(i / 6);
    const n = notebook
      .slice(page * 6, page * 6 + 6)
      .filter((p) => progress.done.includes(p.id)).length;
    award.hidden = false;
    award.textContent =
      n === 6
        ? t("ui.page-complete-2", { "0": (page % 4) + 1 })
        : t("ui.page-of-6", { "0": (page % 4) + 1, "1": n });
  }
  if (id.startsWith("daily")) {
    const m = id.slice(9, 16),
      monthTrophy = trophy(m, progress.done);
    award.hidden = false;
    award.innerHTML = `<div class="trophy-heading"><strong>${monthName(m)}</strong><span>${t("ui.of-days", { "0": monthTrophy.count, "1": days(m).length })}</span></div>${trophyMark(m, monthTrophy.count, days(m).length, saveFailed)}`;
  }
  prepareResultLabels();
  scheduleActionLayout();
}
function classicDifficulty(): ClassicDifficulty {
  return metadata(progress).classicRun?.difficulty ?? CLASSIC_DEFAULT;
}
function renderClassicChoices() {
  const isClassic = progress.active === "classic";
  const isDaily = progress.active.startsWith("daily");
  const level = classicDifficulty();
  const blocked = busy || saveFailed || storageConflict || futureSave || resultAwaitingSave === session;
  resultNext.classList.toggle("is-classic", isClassic);
  difficultyCaption.hidden = !isClassic;
  difficultyCaption.textContent =
    level === CLASSIC_MIN
      ? t("ui.difficulty-lowest")
      : level === CLASSIC_MAX
        ? t("ui.difficulty-highest")
        : t("ui.difficulty", { "0": localName(classicDifficultyNames[level]) });
  $<HTMLButtonElement>("play-again").disabled = blocked;
  resultHome.hidden = !isClassic && !isDaily;
  resultHome.className = isDaily ? "primary" : "text-button";
  $("play-again").className = isDaily ? "secondary archive-next" : "primary";
  const primary = isDaily ? resultHome : $("play-again");
  if (resultNext.firstElementChild !== primary) resultNext.prepend(primary);
  resultHome.textContent = t("nav.menu");
  resultHome.disabled = blocked;
}
function compactCount(n: number) {
  return n > 999 ? "999+" : String(n);
}
function render() {
  lessonToolbar.hidden = lesson < 0;
  lessonActions.hidden = lesson < 0;
  lessonActions.dataset.short = String(shortLesson);
  document.querySelector<HTMLElement>(".game")!.dataset.lesson = String(lesson);
  $("recover-task").hidden = true;
  const focusedIndex = document.activeElement?.closest("#board")
    ? (document.activeElement as HTMLElement).dataset.index
    : undefined;
  $<HTMLButtonElement>("lesson-next").disabled = busy;
  $<HTMLButtonElement>("skip").disabled = busy;
  const values = board(),
    count = occupied(values),
    available = availablePairs(values);
  const game = viewport.closest<HTMLElement>(".game")!;
  game.dataset.mode = lesson < 0 ? gameMode() : "lesson";
  game.classList.toggle("compact-game", lesson >= 0 || progress.active !== "classic");
  $("add").hidden = lesson < 0 && progress.active !== "classic";
  game.classList.toggle("short-board", lesson >= 0 || (values.length <= 54 && count > 0));
  renderJar();
  gameDifficulty.hidden = lesson >= 0 || progress.active !== "classic";
  gameDifficulty.textContent = difficultyLabel();
  gameDifficulty.dataset.level = String(classicDifficulty());
  const ended = count === 0 && lesson < 0;
  const leavingResult = !ended && game.classList.contains("is-result");
  game.classList.toggle("is-result", ended);
  resultDock.hidden = !ended;
  const taskIndex = notebook.findIndex((p) => p.id === progress.active);
  const marks = $("page-progress");
  marks.hidden = lesson < 0 && taskIndex < 0;
  $("book-top").hidden = lesson >= 0;
  $("mode").hidden = lesson >= 0;
  $("lesson-title").hidden = lesson < 0;
  $("hint").hidden = lesson >= 0;
  openingInstructions.hidden = !inOpening();
  if (!inOpening()) openingInstructions.replaceChildren();
  if (inOpening()) {
    if (!openingInstructions.querySelector(".opening-copy")) {
      const copy = document.createElement("span");
      copy.className = "opening-copy";
      copy.setAttribute("role", "status");
      openingInstructions.append(copy);
    }
    const copy = openingInstructions.querySelector<HTMLElement>(".opening-copy")!;
    let cue = t("ui.find-the-next-pair");
    if (highlight) cue = hintExplanation(values, highlight);
    else if (selected >= 0) cue = openingSelection(values, selected);
    else if (requiredRule(available)) cue = requiredRule(available)!;
    else if (!session.current.moves) cue = openingGoal();
    if (copy.textContent !== cue) copy.textContent = cue;
  }
  if (lesson >= 0) {
    if (lessonStep.parentElement !== marks) marks.replaceChildren(lessonStep);
    delete marks.dataset.renderedProgress;
    marks.setAttribute("aria-label", t("home.how"));
  } else if (taskIndex >= 0) {
    if (lessonStep.parentElement === marks) lessonToolbar.prepend(lessonStep);
    const pageIndex = Math.floor(taskIndex / 6);
    const progressMarkup = `<span>${t("ui.page", { "0": (pageIndex % 4) + 1 })}</span><div>${notebook
      .slice(pageIndex * 6, pageIndex * 6 + 6)
      .map(
        (p) =>
          `<i class="${progress.done.includes(p.id) ? "finished" : p.id === progress.active ? "current" : ""}">${progress.done.includes(p.id) ? "✓" : ""}</i>`,
      )
      .join("")}</div>`;
    if (marks.dataset.renderedProgress !== progressMarkup) {
      marks.innerHTML = progressMarkup;
      marks.dataset.renderedProgress = progressMarkup;
    }
    marks.setAttribute(
      "aria-label",
      t("ui.puzzle-book-page-puzzle-of-6", { "0": Math.floor(taskIndex / 24) + 1, "1": (pageIndex % 4) + 1, "2": (taskIndex % 6) + 1 }),
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
      ? t("home.how")
      : progress.active === "classic"
        ? t("home.classic")
        : progress.active.startsWith("book")
          ? taskLabel(progress.active)
          : dailyFieldTitle(progress.active);
  fieldDateArt.hidden = game.dataset.mode !== "daily";
  if (!fieldDateArt.hidden && fieldDateArt.dataset.day !== progress.active) {
    fieldDateArt.dataset.day = progress.active;
    fieldDateArt.innerHTML = calendarPicture(progress.active.slice(9));
  }
  const plan = lesson < 0 ? currentPlan() : undefined;
  if(!busy){
    if(plan?.pair)highlight=plan.pair;
    else if(planHighlighted)highlight=null;
    planHighlighted=Boolean(plan?.pair);
  }
  updatePlanRail(plan);
  boardView.render(values, selected, highlight, true);
  reconcileCellMotions();
  $("win").hidden = count > 0 || lesson >= 0;
  document.querySelector<HTMLElement>("footer")!.hidden = !count && lesson < 0;
  if (!count && lesson < 0) renderWin();
  $("board-wrap").hidden = count === 0;
  showSaveState();
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
    videoHint ? t("ui.hint-watch-a-video-for-3-hints") : monetized ? t("ui.hint-left", { "0": hintCount }) : t("action.hint"),
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
  const canAdd = count > 0 && values.length + count <= MAX_CELLS && !available.length;
  const addCount = (lesson === 5 || (lesson < 0 && progress.active === "classic")) && canAdd ? count : 0;
  $("add-label").querySelector(".action-label")!.textContent = lesson < 0 && addCount
    ? t("calm.classic.add", { count: addCount })
    : t("action.add");
  $("add-count").textContent = addCount ? compactCount(addCount) : "";
  $("add").setAttribute(
    "aria-label",
    addCount ? t("ui.add", { "0": addCount, "1": digitWord(addCount) }) : t("action.add"),
  );
  $("add").classList.toggle(
    "ready",
    addCount > 0,
  );
  $("add").toggleAttribute("data-inline-count", lesson < 0 && addCount > 0);
  noPairsTitle.hidden = lesson >= 0 || progress.active !== "classic" || !count || !!available.length;
  noPairsTitle.textContent = t("calm.noPairs");
  const previous = session.history.at(-1);
  const addedCount = previous &&
    session.current.additions === previous.additions + 1 &&
    session.current.moves === previous.moves
      ? count - occupied(previous.board)
      : 0;
  const nextAddMessage = values.length + count <= MAX_CELLS
    ? t("ui.you-can-add-more", { "0": count, "1": digitWord(count) })
    : t("ui.the-board-is-full-undo-a-move-or-start");
  const copied = new Intl.PluralRules(activeLanguage).select(count)==="one" ? t("ui.copied-2") : t("ui.copied");
  const edgeNeeded = !inOpening() && needsNotebookEdge(available);
  if (lesson < 0 && !saveFailed)
    message(
      saveRecovered
        ? t("ui.game-saved")
        : count === 0
          ? t("ui.game-complete")
          : available.length
            ? highlight
              ? edgeNeeded ? hintExplanation(values, highlight) : t("ui.match-the-two-highlighted-numbers")
              : inOpening() ? ""
              : edgeNeeded ? edgeCue()
              : session.current.moves < 3
                ? t("ui.equal-or-add-up-to-10")
                : ""
            : progress.active === "classic"
              ? addedCount > 0
                ? t("ui.added-still-no-pairs", { "0": addedCount, "1": digitWord(addedCount), "2": nextAddMessage })
                : values.length + count > MAX_CELLS
                  ? t("ui.no-pairs", { "0": nextAddMessage })
                  : t("calm.classic.copy", { copied, count, digits: digitWord(count) })
              : t(session.history.length ? "game.noMoves" : "calm.noPairs"),
    );
  // The hidden result footer has no width. Settle the next field's actions
  // before it paints instead of carrying a layout measured on the result.
  if (leavingResult) layoutActions();
  const noMoves = lesson < 0 && count > 0 && !available.length;
  noMovesCard.hidden = !noMoves || dialog.open || saveFailed || Boolean(readWarning);
  noMovesCard.querySelector("strong")!.textContent = t("calm.noPairs");
  noMovesCard.querySelector("p")!.textContent = progress.active === "classic" ? $("status").textContent : t("play.noMovesHelp");
  $("no-moves-primary").textContent = progress.active === "classic" && canAdd
    ? t("calm.classic.add", {count}) : t("ui.restart-puzzle");
  $<HTMLButtonElement>("no-moves-primary").disabled = busy || paused;
  $("no-moves-undo").textContent = t("action.undo");
  $("no-moves-undo").hidden = !session.history.length;
  $<HTMLButtonElement>("no-moves-undo").disabled = busy || paused;
  $("no-moves-primary").onclick = () => {
    if (progress.active === "classic" && canAdd) void add();
    else requestRestart();
  };
  $("no-moves-undo").onclick = undoAction;
  positionNoMoves();
  drawPath(highlight);
  clipPairTrace();
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
  lessonReturnEnteredGame = enteredGame;
  lessonReturnToMenu = !short && !enteredGame;
  if (!metadata(progress).flags?.includes("tutorial_end"))
    firstEvent("tutorial_start", { short });
  session.current.scroll = viewport.scrollTop;
  lesson = 0;
  loadLesson();
  closeMenu();
  void save();
}
function lessonNextText() {
  return shortLesson && lesson === 1 ? t("action.playClassic") : lesson === 5 ? t("action.startGame") : t("action.next");
}
const lessonRules = [
  "lesson.equal.rule", "lesson.ten.rule", "lesson.gap.rule",
  "lesson.diagonal.rule", "lesson.edge.rule", "lesson.undo.rule",
] as const;
function renderLessonCopy() {
  $("skip").innerHTML = icon("close");
  $("skip").setAttribute("aria-label", t("action.skip"));
  $("skip").title = t("action.skip");
  $("lesson-title").textContent = lessons[lesson].title;
  // Keep one command and one rule in the space below the field.
  $("lesson-detail").textContent = t(shortLesson && lesson === 1 ? "lesson.ten-short.rule" : lessonRules[lesson]);
  $("lesson-feedback").textContent = "";
  $("lesson-text").textContent = [
    t("lesson.equal.short"), t("lesson.ten.short"), t("lesson.gap.short"),
    t("lesson.diagonal.short"), t("lesson.edge.short"), t("lesson.undo.short"),
  ][lesson];
  $("lesson-next").textContent = lessonNextText();
}
function loadLesson() {
  lessonQuick.hidden = true;
  lessonBoard = [...lessons[lesson].cells];
  lessonPhase = 0;
  clearSelection();
  $("lesson").hidden = false;
  $("lesson-step").textContent =
    `${lesson + 1} / ${shortLesson ? 2 : lessons.length}`;
  renderLessonCopy();
  $("lesson-next").hidden = true;
  // The invisible continuation slot must already have its final text geometry.
  $("lesson-next").textContent = lessonNextText();
  $("lesson").scrollTop = 0;
  document.querySelector(".status-wrap")!.scrollTop = 0;
  lessonActions.scrollTop = 0;
  viewport.scrollTop = 0;
  render();
  // The instruction is already in #lesson-text. Keep its feedback rail empty
  // until the player completes the action, without duplicating that command.
  message("");
}
function finishLesson(outcome: "complete" | "skip" = "skip") {
  if (busy) return;
  if (lesson >= 0 && !metadata(progress).flags?.includes("tutorial_end"))
    firstEvent("tutorial_end", { outcome, step: lesson + 1 });
  lesson = -1;
  lessonQuick.hidden = true;
  enteredGame = shortLesson || lessonReturnEnteredGame;
  settings.tutorialDone = true;
  settingsDirty.tutorialDone = true;
  $("lesson").hidden = true;
  clearSelection();
  render();
  viewport.scrollTop = session.current.scroll;
  save();
  platform.gameplay(true);
  if (lessonReturnToMenu) openMenu();
}
async function choose(i: number) {
  cancelHint();
  saveRecovered = false;
  if (busy || paused || dialog.open) return;
  finishFeelRowSlide();
  clearBoardReveal();
  clearPairFeedback();
  const values = board();
  if (!values[i] || selected === i) {
    clearSelection();
    render();
    return;
  }
  if (lesson >= 0 && lessonPhase === 2) return;
  if (selected < 0) {
    selected = i;
    feedback("select");
    if (highlight && i !== highlight.a && i !== highlight.b) highlight = null;
    render();
    motion(
      cell(i)?.querySelector(".digit") ?? null,
      [
        { transform: "scale(.82)" },
        { transform: "scale(1.10)", offset: .46 },
        { transform: "scale(1)" },
      ],
      136,
    );
    return;
  }
  const a = selected,
    result = checkPair(values, a, i);
  if (!result.ok) {
    selected = i;
    highlight = null;
    render();
    const blockers = pairBlockers(values, a, i, result.reason);
    showPairBlockers(blockers);
    const blockedEdge = result.reason === "direction" && blockers.length > 0;
    const firstBlocker = a < i ? blockers[0] : blockers.at(-1);
    feedback("reject", true, firstBlocker !== undefined ? "blocked" : "reject-value");
    if (firstBlocker !== undefined) {
      showPairWave({a, b: firstBlocker, kind: blockedEdge ? "reading" : "straight"}, true);
    } else {
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
    }
    if (inOpening() && openingErrors[result.reason]) {
      const copy = document.querySelector<HTMLElement>(".opening-copy");
      if (copy) copy.textContent = blockedEdge ? t("error.edge")
        : blockers.length ? t("error.obstacles") : t(openingErrors[result.reason]);
      return;
    }
    message(
      {
        same: t("error.same"),
        empty: t("error.empty"),
        value: t("error.value"),
        blocked: t("ui.something-is-blocking-the-pair"),
        direction: blockedEdge ? t("error.edge") : t("error.direction"),
      }[result.reason],
    );
    return;
  }
  if (lesson === 5) {
    message(t("ui.try-add-first-then-undo"));
    return;
  }
  if (lesson < 0) {
    const shown = hintAttempt(progress).hintChoices?.[hintKey(values, 0, 0)];
    const prompted = inOpening() && (!session.current.moves || availablePairs(values).every(p => p.kind === "reading"));
    if (prompted) {
      const attempt = hintAttempt(progress);
      attempt.help = {...(attempt.help ?? {version:1}), assisted:true};
    }
    const assisted = Boolean(prompted || hintAttempt(progress).help?.assisted || (shown && shown.includes(a) && shown.includes(i)));
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
  const next = removePair(values, a, i);
  const ending = lesson < 0 && !occupied(next);
  const fast = !ending;
  busy = true;
  highlight = result.path;
  if (!fast) render();
  const firstEdge = lesson < 0 && result.path.kind === "reading" && !progress.seen.includes("edge-trace");
  const traceMove = firstEdge || (lesson < 0 && result.path.kind === "straight" && acrossGap(a, i));
  const wave = showPairWave(result.path);
  if (wave && result.path.kind === "reading") $("paths").replaceChildren();
  if (traceMove && !wave) showPairTrace(result.path);
  if (!reduced() && !document.hidden) eraseFeelPair([a, i]);
  if (!fast) for (const n of [a, i]) cell(n)?.classList.add("erasing");

  const blank = [...values];
  blank[a] = blank[i] = 0;
  const positions = new Map<number, number>();
  const removedRows: number[] = [];
  let offset = 0;
  for (let row = 0; row < blank.length; row += WIDTH) {
    if (!blank.slice(row, row + WIDTH).some(Boolean)) {
      removedRows.push(row);
      offset += WIDTH;
      continue;
    }
    for (let c = row; c < Math.min(row + WIDTH, blank.length); c++)
      positions.set(c - offset, c);
  }
  if (!ending) {
    const sound = removedRows.length > 1 ? "multi-row" : removedRows.length ? "row-clear" :
      (result.path.kind === "reading" || connectionCells(result.path).length >= 4) ? "long-pair" : "pair";
    const touch = removedRows.length > 1 ? "feel-rows" : removedRows.length ? "feel-row" : "feel-pair";
    feedback("pair", true, sound, touch);
  }
  // Commit the accepted move before awaiting a decorative animation.
  if (lesson < 0) {
    session = commit(session, next, "pair", viewport.scrollTop);
    recordNotebookPlay(progress, progress.active);
    markGameStarted();
    if (firstEdge) progress.seen.push("edge-trace");
    if (result.path.kind === "reading" && notebookEdgeUnseen())
      progress.seen.push("reading");
    removedPairs.set(session.current.board, [a, i]);
    hintIndex = 0;
    const gain = progress.active === "classic" ? collectPair(progress, session.current.moves) : 0;
    if (gain && !ending) void animateSeeds(flightRects, gain);
    if (!occupied(next)) complete(flightRects, gain);
    // Publish fast input immediately with an explicit pending-save state.
    // The queue acknowledges durability independently of decorative animation.
    void persistMove();
  } else lessonBoard = next;
  // Lessons and finishing routes get their full explanation. Ordinary Feel
  // moves swap the hit targets immediately, independently of the erase ghosts.
  if (!fast)
    await new Promise((r) => setTimeout(r, ending && (wave || traceMove) ? 240 : reduced() ? 0 : 100));
  if (ending) clearPairFeedback();
  const oldTops = new Map<HTMLElement, number>();
  const collapsed: DOMRect[] = [];
  let anchor: HTMLElement | undefined;
  const collapses = removedRows.length > 0 && next.length > 0;
  const animateCollapse = collapses && !reduced() && !paused && !document.hidden;
  if (collapses) {
    const viewRect = viewport.getBoundingClientRect();
    const boardRect = $("board").getBoundingClientRect();
    const rowHeight = cell(0)?.getBoundingClientRect().height || boardRect.width / WIDTH;
    const topRow = (viewRect.top - boardRect.top) / rowHeight;
    const firstRow = Math.max(0, Math.floor(topRow));
    const firstAnchorRow = Math.max(0, Math.ceil(topRow));
    const lastRow = Math.ceil((viewRect.bottom - boardRect.top) / rowHeight);
    for (const [nextIndex, oldIndex] of positions) {
      const oldRow = Math.floor(oldIndex / WIDTH),
        nextRow = Math.floor(nextIndex / WIDTH);
      if (
        (oldRow < firstRow - 1 || oldRow > lastRow + 1) &&
        (nextRow < firstRow - 1 || nextRow > lastRow + 1)
      )
        continue;
      const node = cell(oldIndex);
      if (!node) continue;
      if (!anchor && viewport.scrollTop > 1 && oldRow >= firstAnchorRow && oldRow < lastRow && blank[oldIndex])
        anchor = node;
      if (animateCollapse || node === anchor) oldTops.set(node, node.getBoundingClientRect().top);
    }
    if (animateCollapse) {
      for (const row of removedRows) {
        const top = boardRect.top + row / WIDTH * rowHeight;
        if (top < viewRect.bottom && top + rowHeight > viewRect.top)
          collapsed.push(new DOMRect(boardRect.left, top, boardRect.width, rowHeight));
      }
    }
  }
  const hadBoardFocus = $("board").contains(document.activeElement);
  boardView.remap(positions);
  if (lesson >= 0) {
    lessonBoard = next;
    lessonPhase = 2;
    $("lesson-next").hidden = false;
    $("lesson-next").textContent = lessonNextText();
    lessonQuick.hidden = !(shortLesson && lesson === 1);
  }
  clearSelection();
  busy = false;
  render();
  if (anchor?.isConnected) {
    const delta = anchor.getBoundingClientRect().top - oldTops.get(anchor)!;
    if (Math.abs(delta) > 1) viewport.scrollTop += delta;
  }
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
  if (animateCollapse) {
    // Read every destination before starting animations; interleaving them forces
    // layout once per cell on long boards.
    const movements = [...oldTops]
      .filter(([node]) => node.isConnected)
      .map(([node, top]) => ({
        node,
        dy: top - node.getBoundingClientRect().top,
      }));
    const view = viewport.getBoundingClientRect();
    const duration = fast ? (removedRows.length > 1 ? 78 : 64) : 170;
    clearCollapseRows();
    showCollapsedRows(collapsed, view);
    const span = Math.min(view.height, Math.max(0, ...movements.map(({ dy }) => dy)));
    if (span > 1) {
      // The bottom cells start below the newly shortened grid for this slide.
      resetRowSlideClip();
      $("board").style.setProperty("overflow-clip-margin", `${Math.ceil(span)}px`);
      rowSlideClipTimer = setTimeout(resetRowSlideClip, duration);
    }
    for (const { node, dy } of movements) {
      if (Math.abs(dy) <= 1) continue;
      const slide = motion(node, [{ translate: `0 ${dy}px` }, { translate: "0 0" }], duration);
      if (fast && slide) feelRowSlides.push(slide);
    }
  }
  maybeCelebrateResult();
  if (lesson >= 0) message(t("ui.well-done"));
  else if (inOpening() || !availablePairs(next).length || needsNotebookEdge(availablePairs(next))) {
    // Keep the instruction or dead-end action for the current field.
  }
  else if (occupied(next) && result.path.kind === "reading")
    teach(
      "reading",
      t("ui.you-can-match-across-a-row-break-if-the"),
    );
  else if (
    occupied(next) &&
    Math.abs((a % 9) - (i % 9)) ===
      Math.abs(Math.floor(a / 9) - Math.floor(i / 9))
  )
    teach("diagonal", t("ui.you-can-also-match-diagonally-if-the-cells-in"));
  else if (occupied(next) && acrossGap(a, i))
    teach("gaps", t("ui.empty-cells-between-numbers-do-not-block-a-match"));
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
  finishFeelRowSlide();
  clearPairFeedback();
  const values = board();
  if (lesson >= 0 && lesson !== 5) return;
  if (!occupied(values)) return;
  if (lesson < 0 && progress.active !== "classic") {
    message(
      t("ui.you-cannot-add-numbers-in-a-short-puzzle-undo"),
    );
    return;
  }
  if (availablePairs(values).length) {
    message(t("ui.there-are-still-pairs-you-can-use-a-hint"));
    return;
  }
  try {
    const next = addNumbers(values);
    if (lesson === 5) {
      lessonBoard = next;
      lessonPhase = 1;
      message(t("ui.numbers-added-now-tap-undo"));
    } else {
      session = commit(session, next, "add", viewport.scrollTop);
      markGameStarted();
      void persistMove();
    }
    clearSelection();
    render();
    revealAddedCells(values.length, next.length);
    if (lesson === 5) message(t("ui.now-tap-undo"));
  } catch {
    message(
      t("ui.the-board-is-full-undo-the-last-move-or"),
    );
  }
}
function undoAction() {
  saveRecovered = false;
  if (busy || paused || (lesson < 0 && !occupied(board()))) return;
  finishFeelRowSlide();
  clearPairFeedback();
  clearCollapseRows();
  resetRowSlideClip();
  clearBoardReveal();
  if (lesson === 5 && lessonPhase === 1) {
    lessonBoard = [...lessons[5].cells];
    lessonPhase = 2;
    $("lesson-next").hidden = false;
    $("lesson-next").textContent = t("action.startGame");
    render();
    message(t("ui.board-restored-youre-ready"));
    return;
  }
  if (lesson >= 0) return;
  if (!session.history.length) return;
  const previous = session.current;
  const restored = removedPairs.get(previous.board);
  session = undo(session);
  clearSelection();
  render();
  const plan=currentPlan();
  if(plan?.pair)message("Уберите отмеченную пару");
  viewport.scrollTop = session.current.scroll;
  feedback("undo");
  if (previous.moves > session.current.moves && !reduced() && !document.hidden) {
    const indices = restored ?? session.current.board.flatMap((value, index) =>
      value && value !== previous.board[index] ? [index] : []).slice(0, 2);
    for (const index of indices)
      motion(cell(index)?.querySelector(".digit") ?? null, [
        { opacity: .42, transform: "translateY(3px) scale(.68)" },
        { opacity: 1, transform: "translateY(-1px) scale(1.08)", offset: .63 },
        { opacity: 1, transform: "none" },
      ], 132);
  }
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
  // Snapshot after restoring the saved viewport, as before. Persisting earlier
  // would replace the restored scroll with the collapsed/added board's offset.
  void persistMove();
  platform.gameplay(occupied(board()) > 0);
}
async function hint() {
  saveRecovered = false;
  if (busy || paused || lesson >= 0 || hintPending) return;
  clearPairFeedback();
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
    message(t("ui.looking-for-a-hint"));
    let original: Puzzle | undefined;
    try { original=activePuzzle(); } catch { /* unavailable legacy catalogue */ }
    if(!original){
      hintPending=false;
      $<HTMLButtonElement>("hint").disabled=false;
      message(t("ui.your-saved-board-is-available-to-restore-hints-try"));
      return;
    }
    const result = await requestAdvice(originalBoard,session.history,original);
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
        const button = $("recover-task");
        const count = originalSession.history.length - recovery;
        button.hidden = false;
        button.textContent = plural("action.undoCount",{count});
        button.onclick = () => {
          if (generation !== hintGeneration || session !== originalSession || busy || paused || dialog.open || lesson >= 0) return;
          session = {...originalSession, current: originalSession.history[recovery], history: originalSession.history.slice(0, recovery)};
          clearSelection();
          render();
          viewport.scrollTop = session.current.scroll;
          viewport.focus({preventScroll:true});
          feedback("undo");
          message(t("ui.board-restored-continue-on-your-own-or-tap-hint"));
          void persistMove();
        };
        message(
          advice.kind === "dead"
            ? t("ui.there-is-no-solution-from-here")
            : t("ui.we-could-not-check-whether-there-is-a-solution"),
        );
      } else message(t("ui.there-is-no-solution-from-here-restart-the-puzzle"));
      noMovesCard.hidden = false;
      noMovesCard.querySelector("strong")!.textContent = $("status").textContent;
      noMovesCard.querySelector("p")!.textContent = t("play.noMovesHelp");
      $("no-moves-primary").textContent = recovery >= 0 ? $("recover-task").textContent : t("ui.restart-puzzle");
      $("no-moves-primary").onclick = () => {
        if (recovery >= 0) $("recover-task").click();
        else requestRestart();
      };
      $("no-moves-undo").hidden = recovery < 0;
      $("no-moves-undo").textContent = t("ui.restart-puzzle");
      $("no-moves-undo").onclick = () => requestRestart();
      positionNoMoves();
      return;
    }
    if (advice.kind !== "move") {
      message(
        session.history.length
          ? t("ui.we-could-not-check-whether-there-is-a-solution-3")
          : t("ui.we-could-not-check-whether-there-is-a-solution-2"),
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
  if (pair.kind === "reading") drawPath(pair, true);
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
type CollectionScreen = "book" | "book-picker" | "calendar" | "trophies" | "progress";
const navigationTrail: {
  screen: string; scroll: number; focus: string;
  volume: number; range: number; themes: boolean;
}[] = [];
let collectionTab: "jars" | "months" = "jars";
let featuredTrophyMonth = "";
function rememberNavigation(target: string) {
  const screen = dialog.open ? dialog.dataset.screen || "home" : "game";
  if (screen === target) return;
  const element = document.activeElement as HTMLElement | null;
  navigationTrail.push({
    screen,
    scroll: dialogScroller().scrollTop,
    volume: selectedVolume, range: bookRange, themes: bookThemes,
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
  if (previous) {
    selectedVolume = previous.volume;
    bookRange = previous.range;
    bookThemes = previous.themes;
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
const revealedAttempts = new Set<string>();
function playBoardEntrance() {
  const current = session.current;
  if (lesson >= 0 || paused || document.hidden || !occupied(current.board) ||
      current.moves || current.additions || session.history.length) return;
  const attempt = hintAttempt(progress).id;
  if (revealedAttempts.has(attempt)) return;
  revealedAttempts.add(attempt);
  if (!reduced()) {
    const view = viewport.getBoundingClientRect();
    const visibleCells = [...$("board").querySelectorAll<HTMLButtonElement>("button.cell")]
      .filter((cell) => {
        const { top, bottom } = cell.getBoundingClientRect();
        return bottom > view.top && top < view.bottom;
      });
    for (const cell of visibleCells) {
      const column = Number(cell.dataset.index) % WIDTH;
      const digit = cell.querySelector(".digit");
      const animation = ownedDomMotion.animate(digit, [
        { opacity: 0 },
        { opacity: 1 },
      ], { duration: 160, delay: column * 24, easing: "ease-out", fill: "backwards" });
      if (animation) animation.id = "board-entrance";
    }
  }
  if (settings.vibration) void platform.haptic("deal").catch(() => {});
  if (!paused) playSound("deal", settings.sound);
}
function closeMenu() {
  if (protectedContent) return;
  if (lesson < 0) enteredGame = true;
  entryAdProtected = false;
  navigationTrail.length = 0;
  dialog.close();
  render();
  viewport.scrollTop = session.current.scroll;
  playBoardEntrance();
  showSaveState();
  document.body.classList.remove("navigation-open");
  positionNoMoves();
  platform.gameplay(!paused && occupied(board()) > 0);
  fieldActivity();
}
function navigateBack(native = false): boolean {
  if(classicNewSheet.open) {classicNewSheet.close();return true;}
  if(languageSheet.open) {languageSheet.close();return true;}
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
  } else if (lesson >= 0) finishLesson();
  else void goHomeFromBoard();
  return true;
}
function openMenu(preserve: unknown = false) {
  noMovesCard.hidden = true;
  if (busy || adActive || rewardRequest || engagementActive) return;
  if (!dialog.open) {
    if (lesson < 0 && enteredGame) session.current.scroll = viewport.scrollTop;
    dialog.dataset.entry = enteredGame ? "pause" : "root";
  }
  if (preserve !== true) navigationTrail.length = 0;
  settlePresentation();
  releaseDialogHeading();
  notebookDock.replaceChildren();
  notebookDock.hidden = true;
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
  ($("resume").hidden || homeCurrent.hidden ? $("classic-mode") : $("resume")).focus({ preventScroll: true });
  platform.gameplay(false);
}
async function reset() {
  if (busy || saveFailed || futureSave || storageConflict || adActive || rewardRequest) return;
  if (progress.active === "classic") {
    void beginClassic(occupied(session.current.board) ? "restart" : "next");
    return;
  }
  // Resolve the assigned content before mutating any attempt or board.
  // A failed lazy legacy load must never replace a saved puzzle with Classic.
  let original: Puzzle | undefined;
  try { original=activePuzzle(); } catch { /* preserve existing save */ }
  if(!original) { message(t("ui.your-saved-board-is-available-to-restore-hints-try")); return; }
  settlePresentation();
  earnedAward = "";
  const candidate = structuredClone(progress);
  startAttempt(candidate, candidate.active);
  forgetNotebookPlay(candidate, candidate.active);
  candidate.hints[candidate.active] = 0;
  const restarted = puzzleSession(original);
  saveRecovered = false;
  busy = true;
  switching = true;
  dialog.inert = true;
  await save(candidate, restarted);
  if (!saveFailed && !storageConflict && !futureSave) await transitionAd("restart");
  dialog.inert = false;
  switching = false;
  busy = false;
  if (saveFailed || futureSave || storageConflict) return;
  progress = candidate;
  session = restarted;
  clearSelection();
  if (lesson >= 0) {
    lesson = -1;
    $("lesson").hidden = true;
  }
  viewport.scrollTop = 0;
  closeMenu();
  render();
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
  // Starting Classic from a notebook or daily puzzle must retain that party,
  // including its last scroll position and Undo, exactly as switchGame does.
  if (progress.active !== "classic") {
    if (!dialog.open && enteredGame) session.current.scroll = viewport.scrollTop;
    candidate.sessions[progress.active] = session;
  }
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
    message(t("ui.could-not-prepare-a-new-game-try-again"));
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
  if (progress.active.startsWith("book")) candidate.lastBookTask = progress.active;
  candidate.active = "classic";
  busy = true;
  switching = true;
  dialog.inert = true;
  try {
    await save(candidate, nextSession);
    if (saveFailed || futureSave || storageConflict) return;
    await transitionAd(action === "next" ? "classic-new" : "restart");
    progress = candidate;
    session = nextSession;
    busy = switching = false;
    dialog.inert = false;
    earnedAward = "";
    earnedSeeds = earnedHints = resultPairSeeds = 0;
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
  // FLIP moves the live button. Resolve the hit on that button's current
  // index before the next move settles the decorative translation.
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
$("menu").onclick = () => void goHomeFromBoard();
$("resume").onclick = () => {
  if (homeCurrent.hasAttribute("data-new-game")) { openClassicNewSheet(); return; }
  if (lesson >= 0 || protectedContent) { closeMenu(); return; }
  if (progress.active.startsWith("book") && !unfinished(session)) {
    const target = notebookTarget(progress);
    if (target) void switchGame(target, "home-next-notebook");
    else openHomeNotebook();
    return;
  }
  void leaveScreen("home-resume", closeMenu);
};
$("book-top").onclick = () => openHomeNotebook();
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
  if (action === "next" ? !classicParked() :
      !unfinished(session) || !availablePairs(session.current.board).length) {
    if (action === "next") void beginClassic("next", level);
    else void reset();
    return;
  }
  const next = action === "next";
  confirmHeading.querySelector("h2")!.textContent = next
    ? t("ui.new-game-2")
    : t("ui.restart-2");
  $("confirm-content").querySelector("p")!.textContent = next
    ? t("ui.the-board-and-undo-history-will-be-replaced-seeds")
    : t("ui.restart-this-board-your-undo-history-will-be-cleared");
  $("confirm-new").textContent = next ? t("ui.start-a-new-game") : t("ui.restart");
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
classicNewOptions.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-classic-level]");
  if (!button || !classicNewSheet.open) return;
  const level = Number(button.dataset.classicLevel);
  if (!isClassicDifficulty(level)) return;
  classicNewSheet.close();
  requestRestart("next", level);
});
$("cancel-new").onclick = returnToPrevious;
function openSettings(restoring = false) {
  if (!restoring) rememberNavigation("settings");
  openMenu(true);
  $("menu-content").hidden = true;
  $("settings-panel").hidden = false;
  dialog.dataset.screen = "settings";
  updateEngagementCopy();
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
    `<div class="screen-heading"><button id="privacy-back" class="text-button" aria-label="${t("ui.back")}">${icon("back")}</button><h2>${t("ui.about-your-data")}</h2></div><p>${t("ui.games-undo-history-and-settings-are-stored-on-this")}</p><p>${t("ui.on-android-appmetrica-and-yandex-ads-send-technical-information")}</p><p>${t("ui.daily-puzzle-reminders-are-on-by-default-and-use")}</p><p>${t("ui.rustore-provides-the-review-window-the-game-receives-neither")}</p><p>${t("ui.the-game-does-not-request-precise-location-camera-microphone")}</p><p>${t("ui.full-policy-and-developer-contact")}</p><p><a href="https://github.com/DanilaH/seeds-bits/blob/main/store/PRIVACY.md" target="_blank" rel="noopener noreferrer">${t("ui.privacy-policy")}</a></p><p><a href="https://github.com/DanilaH/seeds-bits/issues" target="_blank" rel="noopener noreferrer">${t("ui.contact-the-developer")}</a></p>`;
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
let entryAdProtected = true;
async function transitionAd(route: string) {
  const transitionId = crypto.randomUUID();
  const adSession = crypto.randomUUID();
  const detail = {route, transition_id:transitionId, ad_session_id:adSession, mode:gameMode()};
  const reason = entryAdProtected ? "app_entry" : !monetized ? "disabled"
    : !appForeground || document.hidden ? "background"
    : skipNextInterstitial || performance.now() - lastExternalAt <= 30000 ? "external_suppression"
    : "request";
  skipNextInterstitial = false;
  if (reason !== "request") {
    track("result_transition", {...detail, phase:"skipped", reason, shown:false});
    return;
  }
  track("result_transition", {...detail, phase:"request"});
  const result = await showAd("interstitial",undefined,undefined,adSession,{route,transitionId});
  if (result.shown) lastExternalAt = performance.now();
  track("result_transition", {...detail,
    phase:result.status === "error" ? "error" : result.shown ? "closed" : "skipped",
    reason:result.reason ?? result.status ?? "unknown", shown:Boolean(result.shown)});
}
async function leaveScreen(route: string, destination: () => void) {
  if (transitionBlocked() || resultAwaitingSave === session) return;
  busy = true;
  dialog.inert = true;
  renderClassicChoices();
  try {
    await save();
    if (saveFailed || futureSave || storageConflict) return;
    await transitionAd(route);
  } finally {
    busy = false;
    dialog.inert = false;
    renderClassicChoices();
  }
  destination();
}
function transitionBlocked() {
  return busy || paused || adActive || rewardRequest || engagementActive || saveFailed || futureSave || storageConflict;
}
async function goHomeFromBoard() {
  if (dialog.open || busy || paused || adActive || rewardRequest || engagementActive) return;
  if (lesson < 0 && progress.active === "classic" && !occupied(board()))
    await leaveScreen("classic-result-home", openMenu);
  else openMenu();
}
$("play-again").onclick = () => {
  const id = progress.active;
  if (id === "classic") { openClassicNewSheet(true); return; }
  const next = $("play-again").dataset.destination;
  if (next) void switchGame(next, "next");
  else if (id.startsWith("book")) openHomeNotebook();
  else openCollection("calendar");
};
$("try-notebook").onclick = () => {
  const next = notebookTarget(progress);
  if (helpFlags.result && next) void switchGame(next,"short");
};
function seedWord(n: number) {
  return word(n,t("ui.seed"),"семечка",t("ui.seeds"));
}
function hintWord(n: number) {
  return word(n,t("ui.hint"),t("ui.hints-2"),t("ui.hints"));
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
    if (key === "sound" && settings.sound) void warmSound();
    save();
  };
$("retry-save").onclick = async () => {
  const revision = moveSaveRevision;
  await save();
  if (saveFailed || storageConflict || futureSave) return;
  if (revision === moveSaveRevision) {
    moveSavePending = false;
    $("board").removeAttribute("aria-busy");
    document.querySelector<HTMLElement>(".game")!.dataset.persistence = "saved";
  }
  // A failed reward save leaves its native receipt pending until a durable retry.
  try {
    await recoverNativeReward();
  } catch {
    // Keep the receipt for the next retry or launch; the game remains usable.
  }
  await applyEarnedHelp();
  if (pendingDailyOpen) void openDailyNotification();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (dialog.open || lesson >= 0)) {
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
  updateBoardEdges();
  if (pairTrace || pairWave) clearPairFeedback();
  if (Math.abs(viewport.scrollTop - collapseScroll) > 1) clearCollapseRows();
  updateJump();
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (lesson < 0) save();
  }, 200);
});
window.addEventListener("online",fieldActivity);
window.addEventListener("resize", () => {
  settlePresentation();
  drawPath(highlight);
});
document.addEventListener("visibilitychange", () => {
  syncPauseState();
  if (paused && !busy) save();
  else fieldActivity();
});
window.addEventListener("pagehide", () => {
  settlePresentation();
  if (!busy) save();
});
async function boot() {
  let warning = "";
  let hadStoredState = false;
  let hadSettings = false;
  let hadBackup = false;
  try {
    const bundle = await platform.read(PROGRESS);
    hadStoredState = bundle !== null;
    lastStored = bundle;
    if (bundle) {
      try {
        progress = readProgress(bundle, () => {
          warning =
            t("ui.part-of-the-save-is-damaged-valid-games-and");
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
      hadStoredState ||= stored !== null;
      if (stored) session = decode(stored);
      progress.sessions.classic = session;
    }
  } catch (error) {
    futureSave = error instanceof FutureProgress;
    protectedContent = error instanceof ProtectedContentProgress;
    if ((error as Error)?.name === "SecurityError") {
      hadStoredState = true;
      saveFailed = true;
    }
    warning = (error as Error)?.name === "SecurityError" ? t("save.storageUnavailable") : error instanceof ProtectedEarnedProgress ? t("save.earnedProtected") : protectedContent ? t("save.contentIdentity") : futureSave
      ? t("ui.this-save-is-from-a-newer-version-update-the")
      : t("ui.could-not-read-the-save-a-new-game-was");
    readWarning = warning;
  }
  try {
    const raw = await platform.readSettings(SETTINGS);
    hadSettings = raw !== null || (await platform.read(SETTINGS)) !== null;
    if (raw) {
      const s = JSON.parse(raw);
      settings = {
        theme: s.theme === "dark" ? "dark" : "light",
        sound: s.sound !== false,
        vibration: s.vibration !== false,
        tutorialDone: s.tutorialDone === true,
        reminders: s.reminders !== false,
        languageChoice: choice(s.languageChoice),
        reminderTime:
          typeof s.reminderTime === "string" &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(s.reminderTime)
            ? s.reminderTime
            : "12:30",
      };
    }
  } catch {
    hadSettings = true; // Unknown profile stays on its existing route.
  }
  try {
    const backup = await platform.read(PROGRESS + ".recovery");
    hadBackup = backup !== null || (await platform.read(PROGRESS + ".damaged")) !== null;
    recoveryAvailable = restorable(backup);
  } catch { hadBackup = true; }
  confirmedJars = { ...jars(progress) };
  confirmedDaily = homeDailySnapshot(progress);
  confirmedSeeds = confirmedJars.meter;
  visualSeeds = confirmedSeeds;
  if (settings.sound) void warmSound();
  if (recoveryAvailable && !readWarning)
    readWarning =
      t("ui.a-backup-is-available-restoring-it-will-replace-your");
  const activeBank = taskBankLoader(progress.active);
  if (activeBank) {
    try {
      await activeBank();
    } catch {
      readWarning =
        t("ui.your-saved-board-is-available-to-restore-hints-try");
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
    warning = t("service.offline");
  }
  if(platform.native) {
    const acquisition=await optionalResult(adsBridge?.installContext?.() ?? Promise.resolve(undefined));
    if(acquisition) {
      nativeAcquisition=acquisition;
      if(acquisition.locales?.length) deviceLanguages=acquisition.locales;
    }
  } else if(platform.webAnalyticsEnabled()) {
    const source=platform.webDistribution();
    webAcquisition=new WebAcquisition(source,hadStoredState||hadSettings||hadBackup,
      platform.webAnalyticsEnabled,platform.reportWeb);
  }
  languageReady=true;
  applyLanguage();
  $("app").classList.remove("locale-pending");
  marketEvent("locale_resolved");
  if(nativeAcquisition?.enabled && !metadata(progress).flags?.includes("distribution_context")) {
    (metadata(progress).flags ??= []).push("distribution_context");
    marketEvent("distribution_context",{initial_ui_language:localeState.ui});
  }
  if (!hadStoredState && (helpFlags.magnet || helpFlags.plan)) hintAttempt(progress).help = {version:1,assisted:false};
  const profile = helpProfile(progress), beforeAssignments = new Set(profile.assignments.map(a=>a.experiment));
  const assignment = assignHelp(profile, hadStoredState);
  if (!beforeAssignments.has(assignment.experiment) && adsBridge) enqueueAnalytics(metadata(progress), "experiment_assignment", {...assignment});
  if (qaProfile) {
    const label = document.createElement("span"); label.id = "qa-profile";
    label.textContent = t("ui.qa-test-ads", { "0": firstSessionEnabled?t("ui.first-launch"):qaProfile==="baseline"?t("ui.standard-game"):qaProfile==="all"?t("ui.all-features"):qaProfile }); $("menu-content").append(label);
  }
  await save();
  await optionalResult(adsBridge?.configureContext?.({...assignment, anchor: String(assignment.anchor), qa: String(assignment.qa)}) ?? Promise.resolve());
  experience(progress).sessions++;
  await optionalResult(initializeMonetization(() => syncPauseState(), receiveReward));
  viewport.scrollTop = session.current.scroll;
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
  if (engagementBridge) {
    // Optional permission/configuration services cannot hold core startup.
    void engagementBridge.addListener("dailyOpen", () => {
      pendingDailyOpen=true;void openDailyNotification();
    }).catch(()=>{});
    const readConfiguration = optionalSingleFlight("notification-configuration", () => engagementBridge!.configuration().then(config=>{
      engagementAvailable=config.available;notificationGranted=config.granted;
      pendingDailyOpen ||= Boolean(config.entry);
      updateEngagementCopy();void openDailyNotification();
      return config;
    }));
    await readConfiguration;
  }
  syncPauseState();
  trackOpen("resume");
  void platform
    .listenAppState((active) => {
      appForeground = active;
      if (!active && !adActive && !rewardRequest && !engagementActive)
        backgroundAt = Date.now();
      if (active) {
        if (backgroundAt !== undefined) entryAdProtected = true;
        if (
          backgroundAt !== undefined &&
          Date.now() - backgroundAt >= 30 * 60 * 1000
        )
          experience(progress).sessions++;
        backgroundAt = undefined;
        if (engagementBridge)
          void optionalSingleFlight("notification-configuration", () => engagementBridge!.configuration())
            .then((c) => {
              if (!c) return;
              notificationGranted = c.granted;
              updateEngagementCopy();
              if (c.entry) {
                pendingDailyOpen = true;
                void openDailyNotification();
              }
            })
            .catch(() => {});
      }
      syncPauseState();
      if (active) {
        refreshDate();
        fieldActivity();
        void openDailyNotification();
      }
      if (!active && !busy) save();
    })
    .catch(() => {});
  void platform.listenBack(() => navigateBack(true)).catch(() => {});
  if (firstSessionEnabled && !hadStoredState && !hadSettings && !hadBackup && !readWarning && !warning && !saveFailed && !futureSave && !storageConflict && !pendingDailyOpen && !rewardSeenDuringBoot) {
    progress.seen.push(guideId);
    settings.tutorialDone = true;
    settingsDirty.tutorialDone = true;
    await switchGame("book-v1-1");
    if (progress.active !== "book-v1-1" || saveFailed) {
      progress.seen = progress.seen.filter(id => id !== guideId);
      settings.tutorialDone = false;
      settingsDirty.tutorialDone = false;
      openMenu();
    }
  } else if (!firstSessionEnabled && !settings.tutorialDone && !protectedContent) startLesson(true);
  else openMenu();
  bootComplete = true;
  await openDailyNotification();
  platform.ready();
  platform.gameplay(!paused && !dialog.open);
  fieldActivity();
  if (warning) message(warning);
  showSaveState();
}
function teach(id: string, text: string) {
  if (progress.seen.includes(id)) return;
  progress.seen.push(id);
  message(text);
  save();
}
function taskBankLoader(id: string) {
  const n = legacyBookNumber(id);
  if (!n) return;
  const revision = bookRevisionFor(id, progress);
  if (revision === 5) return () => loadBookV5(id);
  if (revision === 1 && n > 24) return loadNotebook;
}
function showTaskLoadError() {
  const copy = t("ui.could-not-open-the-puzzle-book-reload-to-try");
  if (!dialog.open) {
    message(copy);
    return;
  }
  document.getElementById("book-load-error")?.remove();
  const error = document.createElement("div");
  error.id = "book-load-error";
  error.setAttribute("role", "alert");
  const text = document.createElement("p");
  text.textContent = copy;
  const retry = document.createElement("button");
  retry.className = "secondary";
  retry.textContent = t("ui.save-and-reload");
  retry.onclick = async () => {
    retry.disabled = true;
    await save();
    if (!saveFailed && !futureSave && !storageConflict) location.reload();
    else retry.disabled = false;
  };
  error.append(text, retry);
  if (dialog.dataset.screen === "book") $("collection").prepend(error);
  else dialogScroller().prepend(error);
}
async function switchGame(id: string, route?: string) {
  if (transitionBlocked() || resultAwaitingSave === session) return;
  if (!validContentId(id)) return;
  const day = dailyDay(id);
  if (day) {
    if (!availableDay(day)) return;
    id = dailyIdFor(day, progress);
  }
  const loadBank = taskBankLoader(id);
  document.getElementById("book-load-error")?.remove();
  if (loadBank) {
    busy = true;
    dialog.inert = true;
    const loading = document.createElement("p");
    loading.setAttribute("role", "status");
    loading.textContent = t("ui.opening-puzzle-book");
    if (dialog.dataset.screen === "book") $("collection").prepend(loading);
    else dialogScroller().prepend(loading);
    try {
      await loadBank();
    } catch {
      showTaskLoadError();
      return;
    } finally {
      loading.remove();
      busy = false;
      dialog.inert = false;
    }
  }
  let puzzle: Puzzle | undefined;
  try {
    puzzle = notebookForTask(id, progress) ?? dailyForTask(id);
    if (!puzzle && id !== "classic") throw Error("Missing assigned puzzle");
  } catch {
    showTaskLoadError();
    return;
  }

  if (lesson < 0 && enteredGame && !dialog.open) session.current.scroll = viewport.scrollTop;
  if (lesson >= 0) {
    if (!metadata(progress).flags?.includes("tutorial_end"))
      firstEvent("tutorial_end", { outcome: "skip", step: lesson + 1 });
    settings.tutorialDone = true;
    settingsDirty.tutorialDone = true;
  }
  progress.sessions[progress.active] = session;
  if (progress.active.startsWith("book")) progress.lastBookTask = progress.active;
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
  candidate.active = id;
  if (id.startsWith("book")) candidate.lastBookTask = id;
  if (day && versionedDay(day)) candidate.dailyAssignments = {...candidate.dailyAssignments,[day]:id};
  if (legacyBookNumber(id)) candidate.bookRevisions={...candidate.bookRevisions,[id]:bookRevisionFor(id,progress)};
  if (!candidate.sessions[id]) startAttempt(candidate, id);
  let nextSession =
    candidate.sessions[id] ?? (puzzle ? puzzleSession(puzzle) : newSession());
  if (puzzle && !occupied(nextSession.current.board)) {
    startAttempt(candidate, id);
    forgetNotebookPlay(candidate, id);
    nextSession = puzzleSession(puzzle);
    candidate.hints[id] = 0;
  }
  // Publish the new mode only after its complete snapshot has been persisted.
  busy = true;
  switching = true;
  dialog.inert = true;
  await save(candidate, nextSession);
  if (route && lesson < 0 && !saveFailed && !futureSave && !storageConflict) await transitionAd(route);
  switching = false;
  dialog.inert = false;
  busy = false;
  if (saveFailed || futureSave || storageConflict) return;
  earnedAward = "";
  earnedSeeds = earnedHints = resultPairSeeds = 0;
  saveRecovered = false;
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
    activeLanguage,
    { month: "long", year: "numeric" },
  );
function openCollection(kind: CollectionScreen, restoring = false) {
  if (busy) return;
  const sameScreen = dialog.open && dialog.dataset.screen === kind;
  const oldScroll = dialogScroller().scrollTop;
  const previousKey = dialog.dataset.contentKey ?? "";
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusVolume = focused?.dataset.volume;
  const pickerOpen = (
    document.getElementById("calendar-picker") as HTMLDetailsElement | null
  )?.open;
  const calendarExtrasOpen = document.querySelector<HTMLDetailsElement>("#calendar-extras")?.open;
  if (!restoring) rememberNavigation(kind);
  openMenu(true);
  dialog.dataset.screen = kind;
  $("menu-content").hidden = true;
  const panel = $("collection");
  panel.hidden = false;
  let html = `<button class="text-button screen-back" id="collection-back" aria-label="${t("ui.back")}">${icon("back")}</button>`;
  if (kind === "progress") {
    const m = metadata(progress);
    const completedBook = notebook.filter((p) =>
      progress.done.includes(p.id),
    ).length;
    const completedDaily = new Set(progress.done.map(dailyDay).filter(Boolean)).size;
    const j = jarState(storedJarView().meter);
    const nextVolume = nextBookVolume();
    const nextDone = volumeTasks(nextVolume).filter((p) =>
      progress.done.includes(p.id),
    ).length;
    html += `<h2>${t("home.progress")}</h2>${jarHero(j).replace('<section','<button type="button" id="progress-jar"').replace('</section>','</button>')}<button id="progress-book" class="progress-book" data-volume="${nextVolume}">${bookPicture(nextVolume + 1)}<span><strong>${volumeLabel(nextVolume)}</strong><small>${t("ui.of-24-puzzles", { "0": nextDone })}</small></span>${icon("arrow")}<progress max="24" value="${nextDone}" aria-label="${volumeLabel(nextVolume)}"></progress></button><dl class="progress-stats"><div><dt>${t("ui.book-puzzles")}</dt><dd>${t("ui.of", { "0": completedBook, "1": notebook.length })}</dd></div><div><dt>${t("ui.daily-puzzles")}</dt><dd>${completedDaily}</dd></div><div><dt>${t("ui.games-completed")}</dt><dd>${m.completed}</dd></div><div><dt>${t("ui.without-hints")}</dt><dd>${m.unassisted}</dd></div></dl><details class="explanation"><summary>${t("ui.how-progress-is-counted")}</summary><p>${t("ui.games-and-wins-without-hints-are-counted-from-earlier", { "0": new Date(m.since).toLocaleDateString(activeLanguage) })}</p></details><p class="fine">${t("ui.progress-is-saved-on-this-device")}</p><button id="progress-trophies" class="secondary">${t("ui.jars-and-trophies", { "0": icon("arrow") })}</button>`;
  } else if (kind === "book") {
    html += renderNotebook();
  } else if (kind === "book-picker") {
    html += renderNotebookPicker();
  } else if (kind === "calendar") {
    if (calendarMonth > today().slice(0, 7))
      calendarMonth = today().slice(0, 7);
    const date = today(), todayId = dailyIdFor(date,progress);
    const todayAction = dailyDone(progress.done,date) ? "replay" : progress.sessions[todayId]?.history.length ? "resume" : "play";
    const monthTrophy = trophy(calendarMonth, progress.done),
      weekday =
        (new Date(
          Number(calendarMonth.slice(0, 4)),
          Number(calendarMonth.slice(5)) - 1,
          1,
        ).getDay() +
          6) %
        7;
    html += `<h2>${t("notification.channel")}</h2><section class="calendar-hero">${calendarPicture(date)}<div><small>${monthName(date.slice(0,7))}</small><strong>${new Date(date).toLocaleDateString(activeLanguage,{weekday:"long",timeZone:"UTC"})}</strong><span>${t(todayAction === "play" ? "daily.tagline" : todayAction === "replay" ? "daily.replay" : "daily.resume")}</span></div></section><div class="month-nav calendar-nav"><button id="prev-month" aria-label="${t("ui.previous-month")}" ${calendarMonth <= FIRST_MONTH ? "disabled" : ""}>${icon("back")}</button><details id="calendar-picker" ${pickerOpen ? "open" : ""}><summary aria-label="${t("ui.choose-month")}">${monthName(calendarMonth)}</summary>${calendarControls()}</details><button id="next-month" aria-label="${t("ui.next-month")}" ${calendarMonth >= today().slice(0, 7) ? "disabled" : ""}>${icon("arrow")}</button></div><div class="calendar">${[t("ui.mon"), t("ui.tue"), t("ui.wed"), t("ui.thu"), t("ui.fri"), t("ui.sat"), t("ui.sun")].map((x) => `<span>${x}</span>`).join("")}${"<i></i>".repeat(weekday)}${days(
      calendarMonth,
    )
      .map(
        (d) =>
          `<button class="task ${dailyDone(progress.done,d) ? "done" : ""} ${d === today() ? "today" : ""}" data-game="${dailyIdFor(d,progress)}" ${!availableDay(d) ? "disabled" : ""} ${d === date ? 'aria-current="date"' : ""} aria-label="${taskDate(d, true)}${dailyDone(progress.done,d) ? t("ui.solved") : ""}">${Number(d.slice(-2))}${dailyDone(progress.done,d) ? "<small>✓</small>" : ""}</button>`,
      )
      .join(
        "",
      )}</div><p class="fine calendar-note">${t("ui.you-can-play-past-days-any-time")}</p><details id="calendar-extras" ${calendarExtrasOpen ? "open" : ""}><summary>${t("calm.calendar.more")}</summary>${streakPanel()}<section class="calendar-trophies" aria-label="${t("ui.monthly-trophies")}">${trophyMark(calendarMonth, monthTrophy.count, days(calendarMonth).length)}</section><p>${t("ui.of-puzzles-solved", { "0": monthTrophy.count, "1": days(calendarMonth).length })}</p><details class="explanation"><summary>${t("ui.how-streaks-work")}</summary><p>${t("ui.solve-todays-puzzle-today-archive-puzzles-count-towards-monthly")}</p></details><details class="explanation"><summary>${t("ui.monthly-trophies")}</summary><p>${t("ui.bronze-7-puzzles-silver-14-gold-the-whole-month-2")}</p></details></details><button class="primary calendar-today" id="today-task" data-continue="${todayId}">${t("calm.calendar." + todayAction, { date: taskDate(date) })}</button>`;
  } else {
    html += `<h2>${t("ui.collection")}</h2><div class="collection-tabs" role="group" aria-label="${t("ui.collection-section")}"><button id="jars-tab" aria-pressed="${collectionTab === "jars"}">${t("ui.jars")}</button><button id="trophies-mode" aria-pressed="${collectionTab === "months"}">${t("ui.monthly-trophies")}</button></div>`;
    const j = jarState(storedJarView().meter);
    const { start: shelfStart, end: shelfEnd } = jarShelfBounds(j.index);
    const seedCount = storedJarView().seeds;
    const seedNoun = word(seedCount, t("ui.seed"), t("ui.seed-plural"), t("ui.seeds"));
    html += `<section class="jar-collection" ${collectionTab !== "jars" ? "hidden" : ""}>${jarHero(j)}<p class="jar-collected-count">${t("ui.collected-seeds", { "0": j.index, "1": seedCount, "2": seedNoun })}</p><div class="jar-shelf">${jarKeepsakes(shelfStart, shelfEnd)}</div>${jarShelfNavigation(j.index, shelfStart, shelfEnd)}<details class="explanation"><summary>${t("ui.how-jars-fill-up")}</summary><p class="jar-percent-detail">${j.percent}% · ${t("ui.of-seeds", {"0":j.filled,"1":j.capacity})}</p><p>${t("ui.earn-two-seeds-for-each-new-move-in-classic")}</p></details><p class="jar-wins">${t("ui.boards-cleared", { "0": storedJarView().wins })}</p><p class="fine jar-rank">${jarRank(storedJarView().wins)}</p><button id="jar-play" class="secondary">${t("action.playClassic")}</button></section>`;
    html += `<section class="monthly-collection" ${collectionTab !== "months" ? "hidden" : ""}><p class="fine">${t("ui.bronze-7-puzzles-silver-14-gold-the-whole-month")}</p><label class="year-picker">${t("ui.trophy-year")}<select id="trophy-year">${years()
      .map((y) => `<option ${y === trophyYear ? "selected" : ""}>${y}</option>`)
      .join("")}</select></label>`;
    const recentMonths = months().reverse();
    const featured = recentMonths.includes(featuredTrophyMonth) ? featuredTrophyMonth : recentMonths[0];
    if (featured) {
      const current = trophy(featured, progress.done);
      const total = days(featured).length;
      html += `<section class="month-hero tier-${current.tier}"><div class="trophy-heading"><strong>${monthName(featured)}</strong><small>${t("ui.of-days", { "0": current.count, "1": total })}</small></div>${trophyMark(featured, current.count, total)}<button class="secondary" data-month="${featured}">${t("calm.calendar.openMonth")}</button></section>`;
    }
    const past = recentMonths.filter(month => month !== featured);
    if (past.length) {
      html += `<section class="past-months"><h3>${t("calm.collection.past")}</h3>${past.map(month => {
        const mark = trophy(month, progress.done);
        return `<button class="trophy trophy-row tier-${mark.tier}" data-month="${month}"><strong>${monthName(month)}</strong><small>${t("ui.days", { "0": mark.count, "1": days(month).length })}</small>${icon("arrow")}</button>`;
      }).join("")}</section>`;
    }
  }
  if (kind === "trophies") html += "</section>";
  panel.innerHTML = html;
  if (kind === "calendar") {
    const todayTask = $("today-task");
    todayTask.toggleAttribute("data-daily-pending", !progress.done.includes(todayTask.dataset.continue!));
    panel.querySelector(".calendar-hero")!.after(todayTask);
    const layout = document.createElement("div");
    layout.className = "calendar-layout";
    const activity = document.createElement("section");
    activity.className = "calendar-activity";
    const month = document.createElement("section");
    month.className = "calendar-month";
    for (const node of [...panel.children]) {
      if (node.matches(".screen-back,h2")) continue;
      (node.matches(".calendar-hero,#today-task") ? activity : month).append(node);
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
    const summary = jars.querySelector(".jar-collected-count");
    const play = jars.querySelector("#jar-play")!;
    play.className = "primary";
    overview.append(play);
    const shelf = jars.querySelector(".jar-shelf")!;
    const shelfNav = jars.querySelector(".month-nav")!;
    const shelfHeading = document.createElement("div");
    shelfHeading.className = "jar-shelf-heading";
    shelfHeading.innerHTML = `<h3>${t("ui.jars")}</h3>`;
    shelfHeading.append(shelfNav);
    shelf.before(shelfHeading);
    if (!shelf.childElementCount) {
      shelf.remove();
      shelfHeading.remove();
      const empty = document.createElement("p");
      empty.className = "jar-empty";
      empty.textContent = t("ui.nothing-yet");
      jars.prepend(empty);
    }
    for (const node of [...jars.children])
      (node.matches("h3,.progress-hero,#jar-play") || node === summary
        ? overview
        : history
      ).append(node);
    overview.append(play);
    const rules = history.querySelector("details")!;
    for (const p of [...history.querySelectorAll(":scope > p:not(.jar-empty)")]) rules.append(p);
    jars.append(overview, history);
  }
  const screenHeading = document.createElement("div");
  screenHeading.className = "screen-heading";
  screenHeading.append($("collection-back"), panel.querySelector("h2")!);
  panel.prepend(screenHeading);
  const bookAction = panel.querySelector(".notebook-action");
  if (kind === "book" || kind === "book-picker") {
    const paper = document.createElement("div");
    paper.className = "quiet-book-page";
    for (const child of [...panel.children]) if (child !== screenHeading) paper.append(child);
    panel.append(paper);
    if (bookAction) {
      notebookDock.append(bookAction);
      notebookDock.hidden = false;
    }
  }
  pinDialogHeading(panel);
  if (kind === "progress") {
    $("progress-trophies").onclick = $("progress-jar").onclick = () => {collectionTab="jars";openCollection("trophies");};
    $("progress-jar").setAttribute("aria-label",t("ui.jar-collection"));
    $("progress-book").onclick = () => {
      // An addressable progress card must open its own book, not the first
      // candidate from the last browsed catalog section.
      selectedVolume = Number($<HTMLButtonElement>("progress-book").dataset.volume);
      openCollection("book");
    };
  }
  $("collection-back").onclick = returnToPrevious;
  $("collection-back").focus({ preventScroll: true });
  panel.querySelectorAll<HTMLElement>("[data-game]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.game!;
        void switchGame(id, kind === "calendar" ? "archive" : "notebook-tile");
      }),
  );
  panel.querySelectorAll<HTMLElement>("[data-month]").forEach(
    (b) =>
      (b.onclick = () => {
        calendarMonth = b.dataset.month!;
        featuredTrophyMonth = calendarMonth;
        openCollection("calendar");
      }),
  );
  if (kind === "book") {
    $("all-books").onclick = () => openCollection("book-picker");
    const action = document.getElementById("continue-book");
    if (action) action.onclick = () => void switchGame(action.dataset.continue!, "notebook-continue");
  }
  if (kind === "book-picker") {
    function updatePicker() { openCollection("book-picker",true); }
    for (const section of panel.querySelectorAll<HTMLButtonElement>("[data-book-section]")) {
      section.onclick = () => { bookThemes = section.dataset.bookSection === "themes"; updatePicker(); };
    }
    for (const range of panel.querySelectorAll<HTMLButtonElement>("[data-book-range]")) {
      range.onclick = () => { bookRange = Number(range.dataset.bookRange); updatePicker(); };
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-volume]")) {
      button.onclick = () => {
        rememberNavigation("book");
        selectedVolume = Number(button.dataset.volume);
        openCollection("book", true);
      };
    }
  }
  if (kind === "trophies") {
    if ($("jar-play")) $("jar-play").onclick = () => { openMenu(true); openClassicNewSheet(); };
    $("jars-tab").onclick = () => {
      collectionTab = "jars";
      openCollection("trophies");
    };
    $("trophies-mode").onclick = () => {
      collectionTab = "months";
      openCollection("trophies");
    };
    bindJarShelfNavigation();
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
      void switchGame($("today-task").dataset.continue!, "calendar-today");
    };
  }
  const contentKey=kind==="book-picker"?`${bookThemes}:${bookRange}`:kind==="trophies"?`${collectionTab}:${jarShelfPage}:${trophyYear}`:kind==="calendar"?calendarMonth:String(selectedVolume);
  dialog.dataset.contentKey=contentKey;
  if (sameScreen && contentKey!==previousKey) {
    clearInterfaceMotion();
    const local=panel.querySelector(kind==="calendar"?".calendar":kind==="book-picker"?".volume-shelf":kind==="trophies"?(collectionTab==="jars"?".jar-collection":".monthly-collection"):".quiet-book-page");
    presentMenuChange(local??panel,"page");
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
$("classic-mode").onclick = () => openClassicNewSheet();
$("book-mode").onclick = openHomeNotebook;
bookQuick.onclick = () => {
  const target = notebookTarget(progress);
  if (target) void switchGame(target, "home-notebook-quick");
};
$("daily-mode").onclick = () => void switchGame(dailyIdFor(today(),progress),"home-daily");
$("calendar-open").onclick = () => {
  calendarMonth = today().slice(0, 7);
  openCollection("calendar");
};
$("progress-open").onclick = () => openCollection("progress");
function nextBookVolume() {
  const target = notebookTarget(progress);
  return target ? volumeOf(target) : MAIN_BOOKS - 1;
}
function openHomeNotebook() {
  if (busy) return;
  rememberNavigation("book");
  selectedVolume = nextBookVolume();
  bookThemes = Boolean(themeOf(selectedVolume));
  if (!bookThemes) bookRange = Math.floor(selectedVolume / 20);
  openCollection("book", true);
}
function renderNotebook() {
  const done = new Set(progress.done);
  const tasks = volumeTasks(selectedVolume);
  const { solved } = notebookBrowseStatus(progress, selectedVolume, done);
  const target = notebookTarget(progress, selectedVolume);
  const tiles = tasks.map(({id},i) => {
    const isDone = done.has(id), isStarted = notebookStarted(progress,id);
    const isNext = id === target;
    const status = [isDone ? t("ui.solved") : "", isStarted ? t("nav.started") : ""].filter(Boolean).join(" · ");
    const label = t("ui.puzzle-2", {"0":i + 1,"1":status}).trim();
    return `<button class="task ${isDone ? "done" : isStarted ? "started" : ""} ${isNext ? "recommended" : ""}" data-game="${id}"
      ${isNext ? 'aria-current="true"' : ""} aria-label="${label}">${i+1}${isStarted ? '<small>▸</small>' : isDone ? '<small>✓</small>' : ""}</button>`;
  }).join("");
  const toolbar = `<div class="notebook-toolbar"><span>${t("ui.of-24-puzzles",{"0":solved})}</span><button class="text-button" id="all-books">${t("nav.booksAll")}</button></div>`;
  const cta = target ? `<button class="primary" id="continue-book" data-continue="${target}">${t("ui.puzzle", {
    "0":notebookStarted(progress,target) ? t("daily.resume") : t("action.start"),
    "1":puzzleNumberInVolume(target)})}</button>` : `<p>${t("nav.pickTask")}</p>`;
  return `<h2>${volumeLabel(selectedVolume)}</h2>${toolbar}
    <div class="task-grid compact-task-grid">${tiles}</div><div class="notebook-action">${cta}</div>`;
}
function renderNotebookPicker() {
  const done = new Set(progress.done);
  const volumes = Array.from({length:VOLUMES},(_,volume)=>volume)
    .filter(volume=>Boolean(themeOf(volume))===bookThemes)
    .map(volume=>({volume, ...notebookBrowseStatus(progress,volume,done)}));
  const ranges = [...new Set(volumes.map(({volume})=>Math.floor(volume/20)))];
  if (!bookThemes && ranges.length && !ranges.includes(bookRange)) bookRange = ranges[0];
  const rangeButtons = bookThemes ? "" : `<div class="book-ranges">${Array.from({length:5},(_,i)=>
    `<button class="text-button" id="book-range-${i}" data-book-range="${i}" aria-pressed="${bookRange===i}" ${ranges.includes(i)?"":"disabled"}>${i*20+1}–${(i+1)*20}</button>`).join("")}</div>`;
  const buttons = volumes.filter(({volume})=>bookThemes || Math.floor(volume/20)===bookRange)
    .map(({volume,solved,started})=>`<button class="volume-cover ${solved===24?"done":started?"started":""}" data-volume="${volume}" aria-pressed="${volume===selectedVolume}"
      aria-label="${bookThemes ? volumeLabel(volume)+", "+solved+"/24" : t("ui.puzzle-book-of-24",{"0":volume+1,"1":solved})}">${bookThemes
        ? `<span class="volume-illustration" aria-hidden="true"></span><strong class="volume-title">${volumeLabel(volume)}</strong><small>${solved}/24${solved===24?" ✓":started?" ▸":""}</small>`
        : `<span class="volume-illustration" aria-hidden="true"><strong${volume===99?' class="volume-number-long"':""}>${volume+1}</strong></span><small>${solved}/24${solved===24?" ✓":started?" ▸":""}</small>`}</button>`).join("");
  return `<h2>${t("nav.booksAll")}</h2><div class="book-sections" role="group" aria-label="${t("nav.booksAll")}">
    <button id="book-section-main" data-book-section="main" aria-pressed="${!bookThemes}">${t("nav.bookMain")}</button>
    <button id="book-section-themes" data-book-section="themes" aria-pressed="${bookThemes}">${t("nav.bookThemes")}</button></div>
    ${rangeButtons}<div class="volume-shelf compact-volume-shelf ${bookThemes?"theme-shelf":""}">${buttons}</div>`;
}
function volumeLabel(volume: number) {
  const theme = themeOf(volume);
  return theme ? t("content.theme."+theme) : t("ui.puzzle-book", {"0":volume+1});
}
function taskLabel(id: string) {
  const volume=volumeOf(id), puzzle=puzzleNumberInVolume(id);
  return themeOf(volume) ? t("content.task", {theme:volumeLabel(volume),puzzle}) : t("home.book.title",{book:volume+1,puzzle});
}
function bookPicture(number: number) {
  const compact = number >= 100 ? " book-cover-number-compact" : "";
  return `<span class="book-picture" aria-hidden="true"><span class="book-cover"><span class="book-cover-number${compact}">№${number}</span></span></span>`;
}
function calendarPicture(day: string, showMonth = false) {
  const month = showMonth
    ? new Date(day).toLocaleDateString(activeLanguage, { month: "short", timeZone: "UTC" })
    : "";
  return `<span class="calendar-picture${showMonth ? " calendar-picture-with-month" : ""}" aria-hidden="true"><span>${Number(day.slice(-2))}</span>${showMonth ? `<span class="calendar-picture-month">${month}</span>` : ""}</span>`;
}
function jarGrains(count: number) {
  // Small independent seed silhouettes, not a second counter or source of rewards.
  return Array.from({ length: Math.min(36, Math.max(0, Math.floor(count))) }, (_, i) => {
    const row = Math.floor(i / 5), col = i % 5;
    const x = 8 + col * 18 + (row % 2 ? 5 : 0);
    const tilt = [-34, 16, -13, 28, -7][(i + row) % 5];
    return `<i style="--grain-x:${x}%;--grain-y:${1 + row * 7}px;--grain-tilt:${tilt}deg"></i>`;
  }).join("");
}
function jarGlass(id?: string, seedCount = 0) {
  return `<span class="jar-glass"${id ? ` id="${id}"` : ""}><span class="jar-interior"><span class="jar-fill"><span class="jar-grains" aria-hidden="true" data-count="${seedCount}">${jarGrains(seedCount)}</span></span></span><span class="jar-lid"></span></span>`;
}
function syncJarGrains(host: HTMLElement, seedCount: number) {
  const grains = host.querySelector<HTMLElement>(".jar-grains");
  if (!grains || grains.dataset.count === String(seedCount)) return;
  grains.dataset.count = String(seedCount);
  grains.innerHTML = jarGrains(seedCount);
}
function jarPicture(j: ReturnType<typeof jarState>) {
  return `<span class="jar-picture" style="--fill:${j.filled / j.capacity * 100}%;--jar-color:${j.color}" aria-hidden="true">${jarGlass(undefined, j.filled)}</span>`;
}
function jarHero(j: ReturnType<typeof jarState>) {
  return `<section class="progress-hero" aria-label="${t("ui.next-jar")}">${jarPicture(j)}<div><span class="hero-kicker">${t("ui.jar-3", { "0": j.index + 1 })}</span><h3 class="hero-jar-name">${j.name}</h3><p class="hero-count">${t("ui.of-seeds", { "0": j.filled, "1": j.capacity })}</p><progress max="${j.capacity}" value="${j.filled}" aria-label="${t("ui.jar-fill")}"></progress><p class="fine">${t("ui.to-the-next-jar", { "0": j.capacity - j.filled })}</p><span class="progress-jar-cue">${t("ui.jar-collection")}${icon("arrow")}</span></div></section>`;
}
function jarShelfBounds(index: number) {
  jarShelfPage = Math.min(jarShelfPage, Math.max(0, Math.ceil(index / 12) - 1));
  const end = index - jarShelfPage * 12;
  return { start: Math.max(0, end - 12), end };
}
function jarKeepsakes(start: number, end: number) {
  return Array.from({length:end-start}, (_,n) => {
    const i=start+n;
    return `<div class="jar-keepsake" style="--jar-color:${jarColors[i%6]};--fill:100%">${jarGlass(undefined,24)}<small>${localName(jarNames[i%6])} · ${i+1}</small></div>`;
  }).join("");
}
function jarShelfNavigation(index: number, start: number, end: number) {
  return `<div class="month-nav" ${index ? "" : "hidden"}><button id="older-jars" ${start===0 ? "disabled" : ""}>${t("ui.earlier")}</button><span>${index ? `${start+1}–${end}` : t("ui.nothing-yet")}</span><button id="newer-jars" ${jarShelfPage===0 ? "disabled" : ""}>${t("ui.newer")}</button></div>`;
}
function bindJarShelfNavigation() {
  const older=document.getElementById("older-jars"),newer=document.getElementById("newer-jars");
  if(older)older.onclick=()=>{jarShelfPage++;openCollection("trophies");};
  if(newer)newer.onclick=()=>{jarShelfPage--;openCollection("trophies");};
}
function jarRank(wins: number) {
  return t(wins>=100 ? "ui.master-100-boards" : wins>=25 ? "ui.expert-25-boards" : wins>=5 ? "ui.solid-start-5-boards" : "ui.clear-5-boards-to-earn-your-first-badge");
}
function difficultyLabel() {
  const level = classicDifficulty();
  return `${localName(classicDifficultyNames[level])}${level === CLASSIC_MIN ? " "+t("ui.lowest") : level === CLASSIC_MAX ? " "+t("ui.highest") : ""}`;
}
function renderHomeCurrent() {
  const id = progress.active;
  homeCurrent.toggleAttribute("data-archived", id.startsWith("daily") && id.slice(9) !== today());
  const count = occupied(board());
  const isClassic = id === "classic";
  const book = id.startsWith("book");
  const next = book && !count ? notebookTarget(progress) : undefined;
  const show = lesson >= 0 || Boolean(next) ||
    count > 0 && (isClassic ? classicParked() : Boolean(progress.sessions[id]));
  homeCurrent.hidden = false;
  homeCurrent.toggleAttribute("data-new-game", !show);
  homePreview.hidden = lesson >= 0 || count === 0;
  if (!homePreview.hidden && show) {
    const cells = board().slice(0, 27);
    homePreview.replaceChildren(...cells.map(digit => {
      const cell = document.createElement("span");
      cell.textContent = digit ? String(digit) : "";
      return cell;
    }));
  }
  homeGoal.hidden = true;
  $("new").hidden = lesson >= 0 || !unfinished(session);
  $("new").textContent = isClassic ? t("ui.restart") : t("ui.restart-puzzle");
  if (!show) {
    homePreview.hidden = false;
    homePreview.replaceChildren(...classic().slice(0,18).map(digit => {
      const cell = document.createElement("span");
      cell.textContent = String(digit);
      return cell;
    }));
    $("home-game-title").textContent = t("calm.classic.new");
    $("resume-context").textContent = t("calm.classic.startNote");
    $("resume").hidden = false;
    $("resume").textContent = t("action.start");
    return;
  }
  $("resume").hidden = false;
  if (lesson >= 0) {
    $("home-game-title").textContent = t("ui.tutorial");
    $("resume-context").textContent = t("ui.step-of", {"0": lesson+1,"1":shortLesson?2:lessons.length});
    $("resume").textContent = t("ui.continue-tutorial");
    return;
  }
  const date = !isClassic && !book ? taskDate(id.slice(9),id.slice(9,13)!==today().slice(0,4)) : "";
  $("home-game-title").textContent = isClassic ? t("home.classic")
    : book ? volumeLabel(volumeOf(next ?? id)) : id.slice(9) === today()
      ? t("notification.channel") : t("home.daily.date", {date});
  $("resume-context").textContent = isClassic ? `${difficultyLabel()} · ${count} ${digitWord(count)}`
    : book ? next ? t("nav.bookTaskTarget",{book:volumeLabel(volumeOf(next)),task:puzzleNumberInVolume(next)})
      : t("ui.puzzle-3",{"0":puzzleNumberInVolume(id),"1":count,"2":digitWord(count)})
    : `${date} · ${count} ${digitWord(count)}`;
  if (book && !next) {
    homeGoal.hidden = false;
    const done = notebookBrowseStatus(progress,volumeOf(id),new Set(progress.done)).solved;
    $("home-goal-caption").textContent = t("ui.of-24-puzzles",{"0":done});
    homeGoal.querySelector("progress")!.value = done;
  }
  $("resume").textContent = next
    ? t("ui.puzzle",{"0":notebookStarted(progress,next)?t("daily.resume"):t("action.start"),"1":puzzleNumberInVolume(next)})
    : isClassic ? t("ui.resume-classic") : book ? t("ui.resume-puzzle",{"0":puzzleNumberInVolume(id)})
    : id.slice(9) === today() ? t("daily.resumeToday") : t("ui.resume-puzzle-for",{"0":date});
}
function refreshStaticJarViews() {
  if (!dialog.open || busy || paused || adActive || engagementActive || rewardRequest) return;
  const screen = dialog.dataset.screen;
  if (screen === "home") { updateHomeJar(); return; }
  if (screen !== "progress" && screen !== "trophies") return;
  const j=jarState(storedJarView().meter),template=document.createElement("template");
  template.innerHTML=jarHero(j);
  // Keep the buttons, focus, held contacts, details and scroll owners in place.
  for(const hero of $("collection").querySelectorAll(".progress-hero")) {
    const fresh=template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    hero.replaceChildren(...fresh.childNodes);
  }
  if(screen!=="trophies")return;
  const collection=$("collection").querySelector<HTMLElement>(".jar-collection");
  const history=collection?.querySelector<HTMLElement>(".jar-history");
  if(!collection||!history)return;
  const {start,end}=jarShelfBounds(j.index);
  let shelf=history.querySelector<HTMLElement>(".jar-shelf");
  if(j.index&&!shelf) {
    const heading=document.createElement("div");heading.className="jar-shelf-heading";
    heading.innerHTML=`<h3>${t("ui.jars")}</h3>${jarShelfNavigation(j.index,start,end)}`;
    shelf=document.createElement("div");shelf.className="jar-shelf";
    history.querySelector(".jar-empty")?.remove();history.prepend(heading,shelf);
    bindJarShelfNavigation();
  }
  if(shelf)shelf.innerHTML=jarKeepsakes(start,end);
  const nav=history.querySelector<HTMLElement>(".month-nav");
  if(nav) {
    nav.hidden=!j.index;
    const older=nav.querySelector<HTMLButtonElement>("#older-jars"),newer=nav.querySelector<HTMLButtonElement>("#newer-jars");
    if(older)older.disabled=start===0;
    if(newer)newer.disabled=jarShelfPage===0;
    const label=nav.querySelector("span");if(label)label.textContent=j.index ? `${start+1}–${end}` : t("ui.nothing-yet");
  }
  const seeds=storedJarView().seeds,wins=storedJarView().wins;
  const copy:Record<string,string>={
    '.jar-collected-count':t("ui.collected-seeds",{"0":j.index,"1":seeds,"2":word(seeds,t("ui.seed"),t("ui.seed-plural"),t("ui.seeds"))}),
    '.jar-percent-detail':`${j.percent}% · ${t("ui.of-seeds",{"0":j.filled,"1":j.capacity})}`,
    '.jar-wins':t("ui.boards-cleared",{"0":wins}),'.jar-rank':jarRank(wins),
  };
  for(const [selector,text] of Object.entries(copy)){const node=collection.querySelector(selector);if(node)node.textContent=text;}
}
function updateHomeJar() {
  const jar = jarState(storedJarView().meter);
  homeJar.setAttribute("aria-label", t("ui.jar-collection"));
  homeJar.innerHTML = jarPicture(jar);
}
function updateHome() {
  updateHomeJar();
  const finished = new Set(progress.done);
  const target = notebookTarget(progress);
  const volume = target ? volumeOf(target) : nextBookVolume();
  const solved = notebookBrowseStatus(progress, volume, finished).solved;
  const bookMode = $("book-mode");
  bookMode.querySelector(".book-picture")!.outerHTML = bookPicture(volume + 1);
  const context = target
    ? t("nav.bookTaskTarget",{book:volumeLabel(volume),task:puzzleNumberInVolume(target)})
    : t("nav.mainComplete");
  $("book-count").textContent = target ? `${context} · ${solved}/24` : context;
  bookTaskCaption.textContent = target
    ? t("ui.puzzle-2", {"0": puzzleNumberInVolume(target), "1": ""}).trim()
    : context;
  bookMode.setAttribute("aria-label", `${t("home.books")}. ${context}`);
  bookQuick.hidden = progress.active.startsWith("book") || !target;
  if (target) {
    bookQuick.textContent = notebookStarted(progress,target) ? t("daily.resume") : t("action.start");
    bookQuick.setAttribute("aria-label",`${bookQuick.textContent}. ${context}`);
  }
  updateHomeDaily();
}
function updateHomeDaily() {
  const date = today();
  const id = dailyIdFor(date,progress);
  const status = homeDailyStatus(confirmedDaily ?? homeDailySnapshot(progress), date, id);
  const doneToday = status === "done";
  const startedToday = status === "started";
  const dailyCaption = t(doneToday ? "daily.replay" : startedToday ? "daily.resume" : "daily.tagline");
  $("daily-mode").toggleAttribute("data-daily-pending", !doneToday);
  $("daily-mode").toggleAttribute("data-daily-started", startedToday);
  $("daily-mode").dataset.dailyStatus = status;
  $("daily-mode").setAttribute("aria-label", `${t("notification.channel")}. ${taskDate(date)}. ${dailyCaption}`);
  // Keep both the illustration and its pseudo-element animation alive across
  // ordinary renders/saves. Only an actual date/language change replaces copy.
  const art = $("home-today-art");
  const artKey = `${date}:${activeLanguage}`;
  if (art.dataset.date !== artKey) {
    art.innerHTML = calendarPicture(date, true);
    art.dataset.date = artKey;
  }
  const run = dailyRun(confirmedDaily
    ? {...progress, meta: {...metadata(progress), daily: confirmedDaily.daily}}
    : progress);
  $("daily-series").hidden = run.count === 0;
  $("daily-series").textContent =
    t("ui.in-a-row", { "0": run.count, "1": dayWord(run.count), "2": run.solvedToday ? "" : t("ui.until-reward", { "0": run.until, "1": dayWord(run.until) }) });
  $("daily-state").textContent = doneToday ? t("home.daily.done") : dailyCaption;
}
let displayedDate = today();
function refreshDate() {
  const date = today();
  if (displayedDate === date || busy) return;
  displayedDate = date;
  updateHome();
  // Refresh the label in place: rendering the board would replace feedback and focus.
  if (lesson < 0 && progress.active.startsWith("daily")) {
    $("mode").textContent = dailyFieldTitle(progress.active, date);
    if (!$("win").hidden) renderWin();
    if (dialog.open && dialog.dataset.screen === "home") renderHomeCurrent();
  }
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
}
setInterval(refreshDate, 1000);
window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", refreshDate);

clearContact = installInterfaceMotion(
  control => {if(!control.closest("#help-lab"))feedback("button");},
  () => paused || document.hidden,
);
refreshStaticCopy = staticCopy($("app"));
void boot();

function renderJar() {
  const meter = $("jar-meter");
  meter.hidden = lesson >= 0;
  (document.querySelector("header .brand") as HTMLElement).hidden =
    !meter.hidden;
  if (meter.hidden) return;
  visualSeeds ??= jars(progress).meter;
  const j = jarState(visualSeeds);
  const celebrating = Boolean(completedJar) && !jarPending;
  if (completedJar) {
    j.index = completedJar!.index;
    j.percent = 100;
    j.filled = j.capacity = completedJar!.capacity;
    j.name = localName(jarNames[j.index % 6]);
    j.color = jarColors[j.index % 6];
  }
  meter.style.setProperty("--jar-color", j.color);
  meter.style.setProperty("--fill", `${j.filled / j.capacity * 100}%`);
  syncJarGrains(meter, j.filled);
  const through = celebrating ? jarState(visualSeeds).index : j.index + 1;
  const ordinal = through > j.index + 1 ? `${j.index+1}–${through}` : j.index+1;
  $("jar-name").textContent = t("ui.jar-3", { "0": ordinal });
  $("jar-percent").textContent = `${j.percent}%`;
  meter.dataset.full = String(Boolean(celebrating));
  $("jar-collected").title = celebrating ? t("ui.jar-collected") : "";
  meter.dataset.filled = String(j.filled);
  meter.dataset.capacity = String(j.capacity);
  meter.setAttribute(
    "aria-label",
    t("ui.jar-percent-full-of-open-collection", { "0": j.index + 1, "1": celebrating ? t("ui.collected") : "", "2": j.percent, "3": j.filled, "4": j.capacity }),
  );
  updateResultJar();
}
function updateResultJar() {
  if (resultJarCard.hidden) return;
  const total = jars(progress).meter;
  const displayed = visualSeeds ?? total;
  const j = jarState(resultAwaitingSave === session ? Math.min(displayed, total - earnedSeeds - resultPairSeeds) : displayed);
  if (completedJar) Object.assign(j,{index:completedJar.index,filled:completedJar.capacity,capacity:completedJar.capacity,percent:100,
    name:localName(jarNames[completedJar.index%6]),color:jarColors[completedJar.index%6]});
  resultJarCard.dataset.filled=String(j.filled);
  resultJarCard.dataset.capacity=String(j.capacity);
  resultJarCard.dataset.jarIndex=String(j.index);
  resultJarCard.style.setProperty("--jar-color", j.color);
  resultJarCard.style.setProperty("--fill", `${j.filled / j.capacity * 100}%`);
  syncJarGrains(resultJarCard, j.filled);
  const lastJar=jarState(displayed).index;
  const ordinal=lastJar>j.index+1 ? `${j.index+1}–${lastJar}` : j.index+1;
  $("result-jar-amount").textContent = completedJar && !jarPending
    ? `${t("feel.jar.collected",{number:ordinal})} · ${j.filled}/${j.capacity}`
    : `${j.name} · ${t("ui.of-seeds", {"0":j.filled,"1":j.capacity})}`;
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
  return `<div class="archive-controls"><label>${t("ui.year")}<select id="calendar-year">${years()
    .map(
      (y) =>
        `<option ${calendarMonth.startsWith(y) ? "selected" : ""}>${y}</option>`,
    )
    .join(
      "",
    )}</select></label><label>${t("ui.month")}<select id="calendar-month">${Array.from(
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
  return word(n,t("ui.day"),t("ui.days-3"),t("ui.days-2"));
}
function streakPanel() {
  const r = dailyRun(progress),
    base = Math.floor(Math.max(0, r.nextCount - 1) / 7) * 7;
  return `<section class="daily-run" aria-label="${t("ui.daily-streak")}"><div class="run-heading"><strong>${r.count ? t("ui.in-a-row-2", { "0": r.count, "1": dayWord(r.count) }) : t("ui.new-streak")}</strong><span>${t("ui.best", { "0": r.best })}</span></div><div class="run-days">${Array.from(
    { length: 7 },
    (_, i) => {
      const n = base + i + 1;
      return `<span class="${n <= r.count ? "done" : n === r.nextCount ? "next" : ""}" aria-label="${t("ui.day-2", { "0": n, "1": n <= r.count ? t("ui.counted") : "" })}">${n <= r.count ? "✓" : n}</span>`;
    },
  ).join(
    "",
  )}</div><p>${t("ui.until-reward-2", { "0": r.until, "1": dayWord(r.until), "2": streakReward(r.nextMilestone), "3": hintWord(streakReward(r.nextMilestone)) })}</p></section>`;
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
function updateEngagementCopy() {
  const wallet = metadata(progress).wallet;
  $("settings-reserve-title").textContent = t("calm.settings.stock");
  $("hint-wallet").textContent =
    t("ui.shared-balance-your-three-free-hints-for-this-game", { "0": wallet, "1": hintWord(wallet) });
}
async function requestAutomaticReminders() {
  if (
    !engagementBridge ||
    engagementActive ||
    busy ||
    adActive ||
    rewardRequest
  )
    return;
  if (!notificationGranted) {
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
      updateEngagementCopy();
      const state = await requestNotificationPermission(engagementBridge);
      if (!state.available) throw new Error("notification_unavailable");
      notificationGranted = state.granted;
      const errorIndex = flags.indexOf("reminder_permission_error");
      if (errorIndex >= 0) flags.splice(errorIndex, 1);
      const deniedIndex=flags.indexOf("reminder_permission_denied");
      if (!state.granted && deniedIndex<0) flags.push("reminder_permission_denied");
      if (state.granted && deniedIndex>=0) flags.splice(deniedIndex,1);
      track("reminder_permission", { granted: state.granted });
    } catch {
      if (!flags.includes("reminder_permission_error"))
        flags.push("reminder_permission_error");
      // Preserve the reminder preference on a bridge failure; this is not a
      // user's denial. Its saved request marker prevents automatic retries.
      await save();
      return;
    } finally {
      engagementActive = false;
      notificationRequestPending = false;
      notificationSaving = false;
      lastExternalAt = performance.now();
      syncPauseState();
      updateEngagementCopy();
    }
  }
  // New Android refusals are system state, distinct from legacy game opt-outs.
  // A later explicit grant in Android can resume the automatic policy.
  await save();
  updateEngagementCopy();
}
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
    storageConflict ||
    saveFailed ||
    moveSavePending ||
    resultAwaitingSave === session
  )
    return;
  pendingDailyOpen = false;
  skipNextInterstitial = true;
  track("reminder_open");
  const id = dailyIdFor(today(),progress);
  await switchGame(id);
  if (progress.active !== id || saveFailed || storageConflict || futureSave)
    pendingDailyOpen = true;
}
async function tryResultEngagement() {
  if (rewardScene || jarMilestone || resultAwaitingSave === session || moveSavePending) return;
  if (
    engagementAvailable &&
    settings.reminders &&
    !notificationGranted &&
    !metadata(progress).flags?.includes("reminder_permission_requested") &&
    metadata(progress).completed > 0 &&
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
    await requestAutomaticReminders();
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
    settings.reminders &&
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
  if(scenes.length && !qaTools.isConnected)$("menu-content").append(qaTools);
  for (const scene of scenes) {
    const scenario = document.createElement("button"); scenario.id = qaProfile==="all"?`qa-${scene}-scene`:"qa-help-scene"; scenario.className = "secondary";
    scenario.textContent = scene === "magnet" ? "QA: пример Магнита" : scene === "plan" ? "QA: пример плана" : "QA: подсказки за видео";
    qaTools.append(scenario);
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
