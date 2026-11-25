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
  const game = progress.sessions[id];
  const attempt = progress.meta?.attempts[id];
  return unfinished(game) && !attempt?.completed &&
    (Boolean(progress.bookPlayOrder?.includes(id)) || hasPlayed(game) || Boolean(attempt?.analyticsStarted));
}

export function recordNotebookPlay(progress: Progress, id: string) {
  if (!id.startsWith("book-") || progress.bookPlayOrder?.[0] === id) return;
  progress.bookPlayOrder = [id, ...(progress.bookPlayOrder?.filter(task => task !== id) ?? [])];
}

export function forgetNotebookPlay(progress: Progress, id: string) {
  if (progress.bookPlayOrder?.includes(id))
    progress.bookPlayOrder = progress.bookPlayOrder.filter(task => task !== id);
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
  const choices = volume === undefined ? notebook : volumeTasks(volume);
  const ordered = progress.bookPlayOrder?.find(id => inBook(id) && notebookStarted(progress, id));
  if (ordered) return ordered;
  // Before move order was saved, the catalogue is the only reliable tie-breaker.
  const parked = choices.find(task => notebookStarted(progress, task.id));
  if (parked) return parked.id;
  const recent = progress.bookPlayOrder?.find(inBook) ?? progress.lastBookTask ?? progress.active;
  if (inBook(recent)) {
    if (!done.has(recent)) return recent;
    const inVolume = volumeTasks(volumeOf(recent)).find(task => !done.has(task.id));
    if (inVolume) return inVolume.id;
  }
  return choices.find((task, i) => (volume !== undefined || i < LEGACY_BOOK_TASKS) && !done.has(task.id))?.id;
}
