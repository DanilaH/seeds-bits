import { occupied, type Session } from "./core";
import type { Progress } from "./progress";
import { LEGACY_BOOK_TASKS } from "./content-ids";
import { volumeOf, volumeTasks, VOLUME_SIZE } from "./notebooks";
import { notebook } from "./puzzles";

export const MAIN_BOOKS = LEGACY_BOOK_TASKS / VOLUME_SIZE;

export function hasPlayed(game: Session | undefined) {
  return Boolean(game && (game.history.length || game.current.moves || game.current.additions));
}

export function unfinished(game: Session | undefined) {
  return Boolean(game && occupied(game.current.board));
}

export function notebookStarted(progress: Progress, id: string) {
  return unfinished(progress.sessions[id]) && (hasPlayed(progress.sessions[id]) ||
    Boolean(progress.meta?.attempts[id]));
}

export function notebookBrowseStatus(progress: Progress, volume: number, done: ReadonlySet<string>) {
  const tasks = volumeTasks(volume);
  const solved = tasks.filter(task => done.has(task.id)).length;
  return { solved, started: solved > 0 || tasks.some(task => notebookStarted(progress, task.id)) };
}

/** The optional volume restricts the recommendation without changing the played context. */
export function notebookTarget(progress: Progress, volume?: number): string | undefined {
  const done = new Set(progress.done);
  const inBook = (id: string) => notebook.some(task => task.id === id) && (volume === undefined || volumeOf(id) === volume);
  const recent = progress.lastBookTask ?? progress.active;
  if (inBook(recent)) {
    if (!done.has(recent)) return recent;
    const inVolume = volumeTasks(volumeOf(recent)).find(task => !done.has(task.id));
    if (inVolume) return inVolume.id;
  }
  const choices = volume === undefined ? notebook : volumeTasks(volume);
  // Older saves have no ordering data. Use catalog order amongst actually parked tasks.
  const parked = choices.find(task => !done.has(task.id) && notebookStarted(progress, task.id));
  if (parked) return parked.id;
  return choices.find((task, i) => (volume !== undefined || i < LEGACY_BOOK_TASKS) && !done.has(task.id))?.id;
}
