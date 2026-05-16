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
     starScore
} from "./3_State.js";

import {
     isJoystickEnabled
} from "./4_Options.js";

// ====================================================================================================
// NOTE: LEVELS
// `scoreMin` is inclusive. Level 10 starts at the win threshold.
// ====================================================================================================

export const winScore = 1500;
export const startOverlayDuration = 120;
export const overlayFadeFrames = 30;
export const levelPopupDuration = 600;
export const maxLevelProgressUnits = 10;
export const progressUnitsPerCircle = 2;
const levelScoreMins = [
     0,
     25,
     75,
     150,
     250,
     400,
     600,
     850,
     1150,
     1500
];

const levelChallengeProgression = [
     {
          introText: "",
          introDescription: "",
          introIcon: "",
          strikesUnlocked: true,
          baneNames: []
     },
     {
          introText: "FREEZE",
          introDescription: "Freezes player.",
          introIcon: "iconFreeze",
          strikesUnlocked: true,
          baneNames: ["freeze"]
     },
     {
          introText: "DAZE",
          introDescription: "Reverses controls.",
          introIcon: "iconDaze",
          strikesUnlocked: true,
          baneNames: ["freeze", "daze"]
     },
     {
          introText: "FOG",
          introDescription: "Limits vision.",
          introIcon: "iconFog",
          strikesUnlocked: true,
          baneNames: ["freeze", "daze", "fog"]
     }
];

const levelRules = Array.from({ length: maxLevelProgressUnits }, (_, index) => {
     const progressionIndex = Math.min(index, levelChallengeProgression.length - 1);
     const progression = levelChallengeProgression[progressionIndex];

     return {
          levelNumber: index + 1,
          scoreMin: levelScoreMins[index] ?? index * 100,
          introText: index < levelChallengeProgression.length ? progression.introText : "",
          introDescription: index < levelChallengeProgression.length ? progression.introDescription : "",
          introIcon: index < levelChallengeProgression.length ? progression.introIcon : "",
          strikesUnlocked: progression.strikesUnlocked,
          baneNames: progression.baneNames
     };
});

// ====================================================================================================
// NOTE: WELCOME / BUTTON TEXT
// ====================================================================================================

const welcomeTitleLines = ["STAR", "SHOWER"];
const screenActionTexts = ["NEW GAME", "TIPS", "OPTIONS", "DEVELOPER"];
const pausedActionTexts = ["RESUME", "NEW GAME", "TIPS", "OPTIONS", "DEVELOPER"];
const welcomeInstructionLines = [
     "Collect stars, avoid strikes.",
     "To navigate, use pointer or arrows."
];

export function getWelcomeTitleLines() {
     return welcomeTitleLines;
}

export function getWelcomeInstructionLines() {
     return welcomeInstructionLines;
}

export function getWinGoalText() {
     return "Reach level 10 to win.";
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
          getWinGoalText(),
          "{iconStar} Stars: gain speed & points.",
          "{iconStrike} Strikes: deal damage."
     ];
}

export function getBoostLines() {
     return [
          "{iconHealth} Health: increases health.",
          "{iconMagnet} Magnet: triples pickup range.",
          "{iconDouble} Double: stars count twice."
     ];
}

export function getBaneLines() {
     return [
          "{iconFreeze} Freeze: freezes player.",
          "{iconDaze} Daze: reverses movement.",
          "{iconFog} Fog: limits visible area."
     ];
}

export function getDifficultyOptionLines() {
     return [
          "OFF: stars and strikes.",
          "MIN: boosts and banes 0.5x.",
          "LOW: boosts and banes 1x.",
          "MED: boosts and banes 1.5x.",
          "MAX: boosts and banes 2x."
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
     const lines = [
          "Touch/Click + WASD/Arrows: pointer and keyboard movement.",
     ];

     if (isJoystickEnabled()) {
          lines.push(
               "Joystick Left: lower-left touch joystick.",
               "Joystick Right: lower-right touch joystick."
          );
     }

     return lines;
}

export function getColorOptionLines() {
     return [
          "Bright: white stars; boosts and banes use rainbow colors.",
          "Pastel: white stars; boosts and banes use soft Catppuccin Mocha colors.",
          "Monochrome: white, gray, and black."
     ];
}

// ==================================================
// LEVEL HELPERS
// ==================================================

export function getCurrentLevelData() {
     let currentLevelData = levelRules[0];

     for (let i = 0; i < levelRules.length; i += 1) {
          if (starScore >= levelRules[i].scoreMin) {
               currentLevelData = levelRules[i];
          } else {
               break;
          }
     }

     return currentLevelData;
}

export function getCurrentLevelMeterUnits() {
     const currentLevelData = getCurrentLevelData();
     const nextLevelData = levelRules[currentLevelData.levelNumber] || null;
     const pointsIntoLevel = starScore - currentLevelData.scoreMin;
     const completedLevels = currentLevelData.levelNumber - 1;
     const currentLevelRange = nextLevelData
          ? nextLevelData.scoreMin - currentLevelData.scoreMin
          : winScore - currentLevelData.scoreMin;
     const halfwayToNextLevel = currentLevelRange > 0 && pointsIntoLevel >= currentLevelRange / 2 ? 1 : 0;

     return Math.min(maxLevelProgressUnits, completedLevels + halfwayToNextLevel);
}

export function getCurrentLevelNumber() {
     return getCurrentLevelData().levelNumber;
}

export function areStrikesUnlockedForCurrentLevel() {
     return getCurrentLevelData().strikesUnlocked;
}

export function getUnlockedBaneNamesForCurrentLevel() {
     return getCurrentLevelData().baneNames;
}

export function getLevelIntroText(levelNumber) {
     const levelData = levelRules.find((rule) => rule.levelNumber === levelNumber);

     return levelData?.introText || "";
}

export function getLevelIntroDescription(levelNumber) {
     const levelData = levelRules.find((rule) => rule.levelNumber === levelNumber);

     return levelData?.introDescription || "";
}

export function getLevelIntroIcon(levelNumber) {
     const levelData = levelRules.find((rule) => rule.levelNumber === levelNumber);

     return levelData?.introIcon || "";
}
