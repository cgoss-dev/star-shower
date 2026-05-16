// NOTE: 2_GameEngine
// Main runtime orchestration for Star Shower.
//
// Owned here:
// - startup / boot flow
// - main game loop
// - round reset flow
// - screen/mode transitions
// - overlay timers / overlay state helpers
// - win / lose checks
// - option step helpers used by input/UI
//
// NOT owned here:
// - raw shared data storage
// - drawing implementation
// - menu layout / menu click handling
// - player movement input plumbing
// - particle internals
//
// Newbie note:
// - This file should answer "what happens next?"
// - If code draws things, it belongs in `9_Config.js`.
// - If code stores shared mutable data, it belongs in `3_State.js`.
// - If code updates stars/friends/enemies, it belongs in `8_Entities.js`.

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
     musicLevel,
     soundEffectsLevel,
     baneLevel,
     movementLevel,
     colorLevel,
     boostBanePickups,
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
     setMusicLevel,
     setSoundEffectsLevel,
     setBaneLevel,
     setMovementLevel,
     setColorLevel,
     setMiniGameSize,
     updateMenuKeyboardFocusTimer,
     updateMeterPulseTimers,
     triggerLevelMeterPulse,

     resetUiActionBounds,
     resetGameState
} from "./3_State.js";

import {
     optionLevelLabels,
     optionLevelValues,
     maxOptionLevelIndex,
     movementOptionLabels,
     getMaxMovementOptionIndex,
     colorOptionLabels,
     maxColorOptionIndex,
     loadAndApplySavedOptions,
     saveCurrentOptions
} from "./4_Options.js";

import {
     bindKeyboardInput,
     bindPointerInput,
     bindResizeHandler,
     updateTouchControlBounds,
     resetTouchControls
} from "./6_Input.js";

import {
     resetPlayerPosition,
     updatePlayer,
     updatePlayerFaceState,
     resetEntityColorCycle,
     updateBoostBaneState,
     updateStarSpawns,
     updateStars,
     updateStrikes,
     updateBoostBanePickups,
     updateCollisionBursts,
     collectStars,
     collectStrikes,
     collectBoostBanePickups,
     updatePlayerTrail,
     resetBoostBaneIntroState,
     setBoostBaneIntroCallback
} from "./8_Entities.js";

import {
     winScore,
     startOverlayDuration,
     overlayFadeFrames,
     levelPopupDuration,
     getCurrentLevelNumber,
     getScreenTitleLinesForMode
} from "./5_GameRules.js";

import {
     syncUiBounds,
     updatePauseButtonState,
     updateScreenTitleColorState,
     drawGame
} from "./7_Draw.js";

import {
     starShowerBoostBaneIcons
} from "./9_Config.js";

import {
     playSoundEffect,
     syncBackgroundMusic
} from "./10_Audio.js";

// ==================================================
// SCREEN STATE
// `screenWelcome` hides the board entirely.
// `screenTryAgain` and `screenYouWin` are board overlays.
// ==================================================

let screenLayerActive = true;
let screenLayerTimer = -1;
let screenLayerDuration = -1;
let gameScreenMode = "screenWelcome";
let activeLevelNumber = 1;
let levelPopupText = "";
let levelPopupSubtext = "";
let levelPopupIcon = "";
let levelPopupTimer = 0;
let levelPopupDurationFrames = 0;

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
     if (
          gameMenuView === "tips_how_to_play" ||
          gameMenuView === "tips_boosts"
     ) {
          setMenuViewAndRefresh("tips");
          return;
     }

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
}

export function showScreenTryAgain() {
     screenLayerActive = true;
     gameScreenMode = "screenTryAgain";
     screenLayerTimer = -1;
     screenLayerDuration = -1;
}

export function showScreenYouWin() {
     screenLayerActive = true;
     gameScreenMode = "screenYouWin";
     screenLayerTimer = -1;
     screenLayerDuration = -1;
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
     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();
     resetBoostBaneIntroState();
     resetLevelProgressState();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();

     screenLayerActive = false;

     setGameStarted(true);
     setGamePaused(false);
     setGameMenuOpen(false);
     setGameMenuView("");
     setGameOver(false);
     setGameWon(false);
     syncBackgroundMusic(true);
}

// ====================================================================================================
// NOTE: OPTIONS
// ====================================================================================================

export function getOptionLevelLabel(levelIndex) {
     return optionLevelLabels[levelIndex] || optionLevelLabels[0];
}

export function getOptionLevelValue(levelIndex) {
     return optionLevelValues[levelIndex] ?? optionLevelValues[0];
}

function getPreviousOptionLevelIndex(levelIndex) {
     return Math.max(0, levelIndex - 1);
}

function getNextOptionLevelIndex(levelIndex) {
     return Math.min(maxOptionLevelIndex, levelIndex + 1);
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

export function getBaneToggleLabel() {
     return getOptionLevelLabel(baneLevel);
}

export function getMusicToggleLabel() {
     return getOptionLevelLabel(musicLevel);
}

export function getSoundEffectsToggleLabel() {
     return getOptionLevelLabel(soundEffectsLevel);
}

export function getMovementToggleLabel() {
     return movementOptionLabels[movementLevel] || movementOptionLabels[0];
}

export function getColorToggleLabel() {
     return colorOptionLabels[colorLevel] || colorOptionLabels[0];
}

export function decreaseMusicLevel() {
     setMusicLevel(getPreviousOptionLevelIndex(musicLevel));
     saveCurrentOptions();
}

export function increaseMusicLevel() {
     setMusicLevel(getNextOptionLevelIndex(musicLevel));
     saveCurrentOptions();
}

export function decreaseSoundEffectsLevel() {
     setSoundEffectsLevel(getPreviousOptionLevelIndex(soundEffectsLevel));
     saveCurrentOptions();
}

export function increaseSoundEffectsLevel() {
     setSoundEffectsLevel(getNextOptionLevelIndex(soundEffectsLevel));
     saveCurrentOptions();
}

export function decreaseBaneLevel() {
     const nextLevel = getPreviousOptionLevelIndex(baneLevel);
     setBaneLevel(nextLevel);

     if (nextLevel === 0) {
          boostBanePickups.length = 0;
     }

     saveCurrentOptions();
}

export function increaseBaneLevel() {
     setBaneLevel(getNextOptionLevelIndex(baneLevel));
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

function resetLevelProgressState() {
     activeLevelNumber = getCurrentLevelNumber();
     levelPopupText = "";
     levelPopupSubtext = "";
     levelPopupIcon = "";
     levelPopupTimer = 0;
     levelPopupDurationFrames = 0;
}

function showNewEntityPopup(entityType) {
     if (!entityType) {
          return;
     }

     levelPopupText = `NEW ${entityType.category === "bane" ? "BANE" : "BOOST"}`;
     levelPopupSubtext = entityType.label || "";
     levelPopupIcon = Object.keys(starShowerBoostBaneIcons).find(
          (iconName) => starShowerBoostBaneIcons[iconName] === entityType
     ) || "";
     levelPopupTimer = levelPopupDuration;
     levelPopupDurationFrames = levelPopupDuration;
}

function updateLevelPopupTimer() {
     if (levelPopupTimer <= 0) {
          return;
     }

     if (gamePaused) {
          return;
     }

     levelPopupTimer -= 1;

     if (levelPopupTimer <= 0) {
          levelPopupText = "";
          levelPopupSubtext = "";
          levelPopupIcon = "";
          levelPopupTimer = 0;
          levelPopupDurationFrames = 0;
     }
}

function syncLevelProgressState() {
     const currentLevelNumber = getCurrentLevelNumber();

     if (currentLevelNumber <= activeLevelNumber) {
          return;
     }

     activeLevelNumber = currentLevelNumber;
     triggerLevelMeterPulse();
}

export function getLevelPopupText() {
     return levelPopupText;
}

export function getLevelPopupSubtext() {
     return levelPopupSubtext;
}

export function getLevelPopupIcon() {
     return levelPopupIcon;
}

export function getLevelPopupAlpha() {
     if (!levelPopupText || levelPopupTimer <= 0 || levelPopupDurationFrames <= 0) {
          return 0;
     }

     const elapsed = levelPopupDurationFrames - levelPopupTimer;
     const fadeIn = Math.min(1, elapsed / overlayFadeFrames);
     const fadeOut = Math.min(1, levelPopupTimer / overlayFadeFrames);

     return Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
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

// ==================================================
// GAME UPDATE
// ==================================================

export function updateGame() {
     updatePauseButtonState();
     updateGameOverlayTimer();
     updateLevelPopupTimer();
     updateMenuKeyboardFocusTimer();
     updateMeterPulseTimers();

     if (screenLayerActive) {
          updateScreenTitleColorState();
     }

     syncBackgroundMusic(
          gameStarted &&
          !gamePaused &&
          !gameMenuOpen &&
          !gameOver &&
          !gameWon &&
          !isScreenWelcomeActive()
     );

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

     updateBoostBaneState();
     updatePlayer();
     updateStarSpawns();
     updateStars();
     updateStrikes();
     updateBoostBanePickups();
     updateCollisionBursts();
     updatePlayerTrail();
     collectStars();
     collectStrikes();
     collectBoostBanePickups();
     syncLevelProgressState();

     if (playerHealth <= 0) {
          setGameOver(true);
          setGameWon(false);
          setGamePaused(true);
          setGameMenuOpen(false);
          setGameMenuView("");
          resetTouchControls();
          clearGameOverlay();
          playSoundEffect("lose");
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
          playSoundEffect("win");
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
     setBoostBaneIntroCallback(showNewEntityPopup);

     resetGameState();
     resetTouchControls();
     resetEntityColorCycle();
     resetBoostBaneIntroState();

     syncCanvasResolutionAndUiBounds();
     resetPlayerPosition();
     resetUiActionBounds();

     screenLayerActive = true;
     screenLayerTimer = -1;
     screenLayerDuration = -1;
     gameScreenMode = "screenWelcome";

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
