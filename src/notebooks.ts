import { notebook } from "./puzzles";
import { LEGACY_BOOK_TASKS, PILOT_THEMES } from "./content-ids";
export const VOLUME_SIZE = 24,
  VOLUMES = notebook.length / VOLUME_SIZE;
export const chapterNames = [
  "Первые страницы",
  "Лёгкие линии",
  "Переплетения",
  "Простор",
  "Длинные дорожки",
  "Большие страницы",
  "Глубина",
  "Дальние маршруты",
  "Широкий горизонт",
  "Большое путешествие",
  "Тематические тетради",
];
export function volumeOf(id: string) {
  return Math.max(0, Math.floor(notebook.findIndex(p=>p.id===id) / VOLUME_SIZE));
}
export function puzzleNumberInVolume(id: string) {
  return notebook.findIndex(p=>p.id===id) % VOLUME_SIZE + 1;
}
export function volumeTasks(volume: number) {
  return notebook.slice(volume * 24, (volume + 1) * 24);
}

export function themeOf(volume: number) {
  return PILOT_THEMES[volume - LEGACY_BOOK_TASKS / VOLUME_SIZE];
}
