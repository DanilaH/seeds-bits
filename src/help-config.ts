import type { Assignment, HelpProfile } from "./help-contract";
// Current delivery is baseline. Prior profiles remain explicit developer diagnostics only.
// Public builds keep every experiment off and ignore URL overrides.
const profiles = [
  "a3",
  "magnet",
  "plan",
  "result",
  "trials",
  "shuffle",
  "all",
  "baseline",
];
const configured = import.meta.env.VITE_SEEDS_QA_PROFILE ?? "";
const override = import.meta.env.DEV
  ? (new URLSearchParams(globalThis.location?.search ?? "").get("qa") ??
    configured)
  : configured;
export const qaProfile = profiles.includes(override) ? override : "";
// A deliberate owner pause hides even previously earned assistant UI; stock remains saved.
export const helpPaused = !qaProfile || qaProfile === "baseline";
export const helpFlags = Object.freeze({
  visibility: qaProfile === "all" || qaProfile === "a3",
  magnet: qaProfile === "all" || qaProfile === "magnet",
  plan: qaProfile === "all" || qaProfile === "plan",
  result: qaProfile === "all" || qaProfile === "result",
  trials: qaProfile === "all" || qaProfile === "trials",
  shuffle: qaProfile === "all" || qaProfile === "shuffle",
});
export const helpConfig = "help-v1";
export function assignHelp(p: HelpProfile, existing: boolean): Assignment {
  const experiment =
    qaProfile === "baseline"
      ? "seeds-baseline-qa-v1"
      : qaProfile === "all"
        ? "seeds-all-qa-v1"
        : qaProfile
          ? `seeds-${qaProfile}-v1`
          : "seeds-help-base-v1";
  const found = p.assignments.find((a) => a.experiment === experiment);
  if (found) return found;
  const assignment: Assignment = {
    install: p.install,
    experiment,
    config: helpConfig,
    variant: qaProfile && qaProfile !== "baseline" ? "candidate" : "control",
    qa: Boolean(qaProfile),
    cohort: existing ? "existing" : "new",
    anchor: Date.now(),
  };
  p.assignments.push(assignment);
  p.assignments = p.assignments.slice(-8);
  return assignment;
}
