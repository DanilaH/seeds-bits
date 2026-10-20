import { notebook } from "./puzzles";
export const VOLUME_SIZE = 24,
  VOLUMES = 100;
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
];
export function volumeOf(id: string) {
  return Math.max(0, Math.floor((Number(id.slice(8)) - 1) / VOLUME_SIZE));
}
export function volumeTasks(volume: number) {
  return notebook.slice(volume * 24, (volume + 1) * 24);
}
