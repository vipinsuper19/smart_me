/**
 * Server-authoritative reward rules. Clients never submit XP values.
 * Values are intentionally centralized so they can be made configurable later
 * without scattering magic numbers through the reward engine.
 */
export const XP_REWARDS = {
  LESSON_COMPLETED: 10,
  QUIZ_COMPLETED: 5,
  DAILY_GOAL_REACHED: 5,
} as const;

export const DEFAULT_DAILY_GOAL_MINUTES = 10;

export interface LevelThreshold {
  level: number;
  totalXp: number;
}

/**
 * Cumulative XP thresholds. A level is never lost and XP is never reset.
 * Above the last configured threshold, each level costs the same step.
 */
export const LEVEL_THRESHOLDS: readonly LevelThreshold[] = [
  { level: 1, totalXp: 0 },
  { level: 2, totalXp: 100 },
  { level: 3, totalXp: 250 },
  { level: 4, totalXp: 500 },
  { level: 5, totalXp: 900 },
  { level: 6, totalXp: 1_400 },
  { level: 7, totalXp: 2_000 },
  { level: 8, totalXp: 2_700 },
  { level: 9, totalXp: 3_500 },
  { level: 10, totalXp: 4_500 },
];

/** XP span for levels beyond the last configured threshold. */
export const LEVEL_STEP_XP = 2_500;

export interface LevelInfo {
  level: number;
  totalXp: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** Total XP span between this level and the next. */
  xpForNextLevel: number;
  /** XP still required to reach the next level. */
  xpToNextLevel: number;
  /** Cumulative XP needed for the next level. */
  nextLevelAt: number;
  progressPercent: number;
}

function thresholdForLevel(level: number): number {
  const configured = LEVEL_THRESHOLDS[level - 1];
  if (configured) {
    return configured.totalXp;
  }

  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last.totalXp + (level - last.level) * LEVEL_STEP_XP;
}

export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;

  while (xp >= thresholdForLevel(level + 1)) {
    level += 1;
  }

  const currentThreshold = thresholdForLevel(level);
  const nextLevelAt = thresholdForLevel(level + 1);
  const xpForNextLevel = nextLevelAt - currentThreshold;
  const xpIntoLevel = xp - currentThreshold;

  return {
    level,
    totalXp: xp,
    xpIntoLevel,
    xpForNextLevel,
    xpToNextLevel: nextLevelAt - xp,
    nextLevelAt,
    progressPercent:
      xpForNextLevel > 0 ? Math.min(100, Math.floor((xpIntoLevel / xpForNextLevel) * 100)) : 100,
  };
}
