const clampInteger = (value: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number => {
  const safe = Number.isFinite(value) ? Math.floor(value) : minimum;
  return Math.min(maximum, Math.max(minimum, safe));
};

export interface ValueTransferProfile {
  minDurationMs: number;
  maxDurationMs: number;
  maxVisualTokens?: number;
  maxAudioEvents?: number;
  durationSemanticCap?: number;
  durationPerSemanticUnitMs?: number;
  flightBaseMs?: number;
  flightPerVisualTokenMs?: number;
  maxFlightDurationMs?: number;
}

export interface ValueTransferPlan {
  /** Durable amount represented by the presentation. */
  semanticAmount: number;
  /** Number of visual objects to animate; intentionally independent from semanticAmount. */
  visualTokenCount: number;
  durationMs: number;
  flightDurationMs: number;
  emissionWindowMs: number;
  audioStride: number;
}

const DEFAULT_MAX_VISUAL_TOKENS = 36;
const DEFAULT_MAX_AUDIO_EVENTS = 36;
const DEFAULT_DURATION_SEMANTIC_CAP = 150;
const DEFAULT_DURATION_PER_SEMANTIC_UNIT_MS = 4;
const DEFAULT_FLIGHT_BASE_MS = 175;
const DEFAULT_FLIGHT_PER_VISUAL_TOKEN_MS = 0.34;
const DEFAULT_MAX_FLIGHT_DURATION_MS = 225;

/**
 * Builds a bounded presentation plan for an already-owned value transfer.
 *
 * The important contract is that semantic value and visual density are separate.
 * A reward of 5,000 can therefore animate 18 tokens while the counter still lands on +5,000.
 */
export const createValueTransferPlan = (
  amount: number,
  profile: ValueTransferProfile,
): ValueTransferPlan => {
  const semanticAmount = clampInteger(amount, 0);
  const minDurationMs = Math.max(0, profile.minDurationMs);
  const maxDurationMs = Math.max(minDurationMs, profile.maxDurationMs);
  const maxVisualTokens = clampInteger(profile.maxVisualTokens ?? DEFAULT_MAX_VISUAL_TOKENS, 1);
  const maxAudioEvents = clampInteger(profile.maxAudioEvents ?? DEFAULT_MAX_AUDIO_EVENTS, 1);
  const durationSemanticCap = clampInteger(
    profile.durationSemanticCap ?? DEFAULT_DURATION_SEMANTIC_CAP,
    0,
  );
  const durationPerSemanticUnitMs = Math.max(
    0,
    profile.durationPerSemanticUnitMs ?? DEFAULT_DURATION_PER_SEMANTIC_UNIT_MS,
  );
  const flightBaseMs = Math.max(0, profile.flightBaseMs ?? DEFAULT_FLIGHT_BASE_MS);
  const flightPerVisualTokenMs = Math.max(
    0,
    profile.flightPerVisualTokenMs ?? DEFAULT_FLIGHT_PER_VISUAL_TOKEN_MS,
  );
  const maxFlightDurationMs = Math.max(
    flightBaseMs,
    profile.maxFlightDurationMs ?? DEFAULT_MAX_FLIGHT_DURATION_MS,
  );

  const visualTokenCount = semanticAmount === 0 ? 0 : Math.min(semanticAmount, maxVisualTokens);
  const durationMs = Math.min(
    maxDurationMs,
    Math.max(
      minDurationMs,
      minDurationMs + Math.min(durationSemanticCap, semanticAmount) * durationPerSemanticUnitMs,
    ),
  );
  const flightDurationMs = Math.min(
    maxFlightDurationMs,
    flightBaseMs + visualTokenCount * flightPerVisualTokenMs,
  );
  const emissionWindowMs = Math.max(0, durationMs - flightDurationMs);
  const audioStride = Math.max(1, maxAudioEvents === 1 ? Math.max(1, visualTokenCount) : Math.ceil(Math.max(1, visualTokenCount - 1) / (maxAudioEvents - 1)));

  return {
    semanticAmount,
    visualTokenCount,
    durationMs,
    flightDurationMs,
    emissionWindowMs,
    audioStride,
  };
};

export const valueTransferEmissionDelay = (plan: ValueTransferPlan, visualIndex: number): number => {
  if (plan.visualTokenCount <= 1) return 0;
  const clampedIndex = clampInteger(visualIndex, 0, plan.visualTokenCount - 1);
  return (plan.emissionWindowMs * clampedIndex) / (plan.visualTokenCount - 1);
};

/**
 * Returns the cumulative durable value the UI counter should show after this visual token lands.
 * The final visual token always resolves to the full semantic amount.
 */
export const valueAfterVisualArrival = (plan: ValueTransferPlan, visualIndex: number): number => {
  if (plan.visualTokenCount <= 0 || plan.semanticAmount <= 0) return 0;
  const clampedIndex = clampInteger(visualIndex, 0, plan.visualTokenCount - 1);
  return Math.floor((plan.semanticAmount * (clampedIndex + 1)) / plan.visualTokenCount);
};

export const valueTransferProgress = (plan: ValueTransferPlan, visualIndex: number): number => {
  if (plan.visualTokenCount <= 0) return 1;
  const clampedIndex = clampInteger(visualIndex, 0, plan.visualTokenCount - 1);
  return (clampedIndex + 1) / plan.visualTokenCount;
};

export const shouldPlayValueTransferCue = (plan: ValueTransferPlan, visualIndex: number): boolean => {
  if (plan.visualTokenCount <= 0) return false;
  const clampedIndex = clampInteger(visualIndex, 0, plan.visualTokenCount - 1);
  return clampedIndex === plan.visualTokenCount - 1 || (plan.audioStride < plan.visualTokenCount && clampedIndex % plan.audioStride === 0);
};
