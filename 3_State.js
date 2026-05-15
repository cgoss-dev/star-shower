// NOTE: 3_State
// Shared runtime data for Sparkle Seeker.
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
     // Example: sparkle pickup changes the face briefly, then it returns.
     sparkleFaceTimer: 0,

     hitScale: 1.1,
     lowHealthPulseTime: 0
};

// ==================================================
// INPUT + SHARED ENTITY ARRAYS
// These are mutated during gameplay, so they stay centralized here.
// ==================================================

export const keys = {};
export const sparkles = [];
export const healthHazards = [];
export const effectPickups = [];
export const collisionBursts = [];

// ==================================================
// SCORE + HEALTH
// ==================================================

export let sparkleScore = 0;
export let scoreMultiplier = 1;

export let playerHealth = gameplayStartingHealth;

// ====================================================================================================
// NOTE: OPTIONS LEVELS
// Current selected levels live here because they are mutable runtime state.
// ====================================================================================================

export let musicLevel = defaultOptionLevelIndex;
export let soundEffectsLevel = defaultOptionLevelIndex;
export let harmfulLevel = defaultOptionLevelIndex;
export let movementLevel = 0;
export let colorLevel = 0;

// ==================================================
// EFFECT STATE
// Runtime storage only. Effect rules live elsewhere.
// Timers are frame counts, so 60 frames is roughly 1 second.
// ==================================================

export const effectTimers = {
     luck: 0,
     magnet: 0,
     slowmo: 0,

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
export let harmfulEnabled = true;

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
     tipsEffectsButton: { x: 0, y: 0, width: 0, height: 0 },

     optionsDifficultyButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsAudioButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsMovementButton: { x: 0, y: 0, width: 0, height: 0 },
     optionsColorButton: { x: 0, y: 0, width: 0, height: 0 },

     harmfulRow: { x: 0, y: 0, width: 0, height: 0 },
     harmfulDecreaseButton: { x: 0, y: 0, width: 0, height: 0 },
     harmfulIncreaseButton: { x: 0, y: 0, width: 0, height: 0 },

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
          pointerId: null,
          label: "\u23EF\uFE0E"
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

export let sparkleSpawnTimer = 0;
export let effectPickupSpawnTimer = 0;

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

export function setSparkleSpawnTimer(value) {
     sparkleSpawnTimer = value;
}

export function setEffectPickupSpawnTimer(value) {
     effectPickupSpawnTimer = value;
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

export function setSparkleScore(value) {
     sparkleScore = Math.max(0, value);
}

export function setScoreMultiplier(value) {
     scoreMultiplier = Math.max(1, value);
}

export function resetScoreMultiplier() {
     scoreMultiplier = 1;
}

export function addSparkleScore(value) {
     sparkleScore = Math.max(0, sparkleScore + (value * scoreMultiplier));
}

export function setPlayerHealth(value) {
     playerHealth = Math.max(0, Math.min(maxPlayerHealth, value));
}

export function addPlayerHealth(value) {
     playerHealth = Math.max(0, Math.min(maxPlayerHealth, playerHealth + value));
}

// ==================================================
// EFFECT SETTERS + HELPERS
// ==================================================

export function setEffectTimer(effectName, value) {
     if (!(effectName in effectTimers)) {
          return;
     }

     effectTimers[effectName] = Math.max(0, value);
}

export function addEffectTimer(effectName, value) {
     if (!(effectName in effectTimers)) {
          return;
     }

     effectTimers[effectName] = Math.max(0, effectTimers[effectName] + value);
}

export function isEffectActive(effectName) {
     return (effectTimers[effectName] || 0) > 0;
}

export function decrementEffectTimers() {
     Object.keys(effectTimers).forEach((effectName) => {
          if (effectTimers[effectName] > 0) {
               effectTimers[effectName] -= 1;
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

export function resetEffectState() {
     Object.keys(effectTimers).forEach((effectName) => {
          effectTimers[effectName] = 0;
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

function syncHarmfulEnabledFromLevel() {
     harmfulEnabled = harmfulLevel > 0;
}

export function syncOptionFlagsFromLevels() {
     syncMusicEnabledFromLevel();
     syncSoundEffectsEnabledFromLevel();
     syncHarmfulEnabledFromLevel();
}

export function resetOptionsToDefaults() {
     musicLevel = defaultOptionLevelIndex;
     soundEffectsLevel = defaultOptionLevelIndex;
     harmfulLevel = defaultOptionLevelIndex;
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
}

export function setGameMenuView(value) {
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

// Boolean setters. Keep legacy simple on/off controls in sync with option levels.
export function setMusicEnabled(value) {
     musicEnabled = value;
     musicLevel = value ? maxOptionLevelIndex : 0;
}

export function setSoundEffectsEnabled(value) {
     soundEffectsEnabled = value;
     soundEffectsLevel = value ? maxOptionLevelIndex : 0;
}

export function setHarmfulEnabled(value) {
     harmfulEnabled = value;
     harmfulLevel = value ? maxOptionLevelIndex : 0;
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

export function setHarmfulLevel(value) {
     harmfulLevel = clampRuntimeOptionLevelIndex(value);
     syncHarmfulEnabledFromLevel();
}

export function setMovementLevel(value) {
     movementLevel = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
     touchControls.touchMoveTarget.pointerId = null;
     touchControls.touchMoveTarget.isActive = false;
     clearJoystickInput();
}

export function setColorLevel(value) {
     colorLevel = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
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
     sparkleScore = 0;
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

     sparkleSpawnTimer = 0;
     effectPickupSpawnTimer = 0;

     sparkles.length = 0;
     healthHazards.length = 0;
     effectPickups.length = 0;
     collisionBursts.length = 0;

     welcomeSelectionIndex = 0;
     pausedSelectionIndex = 0;
     tipsSelectionIndex = 0;
     optionsSelection.row = 0;
     optionsSelection.col = 0;

     resetEffectState();
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

export function isCollidingWithSparkle(playerObject, sparkleObject) {
     const dx = playerObject.x - sparkleObject.x;
     const dy = playerObject.y - sparkleObject.y;

     return Math.sqrt((dx * dx) + (dy * dy)) < playerObject.radius + (sparkleObject.size * 0.25);
}
