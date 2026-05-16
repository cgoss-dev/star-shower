// NOTE: 3_State
// Shared runtime data for Star Shower.
//
// Other files import from here to READ shared state, and use the setter
// functions below to UPDATE shared state.
//
// Keep this file focused on shared data only.
// Do not place game loop, rendering, or gameplay system logic in here.

import {
     gameplayStartingHealth,
     maxPlayerHealth,
     maxOptionLevelIndex,
     defaultOptionLevelIndex
} from "./4_Options.js";

export const miniGameCanvas = document.getElementById("miniGameCanvas");

// Canvas may not exist immediately during page load, so we guard against null here.
export const miniGameCtx = miniGameCanvas ? miniGameCanvas.getContext("2d") : null;

// These track the CSS-sized play area used by gameplay logic.
// Width and height stay separate so the canvas can be rectangular without stretching gameplay.
export let miniGameWidth = 0;
export let miniGameHeight = 0;

// ====================================================================================================
// NOTE: PLAYER
// Core player data lives here because several systems need it.
// ====================================================================================================

export const player = {
     x: 0,
     y: 0,
     char: "😐",
     size: 64,
     speed: 2,
     radius: 30,

     baseSize: 64,
     baseRadius: 30,

     // Temporary face-expression timer.
     // Example: star pickup changes the face briefly, then it returns.
     starFaceTimer: 0,

     hitScale: 1.1,
     lowHealthPulseTime: 0
};

// ==================================================
// INPUT + SHARED ENTITY ARRAYS
// These are mutated during gameplay, so they stay centralized here.
// ==================================================

export const keys = {};
export const stars = [];
export const strikes = [];
export const boostBanePickups = [];
export const collisionBursts = [];

// ==================================================
// SCORE + HEALTH
// ==================================================

export let starScore = 0;
export let scoreMultiplier = 1;

export let playerHealth = gameplayStartingHealth;

// ====================================================================================================
// NOTE: OPTIONS LEVELS
// Current selected levels live here because they are mutable runtime state.
// ====================================================================================================

export let musicLevel = defaultOptionLevelIndex;
export let soundEffectsLevel = defaultOptionLevelIndex;
export let baneLevel = defaultOptionLevelIndex;
export let movementLevel = 0;
export let colorLevel = 0;

// ==================================================
// EFFECT STATE
// Runtime storage only. Boost/bane rules live elsewhere.
// Timers are frame counts, so 60 frames is roughly 1 second.
// ==================================================

export const boostBaneTimers = {
     magnet: 0,
     double: 0,

     freeze: 0,
     daze: 0,
     fog: 0
};

export const activeStatusUi = {
     label: "CLEAR",
     particle: "",
     timer: 0,
     duration: 0
};

// ==================================================
// GAME FLOW FLAGS
// ==================================================

export let gameStarted = false;
export let gamePaused = true;

// Menu state for menu screens like Tips / Options.
// Closed menus use an empty view string.
export let gameMenuOpen = false;
export let gameMenuView = "";

// Compatibility booleans for systems that still expect simple flags.
export let musicEnabled = true;
export let soundEffectsEnabled = true;
export let baneEnabled = true;

export let gameOver = false;
export let gameWon = false;

// ==================================================
// OVERLAY STATE
// Used for short messages like win / lose / start text.
// ==================================================

export let gameOverlayText = "";
export let gameOverlaySubtext = "";
export let gameOverlayTimer = 0;
export let gameOverlayDuration = 0;

// ==================================================
// UI HIT BOXES
// Layout bounds that UI code and pointer/touch handling can share.
// ==================================================

export const gameMenuUi = {
     panel: { x: 0, y: 0, width: 0, height: 0 },

     tipsHowToPlayButton: { x: 0, y: 0, width: 0, height: 0 },
     tipsBoostsButton: { x: 0, y: 0, width: 0, height: 0 },

     optionsDifficultyButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsAudioButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsMovementButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsColorButton: { x: 0, y: 0, width: 0, height: 0 },

     baneRow: { x: 0, y: 0, width: 0, height: 0 },
     baneDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     baneIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

     musicRow: { x: 0, y: 0, width: 0, height: 0 },
     musicDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     musicIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

     soundEffectsRow: { x: 0, y: 0, width: 0, height: 0 },
     soundEffectsDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     soundEffectsIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

     movementRow: { x: 0, y: 0, width: 0, height: 0 },
     movementDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     movementIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

     colorRow: { x: 0, y: 0, width: 0, height: 0 },
     colorDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     colorIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

     backButton: { x: 0, y: 0, width: 0, height: 0 }
};

export const screenActionUi = {
     startButton: { x: 0, y: 0, width: 0, height: 0 },
     tipsButton: { x: 0, y: 0, width: 0, height: 0 },
     menuButton: { x: 0, y: 0, width: 0, height: 0 },
     returnButton: { x: 0, y: 0, width: 0, height: 0 }
};

export const pausedActionUi = {
     resumeButton: { x: 0, y: 0, width: 0, height: 0 },
     newGameButton: { x: 0, y: 0, width: 0, height: 0 },
     tipsButton: { x: 0, y: 0, width: 0, height: 0 },
     menuButton: { x: 0, y: 0, width: 0, height: 0 },
     returnButton: { x: 0, y: 0, width: 0, height: 0 }
};

// ==================================================
// MENU KEYBOARD FOCUS STATE
// Shared so input can write it and UI can read it without a circular import.
// ==================================================

export let welcomeSelectionIndex = 0;
export let pausedSelectionIndex = 0;
export let tipsSelectionIndex = 0;
export let optionsSelection = {
     row: 0,
     col: 0
};
export const gameMenuScroll = {
     offset: 0,
     max: 0,
     pointerId: null,
     lastY: 0
};
export const menuKeyboardFocus = {
     timer: 0,
     duration: 60
};

export const meterPulse = {
     level: {
          timer: 0,
          duration: 18,
          scale: 1.2
     },
     health: {
          timer: 0,
          duration: 18,
          scale: 1.2
     }
};

// ==================================================
// TOUCH CONTROLS
// Sizes here are gameplay/UI data, not CSS styling.
// ==================================================

export const touchControls = {
     touchMoveTarget: {
          x: 0,
          y: 0,
          pointerId: null,
          isActive: false
     },

     pauseButton: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          isPressed: false,
          pointerId: null
     },

     joystick: {
          x: 0,
          y: 0,
          baseRadius: 0,
          knobRadius: 0,
          maxDistance: 0,
          deadZone: 0,
          pointerId: null,
          isActive: false,
          dx: 0,
          dy: 0
     }
};

// ==================================================
// CANVAS HOVER RUNTIME STATE
// ==================================================

export let hoverCanvasX = 0;
export let hoverCanvasY = 0;
export let isCanvasPointerInside = false;
export let hoverTrackingAttachedCanvas = null;

// ==================================================
// TOUCH TARGET SETTERS
// ==================================================

export function setTouchMoveTarget(x, y, pointerId) {
     touchControls.touchMoveTarget.x = x;
     touchControls.touchMoveTarget.y = y;
     touchControls.touchMoveTarget.pointerId = pointerId;
     touchControls.touchMoveTarget.isActive = true;
}

export function clearTouchMoveTarget(pointerId) {
     if (touchControls.touchMoveTarget.pointerId !== pointerId) {
          return;
     }

     touchControls.touchMoveTarget.pointerId = null;
     touchControls.touchMoveTarget.isActive = false;
}

export function setJoystickInput(dx, dy, pointerId) {
     touchControls.joystick.dx = dx;
     touchControls.joystick.dy = dy;
     touchControls.joystick.pointerId = pointerId;
     touchControls.joystick.isActive = true;
}

export function clearJoystickInput(pointerId = touchControls.joystick.pointerId) {
     if (pointerId !== null && touchControls.joystick.pointerId !== pointerId) {
          return;
     }

     touchControls.joystick.dx = 0;
     touchControls.joystick.dy = 0;
     touchControls.joystick.pointerId = null;
     touchControls.joystick.isActive = false;
}

// ==================================================
// ONE-TIME BIND FLAGS
// These prevent accidental duplicate event listeners.
// ==================================================

export let pointerInputBound = false;
export let keyboardInputBound = false;
export let resizeHandlerBound = false;

// ==================================================
// SPAWN TIMERS
// ==================================================

export let starSpawnTimer = 0;
export let boostBanePickupSpawnTimer = 0;

// ==================================================
// BASIC SETTERS
// ==================================================

export function setMiniGameSize(width, height) {
     miniGameWidth = width;
     miniGameHeight = height;
}

export function setPointerInputBound(value) {
     pointerInputBound = value;
}

export function setKeyboardInputBound(value) {
     keyboardInputBound = value;
}

export function setResizeHandlerBound(value) {
     resizeHandlerBound = value;
}

export function setStarSpawnTimer(value) {
     starSpawnTimer = value;
}

export function setBoostBanePickupSpawnTimer(value) {
     boostBanePickupSpawnTimer = value;
}

export function setHoverCanvasPosition(x, y) {
     hoverCanvasX = x;
     hoverCanvasY = y;
}

export function setCanvasPointerInside(value) {
     isCanvasPointerInside = Boolean(value);
}

export function setHoverTrackingAttachedCanvas(value) {
     hoverTrackingAttachedCanvas = value;
}

// ==================================================
// SCORE + HEALTH SETTERS
// ==================================================

export function setStarScore(value) {
     starScore = Math.max(0, value);
}

export function setScoreMultiplier(value) {
     scoreMultiplier = Math.max(1, value);
}

export function resetScoreMultiplier() {
     scoreMultiplier = 1;
}

export function addStarScore(value) {
     starScore = Math.max(0, starScore + (value * scoreMultiplier));
}

export function setPlayerHealth(value) {
     const nextHealth = Math.max(0, Math.min(maxPlayerHealth, value));

     if (nextHealth !== playerHealth) {
          triggerHealthMeterPulse();
     }

     playerHealth = nextHealth;
}

export function addPlayerHealth(value) {
     const nextHealth = Math.max(0, Math.min(maxPlayerHealth, playerHealth + value));

     if (nextHealth !== playerHealth) {
          triggerHealthMeterPulse();
     }

     playerHealth = nextHealth;
}

// ==================================================
// EFFECT SETTERS + HELPERS
// ==================================================

export function setBoostBaneTimer(boostBaneName, value) {
     if (!(boostBaneName in boostBaneTimers)) {
          return;
     }

     boostBaneTimers[boostBaneName] = Math.max(0, value);
}

export function addBoostBaneTimer(boostBaneName, value) {
     if (!(boostBaneName in boostBaneTimers)) {
          return;
     }

     boostBaneTimers[boostBaneName] = Math.max(0, boostBaneTimers[boostBaneName] + value);
}

export function isBoostBaneActive(boostBaneName) {
     return (boostBaneTimers[boostBaneName] || 0) > 0;
}

export function decrementBoostBaneTimers() {
     Object.keys(boostBaneTimers).forEach((boostBaneName) => {
          if (boostBaneTimers[boostBaneName] > 0) {
               boostBaneTimers[boostBaneName] -= 1;
          }
     });

     if (activeStatusUi.timer > 0) {
          activeStatusUi.timer -= 1;
     }
}

export function setActiveStatusUi(label, particle = "", timer = 0, duration = timer) {
     activeStatusUi.label = label;
     activeStatusUi.particle = particle;
     activeStatusUi.timer = Math.max(0, timer);
     activeStatusUi.duration = Math.max(0, duration);
}

export function clearActiveStatusUi() {
     activeStatusUi.label = "CLEAR";
     activeStatusUi.particle = "";
     activeStatusUi.timer = 0;
     activeStatusUi.duration = 0;
}

export function resetBoostBaneState() {
     Object.keys(boostBaneTimers).forEach((boostBaneName) => {
          boostBaneTimers[boostBaneName] = 0;
     });

     clearActiveStatusUi();
     resetScoreMultiplier();
}

// ==================================================
// OPTIONS HELPERS
// ==================================================

function clampRuntimeOptionLevelIndex(value) {
     return Math.max(0, Math.min(maxOptionLevelIndex, value));
}

function syncMusicEnabledFromLevel() {
     musicEnabled = musicLevel > 0;
}

function syncSoundEffectsEnabledFromLevel() {
     soundEffectsEnabled = soundEffectsLevel > 0;
}

function syncBaneEnabledFromLevel() {
     baneEnabled = baneLevel > 0;
}

export function syncOptionFlagsFromLevels() {
     syncMusicEnabledFromLevel();
     syncSoundEffectsEnabledFromLevel();
     syncBaneEnabledFromLevel();
}

export function resetOptionsToDefaults() {
     musicLevel = defaultOptionLevelIndex;
     soundEffectsLevel = defaultOptionLevelIndex;
     baneLevel = defaultOptionLevelIndex;
     movementLevel = 0;
     colorLevel = 0;

     syncOptionFlagsFromLevels();
}

// ==================================================
// GAME FLOW SETTERS
// ==================================================

export function setGameStarted(value) {
     gameStarted = value;
}

export function setGamePaused(value) {
     gamePaused = value;
}

export function setGameMenuOpen(value) {
     gameMenuOpen = value;

     if (!value) {
          resetGameMenuScroll();
     }
}

export function setGameMenuView(value) {
     if (gameMenuView !== value) {
          gameMenuView = value;
          resetGameMenuScroll();
          return;
     }

     gameMenuView = value;
}

export function setWelcomeSelectionIndex(value) {
     welcomeSelectionIndex = value;
}

export function setPausedSelectionIndex(value) {
     pausedSelectionIndex = value;
}

export function setTipsSelectionIndex(value) {
     tipsSelectionIndex = value;
}

export function setOptionsSelection(row, col = optionsSelection.col) {
     optionsSelection.row = row;
     optionsSelection.col = col;
}

export function setOptionsSelectionRow(value) {
     optionsSelection.row = value;
}

export function setOptionsSelectionCol(value) {
     optionsSelection.col = value;
}

function clampGameMenuScrollOffset(value) {
     return Math.max(0, Math.min(gameMenuScroll.max, value));
}

export function resetGameMenuScroll() {
     gameMenuScroll.offset = 0;
     gameMenuScroll.max = 0;
     gameMenuScroll.pointerId = null;
     gameMenuScroll.lastY = 0;
}

export function setGameMenuScrollMax(value) {
     gameMenuScroll.max = Math.max(0, value);
     gameMenuScroll.offset = clampGameMenuScrollOffset(gameMenuScroll.offset);
}

export function addGameMenuScrollOffset(delta) {
     gameMenuScroll.offset = clampGameMenuScrollOffset(gameMenuScroll.offset + delta);
}

export function beginGameMenuScrollDrag(pointerId, y) {
     gameMenuScroll.pointerId = pointerId;
     gameMenuScroll.lastY = y;
}

export function updateGameMenuScrollDrag(y) {
     const delta = gameMenuScroll.lastY - y;

     gameMenuScroll.lastY = y;
     addGameMenuScrollOffset(delta);
}

export function endGameMenuScrollDrag(pointerId = gameMenuScroll.pointerId) {
     if (gameMenuScroll.pointerId !== pointerId) {
          return false;
     }

     gameMenuScroll.pointerId = null;
     gameMenuScroll.lastY = 0;
     return true;
}

export function showMenuKeyboardFocus(duration = menuKeyboardFocus.duration) {
     menuKeyboardFocus.timer = duration;
}

export function updateMenuKeyboardFocusTimer() {
     if (menuKeyboardFocus.timer > 0) {
          menuKeyboardFocus.timer -= 1;
     }
}

export function getMenuKeyboardFocusAlpha() {
     if (menuKeyboardFocus.duration <= 0) {
          return 0;
     }

     return Math.max(0, Math.min(1, menuKeyboardFocus.timer / menuKeyboardFocus.duration));
}

function triggerMeterPulse(pulse) {
     pulse.timer = pulse.duration;
}

function getMeterPulseScale(pulse) {
     if (pulse.timer <= 0 || pulse.duration <= 0) {
          return 1;
     }

     const progress = 1 - (pulse.timer / pulse.duration);
     const pulseWave = 1 - Math.abs((progress * 2) - 1);

     return 1 + ((pulse.scale - 1) * pulseWave);
}

export function triggerLevelMeterPulse() {
     triggerMeterPulse(meterPulse.level);
}

export function triggerHealthMeterPulse() {
     triggerMeterPulse(meterPulse.health);
}

export function updateMeterPulseTimers() {
     Object.values(meterPulse).forEach((pulse) => {
          if (pulse.timer > 0) {
               pulse.timer -= 1;
          }
     });
}

export function getLevelMeterPulseScale() {
     return getMeterPulseScale(meterPulse.level);
}

export function getHealthMeterPulseScale() {
     return getMeterPulseScale(meterPulse.health);
}

// Boolean setters. Keep legacy simple on/off controls in sync with option levels.
export function setMusicEnabled(value) {
     musicEnabled = value;
     musicLevel = value ? maxOptionLevelIndex : 0;
}

export function setSoundEffectsEnabled(value) {
     soundEffectsEnabled = value;
     soundEffectsLevel = value ? maxOptionLevelIndex : 0;
}

export function setBaneEnabled(value) {
     baneEnabled = value;
     baneLevel = value ? maxOptionLevelIndex : 0;
}

// Level setters for Options UI.
export function setMusicLevel(value) {
     musicLevel = clampRuntimeOptionLevelIndex(value);
     syncMusicEnabledFromLevel();
}

export function setSoundEffectsLevel(value) {
     soundEffectsLevel = clampRuntimeOptionLevelIndex(value);
     syncSoundEffectsEnabledFromLevel();
}

export function setBaneLevel(value) {
     baneLevel = clampRuntimeOptionLevelIndex(value);
     syncBaneEnabledFromLevel();
}

export function setMovementLevel(value) {
     movementLevel = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
     touchControls.touchMoveTarget.pointerId = null;
     touchControls.touchMoveTarget.isActive = false;
     clearJoystickInput();
}

export function setColorLevel(value) {
     colorLevel = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
}

export function setGameOver(value) {
     gameOver = value;
}

export function setGameWon(value) {
     gameWon = value;
}

// ==================================================
// OVERLAY SETTERS
// ==================================================

export function setGameOverlayText(value) {
     gameOverlayText = value;
}

export function setGameOverlaySubtext(value) {
     gameOverlaySubtext = value;
}

export function setGameOverlayTimer(value) {
     gameOverlayTimer = value;
}

export function setGameOverlayDuration(value) {
     gameOverlayDuration = value;
}

// ==================================================
// TOUCH BUTTON SETTERS
// ==================================================

export function setPauseButtonPressed(value) {
     touchControls.pauseButton.isPressed = value;
}

export function setPauseButtonPointerId(value) {
     touchControls.pauseButton.pointerId = value;
}

// ==================================================
// UI ACTION BOUNDS HELPERS
// ==================================================

export function setButtonBounds(button, x, y, width, height) {
     button.x = x;
     button.y = y;
     button.width = width;
     button.height = height;
}

export function isPointInsideRect(x, y, rect) {
     return Boolean(
          rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          x >= rect.x &&
          x <= (rect.x + rect.width) &&
          y >= rect.y &&
          y <= (rect.y + rect.height)
     );
}

export function resetUiActionBounds() {
     screenActionUi.startButton.x = 0;
     screenActionUi.startButton.y = 0;
     screenActionUi.startButton.width = 0;
     screenActionUi.startButton.height = 0;

     screenActionUi.tipsButton.x = 0;
     screenActionUi.tipsButton.y = 0;
     screenActionUi.tipsButton.width = 0;
     screenActionUi.tipsButton.height = 0;

     screenActionUi.menuButton.x = 0;
     screenActionUi.menuButton.y = 0;
     screenActionUi.menuButton.width = 0;
     screenActionUi.menuButton.height = 0;

     screenActionUi.returnButton.x = 0;
     screenActionUi.returnButton.y = 0;
     screenActionUi.returnButton.width = 0;
     screenActionUi.returnButton.height = 0;

     pausedActionUi.resumeButton.x = 0;
     pausedActionUi.resumeButton.y = 0;
     pausedActionUi.resumeButton.width = 0;
     pausedActionUi.resumeButton.height = 0;

     pausedActionUi.newGameButton.x = 0;
     pausedActionUi.newGameButton.y = 0;
     pausedActionUi.newGameButton.width = 0;
     pausedActionUi.newGameButton.height = 0;

     pausedActionUi.tipsButton.x = 0;
     pausedActionUi.tipsButton.y = 0;
     pausedActionUi.tipsButton.width = 0;
     pausedActionUi.tipsButton.height = 0;

     pausedActionUi.menuButton.x = 0;
     pausedActionUi.menuButton.y = 0;
     pausedActionUi.menuButton.width = 0;
     pausedActionUi.menuButton.height = 0;

     pausedActionUi.returnButton.x = 0;
     pausedActionUi.returnButton.y = 0;
     pausedActionUi.returnButton.width = 0;
     pausedActionUi.returnButton.height = 0;
}

export function resetActionButtonBounds(actionUi, primaryButtonKey) {
     actionUi[primaryButtonKey].x = 0;
     actionUi[primaryButtonKey].y = 0;
     actionUi[primaryButtonKey].width = 0;
     actionUi[primaryButtonKey].height = 0;

     if (actionUi.newGameButton) {
          actionUi.newGameButton.x = 0;
          actionUi.newGameButton.y = 0;
          actionUi.newGameButton.width = 0;
          actionUi.newGameButton.height = 0;
     }

     actionUi.tipsButton.x = 0;
     actionUi.tipsButton.y = 0;
     actionUi.tipsButton.width = 0;
     actionUi.tipsButton.height = 0;

     actionUi.menuButton.x = 0;
     actionUi.menuButton.y = 0;
     actionUi.menuButton.width = 0;
     actionUi.menuButton.height = 0;

     actionUi.returnButton.x = 0;
     actionUi.returnButton.y = 0;
     actionUi.returnButton.width = 0;
     actionUi.returnButton.height = 0;
}

// ==================================================
// FULL GAME RESET
// Central reset used when starting a new round.
// ==================================================

export function resetGameState() {
     starScore = 0;
     scoreMultiplier = 1;

     playerHealth = gameplayStartingHealth;

     gameStarted = false;
     gamePaused = true;

     gameMenuOpen = false;
     gameMenuView = "";

     syncOptionFlagsFromLevels();

     gameOver = false;
     gameWon = false;

     gameOverlayText = "";
     gameOverlaySubtext = "";
     gameOverlayTimer = 0;
     gameOverlayDuration = 0;

     starSpawnTimer = 0;
     boostBanePickupSpawnTimer = 0;

     stars.length = 0;
     strikes.length = 0;
     boostBanePickups.length = 0;
     collisionBursts.length = 0;

     welcomeSelectionIndex = 0;
     pausedSelectionIndex = 0;
     tipsSelectionIndex = 0;
     optionsSelection.row = 0;
     optionsSelection.col = 0;
     resetGameMenuScroll();
     menuKeyboardFocus.timer = 0;

     resetBoostBaneState();
     resetUiActionBounds();

     touchControls.touchMoveTarget.x = 0;
     touchControls.touchMoveTarget.y = 0;
     touchControls.touchMoveTarget.pointerId = null;
     touchControls.touchMoveTarget.isActive = false;

     touchControls.pauseButton.isPressed = false;
     touchControls.pauseButton.pointerId = null;

     hoverCanvasX = 0;
     hoverCanvasY = 0;
     isCanvasPointerInside = false;
}

// ==================================================
// SMALL SHARED HELPERS
// ==================================================

export function randomItem(array) {
     return array[Math.floor(Math.random() * array.length)];
}

export function randomNumber(min, max) {
     return Math.random() * (max - min) + min;
}

export function isCollidingWithStar(playerObject, starObject) {
     const dx = playerObject.x - starObject.x;
     const dy = playerObject.y - starObject.y;

     return Math.sqrt((dx * dx) + (dy * dy)) < playerObject.radius + (starObject.size * 0.25);
}
