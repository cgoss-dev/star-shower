// NOTE: game
// Consolidated runtime core for Star Shower.
// Includes game orchestration, progression rules, and canvas config.

import {
     miniGameCanvas,
     miniGameCtx,
     gameStarted,
     gamePaused,
     gameMenuOpen,
     gameMenuView,
     gameOver,
     gameWon,
     gameOverlayText,
     gameOverlayTimer,
     gameOverlayDuration,
     gameplayPopupText,
     gameplayPopupTimer,
     gameplayPopupDuration,
     hurtLevel,
     movementLevel,
     colorLevel,
     helphurtPickups,
     starScore,
     playerHealth,

     setGameStarted,
     setGamePaused,
     setGameMenuOpen,
     setGameMenuView,
     setGameOver,
     setGameWon,
     setGameOverlayText,
     setGameOverlaySubtext,
     setGameOverlayTimer,
     setGameOverlayDuration,
     setGameplayPopupText,
     setGameplayPopupTimer,
     setGameplayPopupDuration,
     setHurtLevel,
     setMovementLevel,
     setColorLevel,
     setMiniGameSize,
     setWelcomeSelectionIndex,
     updateMenuKeyboardFocusTimer,

     resetUiActionBounds,
     resetGameState
} from "./state.js?v=20260711-18";

import {
     difficultyOptionLabels,
     maxDifficultyOptionIndex,
     movementOptionLabels,
     getMaxMovementOptionIndex,
     colorOptionLabels,
     maxColorOptionIndex,
     isJoystickEnabled,
     loadAndApplySavedOptions,
     saveCurrentOptions
} from "./options.js?v=20260711-18";

import {
     bindKeyboardInput,
     bindPointerInput,
     bindResizeHandler,
     updateTouchControlBounds,
     resetTouchControls
} from "./input.js?v=20260711-18";

import {
     resetPlayerPosition,
     updatePlayer,
     updatePlayerFaceState,
     resetEntityColorCycle,
     updateHelphurtState,
     updateStarSpawns,
     updateStars,
     updateStrikes,
     updateHelphurtPickups,
     updateCollisionBursts,
     collectStars,
     collectStrikes,
     collectHelphurtPickups,
     updatePlayerTrail,
     resetHelphurtIntroState
} from "./entities/index.js?v=20260711-18";

import {
     syncUiBounds,
     updatePauseButtonState,
     updateScreenTitleColorState,
     drawGame
} from "./draw/index.js?v=20260711-18";

// ====================================================================================================
// NOTE: CONFIG / THEME
// ====================================================================================================

export const starShowerRainbowCycleMs = 240;

export const starShowerRainbowPalette = [
     "#f00",
     "#f80",
     "#ff0",
     "#bf0",
     "#0f0",
     "#0fb",
     "#0ff",
     "#0bf",
     "#00f",
     "#80f",
     "#f0f",
     "#f08"
];





export const starShowerHelphurtIcons = {

     // NOTE: HELPS

     iconHealth: {
          category: "help",
          name: "health",
          label: "HEALTH",
          particle: "❤️",
          assetSrc: "",
          ability: "increaseHealth",
          lastsUntilUsed: true,
          durationSeconds: 0,
          xOffset: 0
     },

     iconMagnet: {
          category: "help",
          name: "magnet",
          label: "MAGNET",
          particle: "🧲",
          assetSrc: "",
          ability: "expandStarPickupRange",
          lastsUntilUsed: false,
          durationSeconds: 8,
          xOffset: -3
     },

     iconDouble: {
          category: "help",
          name: "double",
          label: "DOUBLE",
          particle: "🌟",
          assetSrc: "",
          ability: "doubleStarScore",
          lastsUntilUsed: false,
          durationSeconds: 8,
          xOffset: -1
     },

     // NOTE: HURTS

     iconFreeze: {
          category: "hurt",
          name: "freeze",
          label: "FREEZE",
          particle: "🥶",
          assetSrc: "",
          ability: "freezePlayerMovement",
          lastsUntilUsed: false,
          durationSeconds: 5,
          xOffset: 1
     },

     iconDaze: {
          category: "hurt",
          name: "daze",
          label: "DAZE",
          particle: "😵‍💫",
          assetSrc: "",
          ability: "reversePlayerMovement",
          lastsUntilUsed: false,
          durationSeconds: 5,
          xOffset: 0
     },

     iconFog: {
          category: "hurt",
          name: "fog",
          label: "FOG",
          particle: "😵",
          assetSrc: "",
          ability: "limitVisionAroundPlayer",
          lastsUntilUsed: false,
          durationSeconds: 8,
          xOffset: 0
     }
};

export const starShowerGuideIcons = {
     iconWin: {
          name: "win",
          label: "WIN",
          particle: "🏆",
          assetSrc: "",
          xOffset: 0
     },

     iconStar: {
          name: "star",
          label: "STAR",
          particle: "⭐️",
          assetSrc: "",
          xOffset: 0
     },

     iconStrike: {
          name: "strike",
          label: "STRIKE",
          particle: "❌",
          assetSrc: "",
          xOffset: 0
     }
};

function getSiteTheme() {
     return window.SiteTheme;
}





// ====================================================================================================
// NOTE: ⭐️ GET CANVAS THEME
// ====================================================================================================

export function getCanvasTheme() {
     const fontColor = getCssColor("--game-color-text", getCssColor("--color-white", "#ffffff"));
     const bodyColor = getCssColor("--game-color-body", getCssColor("--color-gray3", "#999999"));
     const titleColor = getCssColor("--game-color-title", getCssColor("--color-gray3", "#999999"));
     const uiFontLg = getCssPixelSize("--font-size-lg", 20);
     const uiFontMd = getCssPixelSize("--font-size-md", 15);
     const uiFontSm = getCssPixelSize("--font-size-sm", 10);

     const menuOverlayFill = "rgba(0, 0, 0, 0.5)";
     const actionOverlayFill = "rgba(0, 0, 0, 0.75)";
     const controlFillFallback = getCssColor("--game-control-fill", getCssColor("--white-25", "rgba(255, 255, 255, 0.25)"));
     const outlineFallback = getCssColor("--game-outline-strong", getCssColor("--color-gray3", "#999999"));

     const text = {
          canvasSpacing: {
               uiPadding: uiFontSm * 0.75,
               uiRowGap: uiFontSm * 0.75,
               circleTitleGap: uiFontSm,
               hudPadding: uiFontSm * 0.5,
               hudRowGap: 0,
               hudTitleGap: uiFontSm * 0.5,
               menuPadding: uiFontSm,
               betweenButtons: uiFontSm,
               bodyLineHeight: uiFontSm * 1.5,
               guideIconGutter: uiFontLg
          },

          marquee: {
               font: "marquee",
               fontSize: uiFontLg,
               minSize: uiFontMd,
               shrinkStep: 2,
               sidePadding: uiFontSm,
               letterSpacing: 0.25,
               stackGap: 10,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          welcomeTitle: {
               font: "marquee",
               fontSize: uiFontLg,
               minSize: uiFontMd,
               shrinkStep: 2,
               sidePadding: uiFontSm,
               letterSpacing: 0.25,
               stackGap: 10,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          title: {
               font: "marquee",
               fontSize: uiFontMd,
               letterSpacing: 0.25,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          levelStatus: {
               font: "marquee",
               fontSize: uiFontSm,
               letterSpacing: 0.25,
               color: "#fff",
               rainbow: false,
               glow: false
          },

          scoreReady: {
               font: "body",
               fontSize: uiFontSm,
               letterSpacing: 0,
               color: "#fff",
               rainbow: false,
               glow: false
          },

          hudProgress: {
               font: "body",
               fontSize: uiFontSm * 1.5,
               letterSpacing: 0,
               color: "#fff",
               rainbow: false,
               glow: false
          },

          buttonsOptions: {
               font: "body",
               fontSize: uiFontSm,
               arrowScale: 3,
               letterSpacing: 0,
               buttonPadding: uiFontSm * 0.5,
               backButtonBottomOffset: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          pauseButton: {
               font: "body",
               fontSize: uiFontSm,
               buttonSize: uiFontSm * 1.5,
               iconScale: 0.62,
               letterSpacing: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          joystick: {
               baseRadius: uiFontLg * 2.5,
               knobRadius: uiFontMd * 1.6,
               edgeGap: uiFontSm * 0.15,
               deadZone: 0.12,
               fill: "rgba(0, 0, 0, 0)",
               stroke: outlineFallback,
               knobFill: bodyColor,
               glow: true
          },

          guideIcons: {
               ...starShowerGuideIcons,
               ...starShowerHelphurtIcons
          }
     };

     const base = {
          uiFontLg,
          uiFontMd,
          uiFontSm,
          controlRadius: getCssNumber("--border-radius", 30),
          borderWidth: getCssNumber("--border-sm", 1),
          borderWidthFocus: getCssNumber("--border-md", 2),
          panelBorderWidth: getCssNumber("--border-lg", 3),
          touchBorderWidth: getCssNumber("--border-lg", 3)
     };

     return {
          fonts: {
               marquee: getCssString("--font-display", "\"Bungee Shade\", cursive"),
               body: getCssString("--font-body", "\"Annotation Mono\", monospace"),
               symbol: "\"Segoe UI Symbol\", \"Apple Color Emoji\", \"Noto Color Emoji\", sans-serif"
          },

          colors: {
               fontColor,
               bodyText: bodyColor,
               titleText: titleColor,
               titleRainbow: starShowerRainbowPalette,
               controlText: bodyColor,
               controlGlow: fontColor,
               overlayGlow: fontColor,
               statusText: bodyColor,
               statusTextGlow: fontColor,
               meterFull: bodyColor,
               meterGlow: bodyColor,

               controlFill: controlFillFallback,
               outlineStrong: outlineFallback,
               frameInset: getCssColor("--color-black", "#000000"),

               touchFill: getCssColor("--game-touch-fill", getCssColor("--ui-touch-fill", controlFillFallback)),
               touchStroke: getCssColor("--game-touch-border-color", getCssColor("--ui-touch-border-color", outlineFallback)),
               touchGlow: getCssColor("--game-touch-glow", getCssColor("--ui-touch-glow", fontColor)),
               touchText: getCssColor("--game-touch-text-color", getCssColor("--ui-touch-text-color", bodyColor)),

               menuScreenFill: getCssColor("--color-black", "#000000"),
               menuPanelFill: menuOverlayFill
          },

          sizes: {
               ...base
          },

          text,

          screens: {
               welcome: {
                    textStyle: "welcomeTitle"
               },

               paused: {
                    textStyle: "marquee",
                    overlayFill: actionOverlayFill
               },

               result: {
                    textStyle: "marquee",
                    overlayFill: actionOverlayFill
               },

               intro: {
                    overlayFill: menuOverlayFill
               }
          },

          glow: {
               uiSoftGlow: getCssNumber("--glow-particle-bg-blur", 10),
               uiMediumGlow: getCssNumber("--glow-particle-game-blur", 16),
               uiStrongGlow: getCssNumber("--glow-particle-game-blur", 16) * 1.35,
               uiTitleGlow1: getCssNumber("--glow-particle-bg-blur", 10) * 0.75,
               uiTitleGlow2: getCssNumber("--glow-particle-game-blur", 16),
               uiTitleGlow3: getCssNumber("--glow-particle-game-blur", 16) * 1.6
          },

          animation: {
               titleRainbowCycleMs: starShowerRainbowCycleMs
          }
     };
}





// ==================================================
// CSS / THEME HELPERS
// ==================================================

export function getCssColor(variableName, fallback = "#ffffff") {
     const siteColor = getSiteTheme()?.getCssColor?.(variableName, "");
     const localColor = getCssString(variableName, "");
     return resolveCssColorValue(siteColor || localColor, fallback);
}

export function getCssNumber(variableName, fallback = 0) {
     return getSiteTheme()?.getCssNumber?.(variableName, fallback) ?? fallback;
}

export function getCssString(variableName, fallback = "") {
     if (!document?.documentElement) {
          return fallback;
     }

     const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
     return value || fallback;
}

export function getCssBoolean(variableName, fallback = false) {
     const value = getCssString(variableName, String(fallback)).toLowerCase();

     return value === "true" || value === "1" || value === "yes" || value === "on";
}

function resolveCssColorValue(value, fallback = "#ffffff") {
     if (!value || !document?.documentElement) {
          return fallback;
     }

     const variablePattern = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/g;
     let resolvedValue = value;
     let safety = 0;

     while (resolvedValue.includes("var(") && safety < 12) {
          safety += 1;
          resolvedValue = resolvedValue.replace(variablePattern, (_match, variableName, variableFallback = "") => {
               const nextValue = getCssString(variableName, "");
               return nextValue || variableFallback.trim() || fallback;
          });
     }

     return resolvedValue || fallback;
}

export function getCssPixelSize(variableName, fallback = 10) {
     if (!document?.body) {
          return fallback;
     }

     const probe = document.createElement("span");
     probe.style.position = "absolute";
     probe.style.visibility = "hidden";
     probe.style.pointerEvents = "none";
     probe.style.fontSize = `var(${variableName})`;
     probe.textContent = "M";

     document.body.appendChild(probe);
     const resolved = parseFloat(getComputedStyle(probe).fontSize);
     document.body.removeChild(probe);

     return Number.isFinite(resolved) ? resolved : fallback;
}

// ====================================================================================================
// NOTE: GAME RULES
// ====================================================================================================

// ====================================================================================================
// NOTE: LEVELS
// `scoreMin` is inclusive. The last level threshold is the win threshold.
// ====================================================================================================

export const startOverlayDuration = 120;
export const overlayFadeFrames = 30;
export const gameplayPopupDurationFrames = 180;
const roundIntroMessageFrames = 120;
const roundIntroPauseFrames = 120;
const roundIntroSecondHoldFrames = 120;
const roundIntroFadeFrames = 120;
const roundIntroTotalFrames =
     roundIntroMessageFrames +
     roundIntroPauseFrames +
     roundIntroSecondHoldFrames +
     roundIntroFadeFrames;
export const maxLevelProgressUnits = 10;
export const progressUnitsPerCircle = 2;
const levelScoreMins = [
     0,
     5,
     65,
     125,
     185,
     245,
     305,
     365,
     430,
     500
];
export const winScore = levelScoreMins.at(-1) ?? 0;

const levelChallengeProgression = [
     {
          introText: "HEALTH / FREEZE",
          introDescription: "Health helps. Freeze hurts.",
          introIcon: "iconHealth",
          strikesUnlocked: true,
          helpNames: ["health"],
          hurtNames: ["freeze"]
     },
     {
          introText: "MAGNET / DAZE",
          introDescription: "Magnet helps. Daze hurts.",
          introIcon: "iconMagnet",
          strikesUnlocked: true,
          helpNames: ["health", "magnet"],
          hurtNames: ["freeze", "daze"]
     },
     {
          introText: "DOUBLE / FOG",
          introDescription: "Double helps. Fog hurts.",
          introIcon: "iconDouble",
          strikesUnlocked: true,
          helpNames: ["health", "magnet", "double"],
          hurtNames: ["freeze", "daze", "fog"]
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
          helpNames: progression.helpNames,
          hurtNames: progression.hurtNames
     };
});

// ====================================================================================================
// NOTE: WELCOME / BUTTON TEXT
// ====================================================================================================

const welcomeTitleLines = ["STAR", "SHOWER"];
const welcomeActionTexts = ["NEW GAME", "TIPS", "OPTIONS"];
const resultActionTexts = ["NEW GAME", "TIPS", "OPTIONS", "DEVELOPER"];
const pausedActionTexts = ["RESUME", "NEW GAME", "TIPS", "OPTIONS"];
const roundIntroFirstLines = ["Collect Stars,", "Avoid Strikes"];
const roundIntroSecondLines = ["Effects Can", "Help or Hurt"];

export function getWelcomeTitleLines() {
     return welcomeTitleLines;
}

export function getWinGoalText() {
     return "{iconWin} Level 10 to win.";
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
     return isScreenWelcomeActive() ? welcomeActionTexts : resultActionTexts;
}

export function getCurrentPausedActionTexts() {
     return pausedActionTexts;
}

// ====================================================================================================
// NOTE: TIPS TEXT
// ====================================================================================================

export function getHowToPlayLines() {
     return [
          "{iconStar} Stars",
          "+1 speed/points.",
          "",
          "{iconStrike} Strikes",
          "Deal damage."
     ];
}

export function getHelpLines() {
     return [
          "{iconHealth} Health",
          "Increase health.",
          "",
          "{iconMagnet} Magnet",
          "Triple range.",
          "",
          "{iconDouble} Double",
          "Double points."
     ];
}

export function getHurtLines() {
     return [
          "{iconDaze} Daze",
          "Reverse movement.",
          "",
          "{iconFreeze} Freeze",
          "Freeze player.",
          "",
          "{iconFog} Fog",
          "Shrink visibility."
     ];
}

export function getDifficultyOptionLines() {
     return [
          "OFF: Only stars and strikes.",
          "MED: 1x Effects.",
          "MAX: 3x Effects."
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
          "Bright: white stars; helps and hurts use bright colors.",
          "Pastel: white stars; helps and hurts use pastel colors.",
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

export function getCurrentLevelNumber() {
     return getCurrentLevelData().levelNumber;
}

export function getCurrentLevelProgressRatio() {
     const currentLevelData = getCurrentLevelData();
     const nextLevelData = levelRules[currentLevelData.levelNumber] || null;

     if (!nextLevelData) {
          return 1;
     }

     const levelRange = nextLevelData.scoreMin - currentLevelData.scoreMin;

     if (levelRange <= 0) {
          return 1;
     }

     return Math.max(0, Math.min(1, (starScore - currentLevelData.scoreMin) / levelRange));
}

export function areStrikesUnlockedForCurrentLevel() {
     return getCurrentLevelData().strikesUnlocked;
}

export function getUnlockedHelpNamesForCurrentLevel() {
     return getCurrentLevelData().helpNames;
}

export function getUnlockedHurtNamesForCurrentLevel() {
     return getCurrentLevelData().hurtNames;
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

// ==================================================
// SCREEN STATE
// `screenWelcome` hides the board entirely.
// `screenTryAgain` and `screenYouWin` are board overlays.
// ==================================================

let screenLayerActive = true;
let screenLayerTimer = -1;
let screenLayerDuration = -1;
let gameScreenMode = "screenWelcome";
let roundIntroTimer = 0;

// ==================================================
// SCREEN MODE HELPERS
// ==================================================

function setMenuViewAndRefresh(view) {
     setGameMenuView(view);
     syncUiBounds();
}

export function isScreenWelcomeActive() {
     return screenLayerActive && gameScreenMode === "screenWelcome";
}

export function isOverlayScreenActive() {
     return screenLayerActive && (
          gameScreenMode === "screenTryAgain" ||
          gameScreenMode === "screenYouWin"
     );
}

export function getGameScreenMode() {
     return gameScreenMode;
}

export function isRoundIntroActive() {
     return roundIntroTimer > 0;
}

export function getRoundIntroAlpha() {
     if (!isRoundIntroActive()) {
          return 0;
     }

     if (roundIntroTimer <= roundIntroFadeFrames) {
          return Math.max(0, Math.min(1, roundIntroTimer / roundIntroFadeFrames));
     }

     return 1;
}

export function getRoundIntroLines() {
     const elapsedFrames = roundIntroTotalFrames - roundIntroTimer;
     const secondMessageStart = roundIntroMessageFrames + roundIntroPauseFrames;

     if (elapsedFrames < secondMessageStart) {
          return roundIntroFirstLines;
     }

     return [
          ...roundIntroFirstLines,
          "",
          ...roundIntroSecondLines
     ];
}

export function getCurrentScreenTitleLines() {
     return getScreenTitleLinesForMode(gameScreenMode);
}

export function dismissScreenWelcomeToStart() {
     screenLayerActive = false;
     gameScreenMode = "screenWelcome";
     screenLayerTimer = 0;
     screenLayerDuration = 0;
     startNewGameRound();
}

export function dismissScreenWelcomeToTipsMenu() {
     screenLayerActive = false;
     gameScreenMode = "screenWelcome";
     screenLayerTimer = 0;
     screenLayerDuration = 0;

     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();

     setGameStarted(false);
     setGamePaused(false);
     setGameMenuOpen(true);
     setMenuViewAndRefresh("tips");
     setGameOver(false);
     setGameWon(false);

     clearGameOverlay();
}

export function dismissScreenWelcomeToOptionsMenu() {
     screenLayerActive = false;
     gameScreenMode = "screenWelcome";
     screenLayerTimer = 0;
     screenLayerDuration = 0;

     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();

     setGameStarted(false);
     setGamePaused(false);
     setGameMenuOpen(true);
     setMenuViewAndRefresh("options");
     setGameOver(false);
     setGameWon(false);

     clearGameOverlay();
}

export function dismissPausedToTipsMenu() {
     setGamePaused(true);
     setGameMenuOpen(true);
     setMenuViewAndRefresh("tips");
}

export function dismissPausedToOptionsMenu() {
     setGamePaused(true);
     setGameMenuOpen(true);
     setMenuViewAndRefresh("options");
}

export function dismissMenuBackToPreviousScreen() {
     setGameMenuOpen(false);
     setGameMenuView("");

     if (!gameStarted) {
          showScreenWelcome();
          setGamePaused(false);
          setGameOver(false);
          setGameWon(false);
          clearGameOverlay();
          syncUiBounds();
          updateTouchControlBounds();
          return;
     }

     setGamePaused(true);
     syncUiBounds();
     updateTouchControlBounds();
}

export function showScreenWelcome() {
     screenLayerActive = true;
     gameScreenMode = "screenWelcome";
     screenLayerTimer = -1;
     screenLayerDuration = -1;
     clearRoundIntro();
}

export function showScreenTryAgain() {
     screenLayerActive = true;
     gameScreenMode = "screenTryAgain";
     screenLayerTimer = -1;
     screenLayerDuration = -1;
     setWelcomeSelectionIndex(0);
     clearRoundIntro();
}

export function showScreenYouWin() {
     screenLayerActive = true;
     gameScreenMode = "screenYouWin";
     screenLayerTimer = -1;
     screenLayerDuration = -1;
     setWelcomeSelectionIndex(0);
     clearRoundIntro();
}

export function getGameWelcomeAlpha() {
     if (!screenLayerActive) {
          return 0;
     }

     if (screenLayerTimer < 0 || screenLayerDuration < 0) {
          return 1;
     }

     const elapsed = screenLayerDuration - screenLayerTimer;
     const fadeIn = Math.min(1, elapsed / overlayFadeFrames);
     const fadeOut = Math.min(1, screenLayerTimer / overlayFadeFrames);

     return Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
}

// ==================================================
// CANVAS
// ==================================================

export function syncCanvasResolutionFromCssSize() {
     if (!miniGameCanvas || !miniGameCtx) {
          return;
     }

     const rect = miniGameCanvas.getBoundingClientRect();
     const dpr = window.devicePixelRatio || 1;

     miniGameCanvas.width = Math.round(rect.width * dpr);
     miniGameCanvas.height = Math.round(rect.height * dpr);
     miniGameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

     setMiniGameSize(rect.width, rect.height);
}

export function syncCanvasResolutionAndUiBounds() {
     syncCanvasResolutionFromCssSize();
     updateTouchControlBounds();
     syncUiBounds();
}

// ==================================================
// ROUNDS
// ==================================================

export function startNewGameRound() {
     // Round reset pseudocode:
     // 1. Clear every gameplay system back to its starting state.
     // 2. Resize canvas/UI before placing the player, so coordinates are current.
     // 3. Switch from menus/overlays into live play.
     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();
     resetHelphurtIntroState();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();

     screenLayerActive = false;

     setGameStarted(true);
     setGamePaused(false);
     setGameMenuOpen(false);
     setGameMenuView("");
     setGameOver(false);
     setGameWon(false);
     roundIntroTimer = roundIntroTotalFrames;
}

// ====================================================================================================
// NOTE: OPTIONS
// ====================================================================================================

export function getDifficultyOptionLabel(levelIndex) {
     return difficultyOptionLabels[levelIndex] || difficultyOptionLabels[0];
}

function getPreviousDifficultyOptionIndex(levelIndex) {
     return Math.max(0, levelIndex - 1);
}

function getNextDifficultyOptionIndex(levelIndex) {
     return Math.min(maxDifficultyOptionIndex, levelIndex + 1);
}

function getPreviousMovementOptionIndex(levelIndex) {
     return Math.max(0, levelIndex - 1);
}

function getNextMovementOptionIndex(levelIndex) {
     return Math.min(getMaxMovementOptionIndex(), levelIndex + 1);
}

function getPreviousColorOptionIndex(levelIndex) {
     return Math.max(0, levelIndex - 1);
}

function getNextColorOptionIndex(levelIndex) {
     return Math.min(maxColorOptionIndex, levelIndex + 1);
}

export function getHurtToggleLabel() {
     return getDifficultyOptionLabel(hurtLevel);
}

export function getMovementToggleLabel() {
     return movementOptionLabels[movementLevel] || movementOptionLabels[0];
}

export function getColorToggleLabel() {
     return colorOptionLabels[colorLevel] || colorOptionLabels[0];
}

export function decreaseHurtLevel() {
     const nextLevel = getPreviousDifficultyOptionIndex(hurtLevel);
     setHurtLevel(nextLevel);

     if (nextLevel === 0) {
          helphurtPickups.length = 0;
     }

     saveCurrentOptions();
}

export function increaseHurtLevel() {
     setHurtLevel(getNextDifficultyOptionIndex(hurtLevel));
     saveCurrentOptions();
}

export function decreaseMovementLevel() {
     setMovementLevel(getPreviousMovementOptionIndex(movementLevel));
     saveCurrentOptions();
}

export function increaseMovementLevel() {
     setMovementLevel(getNextMovementOptionIndex(movementLevel));
     saveCurrentOptions();
}

export function decreaseColorLevel() {
     setColorLevel(getPreviousColorOptionIndex(colorLevel));
     saveCurrentOptions();
}

export function increaseColorLevel() {
     setColorLevel(getNextColorOptionIndex(colorLevel));
     saveCurrentOptions();
}

// ==================================================
// OVERLAY SYSTEM
// ==================================================

export function clearGameOverlay() {
     setGameOverlayText("");
     setGameOverlaySubtext("");
     setGameOverlayTimer(0);
     setGameOverlayDuration(0);
}

function clearRoundIntro() {
     roundIntroTimer = 0;
}

function updateRoundIntroTimer() {
     if (roundIntroTimer > 0) {
          roundIntroTimer -= 1;
     }
}

export function showTimedGameOverlay(text, sub = "", duration = startOverlayDuration) {
     setGameOverlayText(text);
     setGameOverlaySubtext(sub);
     setGameOverlayTimer(duration);
     setGameOverlayDuration(duration);
}

export function showPersistentGameOverlay(text, sub = "") {
     setGameOverlayText(text);
     setGameOverlaySubtext(sub);
     setGameOverlayTimer(-1);
     setGameOverlayDuration(-1);
}

export function updateGameOverlayTimer() {
     if (gameOverlayTimer > 0) {
          const nextTimer = gameOverlayTimer - 1;
          setGameOverlayTimer(nextTimer);

          if (nextTimer === 0) {
               clearGameOverlay();
          }
     }
}

export function getGameOverlayAlpha() {
     if (!gameOverlayText) {
          return 0;
     }

     if (gameOverlayTimer < 0 || gameOverlayDuration < 0) {
          return 1;
     }

     const elapsed = gameOverlayDuration - gameOverlayTimer;
     const fadeIn = Math.min(1, elapsed / overlayFadeFrames);
     const fadeOut = Math.min(1, gameOverlayTimer / overlayFadeFrames);

     return Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
}

export function clearGameplayPopup() {
     setGameplayPopupText("");
     setGameplayPopupTimer(0);
     setGameplayPopupDuration(0);
}

export function showGameplayPopup(text, duration = gameplayPopupDurationFrames) {
     setGameplayPopupText(text);
     setGameplayPopupTimer(duration);
     setGameplayPopupDuration(duration);
}

export function updateGameplayPopupTimer() {
     if (gameplayPopupTimer > 0) {
          const nextTimer = gameplayPopupTimer - 1;
          setGameplayPopupTimer(nextTimer);

          if (nextTimer === 0) {
               clearGameplayPopup();
          }
     }
}

export function getGameplayPopupAlpha() {
     if (!gameplayPopupText || gameplayPopupTimer <= 0 || gameplayPopupDuration <= 0) {
          return 0;
     }

     const elapsed = gameplayPopupDuration - gameplayPopupTimer;
     const fadeIn = Math.min(1, elapsed / 10);
     const fadeOut = Math.min(1, gameplayPopupTimer / 45);

     return Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
}

// ==================================================
// GAME UPDATE
// ==================================================

export function updateGame() {
     // Frame update pseudocode:
     // 1. Always tick UI-only timers, even when gameplay is paused.
     // 2. Exit early for welcome/menu/paused/result states.
     // 3. During live play, update effects, movement, spawning, collisions, and progress.
     // 4. Finish by checking lose/win conditions and switching to the matching result screen.
     updatePauseButtonState();
     updateGameOverlayTimer();
     updateGameplayPopupTimer();
     updateMenuKeyboardFocusTimer();

     if (screenLayerActive) {
          updateScreenTitleColorState();
     }

     if (isScreenWelcomeActive()) {
          return;
     }

     if (!gameStarted) {
          return;
     }

     updatePlayerFaceState();

     if (gamePaused || gameMenuOpen || gameOver || gameWon) {
          return;
     }

     if (isRoundIntroActive()) {
          updateRoundIntroTimer();
          return;
     }

     const levelBeforeCollections = getCurrentLevelNumber();

     updateHelphurtState();
     updatePlayer();
     updateStarSpawns();
     updateStars();
     updateStrikes();
     updateHelphurtPickups();
     updateCollisionBursts();
     updatePlayerTrail();
     collectStars();
     collectStrikes();
     collectHelphurtPickups();

     const levelAfterCollections = getCurrentLevelNumber();

     if (levelAfterCollections > levelBeforeCollections) {
          showGameplayPopup("Lvl Up!");
     }

     if (playerHealth <= 0) {
          setGameOver(true);
          setGameWon(false);
          setGamePaused(true);
          setGameMenuOpen(false);
          setGameMenuView("");
          resetTouchControls();
          clearGameOverlay();
          showScreenTryAgain();
          return;
     }

     if (starScore >= winScore) {
          setGameWon(true);
          setGameOver(false);
          setGamePaused(true);
          setGameMenuOpen(false);
          setGameMenuView("");
          resetTouchControls();
          clearGameOverlay();
          showScreenYouWin();
     }
}

function gameLoop() {
     updateGame();
     drawGame();
     requestAnimationFrame(gameLoop);
}

// ==================================================
// STARTUP
// ==================================================

export function startStarShower() {
     loadAndApplySavedOptions();

     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();
     resetHelphurtIntroState();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();
     resetUiActionBounds();

     screenLayerActive = true;
     screenLayerTimer = -1;
     screenLayerDuration = -1;
     gameScreenMode = "screenWelcome";
     clearRoundIntro();

     bindKeyboardInput();
     bindPointerInput();
     bindResizeHandler(syncCanvasResolutionAndUiBounds);

     gameLoop();
}

if (!miniGameCanvas || !miniGameCtx) {
     console.warn("Star Shower canvas not found.");
} else {
     startStarShower();
}
