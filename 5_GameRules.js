// NOTE: 5_GameRules
// Score thresholds, progression rules, win-goal helpers,
// and shared progression/help copy used by the UI.
//
// Owned here:
// - level rules
// - win score / progression constants
// - overlay timing constants tied to game feel
// - win-goal and title helpers
// - shared screen copy for welcome / paused / help screens
// - helpers for current level / progress meter
//
// NOT owned here:
// - screen state
// - menu layout
// - rendering
// - general UI flow
//
// Newbie note:
// - If code answers "how far through the run is the player?",
//   "what is the goal?", or "what text explains that goal?",
//   it belongs here.

import {
     sparkleScore
} from "./3_State.js";

// ====================================================================================================
// NOTE: LEVELS
// `scoreMin` is inclusive. Ten levels cover scores 0-999; 1000+ wins.
// ====================================================================================================

export const winScore = 1000;
export const startOverlayDuration = 120;
export const overlayFadeFrames = 30;
export const levelPopupDuration = 120;
export const maxLevelProgressUnits = 10;
export const progressUnitsPerCircle = 2;

const levelEnemyProgression = [
     {
          introText: "",
          hazardsUnlocked: false,
          harmfulEffectNames: []
     },
     {
          introText: "HAZARDS",
          hazardsUnlocked: true,
          harmfulEffectNames: []
     },
     {
          introText: "FREEZE",
          hazardsUnlocked: true,
          harmfulEffectNames: ["freeze"]
     },
     {
          introText: "DAZE",
          hazardsUnlocked: true,
          harmfulEffectNames: ["freeze", "daze"]
     },
     {
          introText: "FOG",
          hazardsUnlocked: true,
          harmfulEffectNames: ["freeze", "daze", "fog"]
     }
];

const levelRules = Array.from({ length: maxLevelProgressUnits }, (_, index) => {
     const progressionIndex = Math.min(index, levelEnemyProgression.length - 1);
     const progression = levelEnemyProgression[progressionIndex];

     return {
          levelNumber: index + 1,
          scoreMin: index * 100,
          introText: index < levelEnemyProgression.length ? progression.introText : "",
          hazardsUnlocked: progression.hazardsUnlocked,
          harmfulEffectNames: progression.harmfulEffectNames
     };
});

// ====================================================================================================
// NOTE: WELCOME / BUTTON TEXT
// ====================================================================================================

const welcomeTitleLines = ["SPARKLE", "SEEKER"];
const screenActionTexts = ["NEW GAME", "TIPS", "OPTIONS", "RETURN"];
const pausedActionTexts = ["RESUME", "TIPS", "OPTIONS", "RETURN"];
const welcomeInstructionLines = [
     "Collect white sparkles.",
     "Avoid hazards. Reach 1000 to win."
];

export function getWelcomeTitleLines() {
     return welcomeTitleLines;
}

export function getWelcomeInstructionLines() {
     return welcomeInstructionLines;
}

export function getWinGoalText() {
     return `Reach ${winScore}+ sparkles to win.`;
}

export function getWinTitleLines() {
     return ["YOU", "WIN"];
}

export function getLoseTitleLines() {
     return ["TRY", "AGAIN"];
}

export function getScreenTitleLinesForMode(gameScreenMode) {
     if (gameScreenMode === "screenYouWin") {
          return getWinTitleLines();
     }

     if (gameScreenMode === "screenTryAgain") {
          return getLoseTitleLines();
     }

     return getWelcomeTitleLines();
}

export function getCurrentScreenActionTexts() {
     return screenActionTexts;
}

export function getCurrentPausedActionTexts() {
     return pausedActionTexts;
}

// ====================================================================================================
// NOTE: TIPS TEXT
// ====================================================================================================

export function getHowToPlayLines() {
     return [
          "Seek sparkles to level and heal.",
          "Avoid hazards. They deal damage.",
          getWinGoalText()
     ];
}

export function getEffectLines() {
     return [
          "{iconLuck} Luck: doubles points.",
          "{iconMagnet} Magnet: triples pickup range.",
          "{iconSlowmo} Slowmo: objects 1/4 speed.",

          "{iconFreeze} Freeze: freezes player.",
          "{iconDaze} Daze: reverses movement.",
          "{iconFog} Fog: limits visible area."
     ];
}

export function getDifficultyOptionLines() {
     return [
          "OFF: sparkles only.",
          "MIN: hazards unlock at Level 2.",
          "LOW: effects unlock by level; fall 1 per 24 sparkles.",
          "MED: effects unlock by level; fall 1 per 16 sparkles.",
          "MAX: effects unlock by level; fall 1 per 8 sparkles."
     ];
}

export function getAudioOptionLines() {
     return [
          "OFF",
          "MIN: 25%",
          "LOW: 50%",
          "MED: 75%",
          "MAX: 100%"
     ];
}

export function getMovementOptionLines() {
     return [
          "Touch/Click + WASD/Arrows: pointer and keyboard movement.",
          "Joystick Left: lower-left touch joystick.",
          "Joystick Right: lower-right touch joystick."
     ];
}

export function getColorOptionLines() {
     return [
          "High Contrast: white sparkles; hazards and effects use cyan, magenta, and yellow.",
          "Vibrant: white sparkles; hazards and effects use rainbow colors.",
          "Pastel: white sparkles; hazards and effects use soft Catppuccin Mocha colors.",
          "Black & White: monochrome accessibility board."
     ];
}

// ==================================================
// LEVEL HELPERS
// ==================================================

export function getCurrentLevelData() {
     let currentLevelData = levelRules[0];

     for (let i = 0; i < levelRules.length; i += 1) {
          if (sparkleScore >= levelRules[i].scoreMin) {
               currentLevelData = levelRules[i];
          } else {
               break;
          }
     }

     return currentLevelData;
}

export function getCurrentLevelMeterUnits() {
     const currentLevelData = getCurrentLevelData();
     const pointsIntoLevel = sparkleScore - currentLevelData.scoreMin;
     const completedLevels = currentLevelData.levelNumber - 1;
     const halfwayToNextLevel = pointsIntoLevel >= 50 ? 1 : 0;

     return Math.min(maxLevelProgressUnits, completedLevels + halfwayToNextLevel);
}

export function getCurrentLevelNumber() {
     return getCurrentLevelData().levelNumber;
}

export function areHealthHazardsUnlockedForCurrentLevel() {
     return getCurrentLevelData().hazardsUnlocked;
}

export function getUnlockedHarmfulEffectNamesForCurrentLevel() {
     return getCurrentLevelData().harmfulEffectNames;
}

export function getLevelIntroText(levelNumber) {
     const levelData = levelRules.find((rule) => rule.levelNumber === levelNumber);

     return levelData?.introText || "";
}
