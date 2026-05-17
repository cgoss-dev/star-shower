// NOTE: input
// Keyboard, pointer, touch, pause-button, menu-hitbox, and resize binding for Star Shower.
//
// Owned here:
// - keyboard movement input
// - pointer/touch movement target updates
// - pause button interaction
// - welcome / paused / menu click handling
// - one-time event binding
// - touch control reset
// - keyboard menu navigation
//
// NOT owned here:
// - game loop / round transitions
// - shared state storage
// - player movement math
// - menu rendering / layout math
//
// Newbie note:
// - This file should answer "what happens when the player presses or taps?"
// - If code stores flags/arrays, it belongs in `state.js`.
// - If code draws buttons, it belongs in `draw/index.js`.
// - If code decides win/lose flow, it belongs in `game.js`.

import {
     miniGameCanvas,
     keys,
     gameStarted,
     gamePaused,
     gameMenuOpen,
     gameMenuView,
     gameOver,
     gameWon,
     blightLevel,
     movementLevel,
     colorLevel,
     gameMenuUi,
     touchControls,
     screenActionUi,
     pausedActionUi,
     pointerInputBound,
     keyboardInputBound,
     resizeHandlerBound,
     welcomeSelectionIndex,
     pausedSelectionIndex,
     tipsSelectionIndex,
     optionsSelection,
     gameMenuScroll,

     setTouchMoveTarget,
     clearTouchMoveTarget,
     setJoystickInput,
     clearJoystickInput,
     setPauseButtonPressed,
     setPauseButtonPointerId,
     setPointerInputBound,
     setKeyboardInputBound,
     setResizeHandlerBound,
     setGamePaused,
     setGameMenuView,
     setWelcomeSelectionIndex,
     setPausedSelectionIndex,
     setTipsSelectionIndex,
     setOptionsSelectionRow,
     setOptionsSelectionCol,
     addGameMenuScrollOffset,
     beginGameMenuScrollDrag,
     updateGameMenuScrollDrag,
     endGameMenuScrollDrag,
     showMenuKeyboardFocus
} from "./state.js";

import {
     isJoystickEnabled,
     movementOptionIndexes,
     maxOptionLevelIndex,
     getMaxMovementOptionIndex,
     maxColorOptionIndex
} from "./options.js";

import {
     dismissScreenWelcomeToStart,
     dismissScreenWelcomeToTipsMenu,
     dismissScreenWelcomeToOptionsMenu,
     dismissPausedToTipsMenu,
     dismissPausedToOptionsMenu,
     dismissMenuBackToPreviousScreen,
     showScreenWelcome,
     isScreenWelcomeActive,
     isOverlayScreenActive,
     startNewGameRound,
     decreaseblightLevel,
     increaseblightLevel,
     decreaseMusicLevel,
     increaseMusicLevel,
     decreaseSoundEffectsLevel,
     increaseSoundEffectsLevel,
     decreaseMovementLevel,
     increaseMovementLevel,
     decreaseColorLevel,
     increaseColorLevel
} from "./game.js";

import {
     syncUiBounds
} from "./draw/index.js";

const portfolioHomeUrl = "https://cgoss-dev.github.io/001_PortfolioProject/";

function returnToWebsite() {
     if (window.top && window.top !== window) {
          window.top.location.href = portfolioHomeUrl;
          return;
     }

     if (window.opener && !window.opener.closed) {
          window.opener.location.href = portfolioHomeUrl;
          window.opener.focus();
          window.close();
          return;
     }

     window.location.href = portfolioHomeUrl;
}

// ====================================================================================================
// NOTE: EXPORTS
// ====================================================================================================

export function resetTouchControls() {
     touchControls.touchMoveTarget.x = 0;
     touchControls.touchMoveTarget.y = 0;
     touchControls.touchMoveTarget.pointerId = null;
     touchControls.touchMoveTarget.isActive = false;

     clearJoystickInput();

     setPauseButtonPressed(false);
     setPauseButtonPointerId(null);
}

export function updateTouchControlBounds() {
     syncUiBounds();
}

export function bindKeyboardInput() {
     if (keyboardInputBound) {
          return;
     }

     window.addEventListener("keydown", handleKeyDown);
     window.addEventListener("keyup", handleKeyUp);

     setKeyboardInputBound(true);
}

export function bindPointerInput() {
     if (pointerInputBound || !miniGameCanvas) {
          return;
     }

     miniGameCanvas.style.touchAction = "none";

     miniGameCanvas.addEventListener("pointerdown", handlePointerDown);
     miniGameCanvas.addEventListener("wheel", handleWheel, { passive: false });
     window.addEventListener("pointermove", handlePointerMove, { passive: false });
     window.addEventListener("pointerup", handlePointerUp, { passive: false });
     window.addEventListener("pointercancel", handlePointerCancel, { passive: false });

     setPointerInputBound(true);
}

export function bindResizeHandler(onResize) {
     if (resizeHandlerBound) {
          return;
     }

     window.addEventListener("resize", () => {
          onResize();
     });

     setResizeHandlerBound(true);
}

// ====================================================================================================
// NOTE: FUNCITONS
// ====================================================================================================

function isPointInsideBox(x, y, box) {
     return box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function getCanvasPoint(event) {
     if (!miniGameCanvas) {
          return { x: 0, y: 0 };
     }

     const rect = miniGameCanvas.getBoundingClientRect();

     return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
     };
}

function preventPointerDefault(event) {
     if (event.cancelable && (event.pointerType === "touch" || event.type === "wheel")) {
          event.preventDefault();
     }
}

function isPrimaryPointer(event) {
     return event.isPrimary !== false;
}

function isPausedOverlayActive() {
     return gameStarted && gamePaused && !gameMenuOpen && !gameOver && !gameWon;
}

function isOptionsView() {
     return gameMenuView === "options";
}

function isOptionsDetailView() {
     return false;
}

function isTipsListView() {
     return gameMenuView === "tips";
}

function isScrollableMenuView() {
     return gameMenuOpen && isTipsListView();
}

function getOptionsBackRowIndex() {
     return isJoystickEnabled() ? 3 : 2;
}

function getOptionsColorRowIndex() {
     return isJoystickEnabled() ? 2 : 1;
}

function isUiNavigationActive() {
     return isScreenWelcomeActive() || isOverlayScreenActive() || isPausedOverlayActive() || gameMenuOpen;
}

function isPreviousMenuKey(event) {
     return event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "a" || event.key === "A" || event.key === "w" || event.key === "W";
}

function isNextMenuKey(event) {
     return event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "d" || event.key === "D" || event.key === "s" || event.key === "S";
}

function showMenuKeyboardFocusForDirectionalArrow(event) {
     if (event.key.startsWith("Arrow")) {
          showMenuKeyboardFocus();
     }
}

function isLeftKey(event) {
     return event.key === "ArrowLeft" || event.key === "a" || event.key === "A";
}

function isRightKey(event) {
     return event.key === "ArrowRight" || event.key === "d" || event.key === "D";
}

function isUpKey(event) {
     return event.key === "ArrowUp" || event.key === "w" || event.key === "W";
}

function isDownKey(event) {
     return event.key === "ArrowDown" || event.key === "s" || event.key === "S";
}

function isEnterKey(event) {
     return event.key === "Enter";
}

function isEscapeKey(event) {
     return event.key === "Escape";
}

function isSpaceKey(event) {
     return event.key === " " || event.key === "Spacebar" || event.code === "Space";
}

function clamp(value, min, max) {
     return Math.max(min, Math.min(max, value));
}

function setStoredKeyState(event, isPressed) {
     keys[event.key] = isPressed;
     keys[event.key.toLowerCase()] = isPressed;
}

function releasePauseButton(pointerId = touchControls.pauseButton.pointerId) {
     if (pointerId !== null && touchControls.pauseButton.pointerId !== pointerId) {
          return;
     }

     setPauseButtonPressed(false);
     setPauseButtonPointerId(null);
}

function clearPointerMove(pointerId = touchControls.touchMoveTarget.pointerId) {
     if (pointerId === null) {
          touchControls.touchMoveTarget.pointerId = null;
          touchControls.touchMoveTarget.isActive = false;
          return;
     }

     clearTouchMoveTarget(pointerId);
}

function isJoystickMovementMode() {
     return (
          isJoystickEnabled() &&
          (
               movementLevel === movementOptionIndexes.joystickLeft ||
               movementLevel === movementOptionIndexes.joystickRight
          )
     );
}

function isTouchClickMovementMode() {
     return movementLevel === movementOptionIndexes.pointerKeyboard;
}

function isPointInsideCircle(x, y, circle) {
     if (!circle) {
          return false;
     }

     return Math.hypot(x - circle.x, y - circle.y) <= circle.baseRadius;
}

function setJoystickFromPoint(x, y, pointerId) {
     const joystick = touchControls.joystick;
     const maxDistance = joystick.maxDistance || joystick.baseRadius || 1;
     const rawDx = x - joystick.x;
     const rawDy = y - joystick.y;
     const distance = Math.hypot(rawDx, rawDy);

     if (distance === 0) {
          setJoystickInput(0, 0, pointerId);
          return;
     }

     const clampedDistance = Math.min(distance, maxDistance);
     const normalizedX = (rawDx / distance) * (clampedDistance / maxDistance);
     const normalizedY = (rawDy / distance) * (clampedDistance / maxDistance);

     setJoystickInput(normalizedX, normalizedY, pointerId);
}

function closeMenuAndRefresh() {
     dismissMenuBackToPreviousScreen();
     syncUiBounds();
}

function activateOptionAdjustment(optionName, direction) {
     if (optionName === "blight") {
          direction < 0 ? decreaseblightLevel() : increaseblightLevel();
     }

     if (optionName === "music") {
          direction < 0 ? decreaseMusicLevel() : increaseMusicLevel();
     }

     if (optionName === "soundEffects") {
          direction < 0 ? decreaseSoundEffectsLevel() : increaseSoundEffectsLevel();
     }

     if (optionName === "movement") {
          direction < 0 ? decreaseMovementLevel() : increaseMovementLevel();
     }

     if (optionName === "color") {
          direction < 0 ? decreaseColorLevel() : increaseColorLevel();
     }

     syncUiBounds();
}

function handleWelcomeOrResultPointerDown(x, y) {
     if (!isScreenWelcomeActive() && !isOverlayScreenActive()) {
          return false;
     }

     if (isPointInsideBox(x, y, screenActionUi.startButton)) {
          setWelcomeSelectionIndex(0);

          if (isOverlayScreenActive()) {
               startNewGameRound();
          } else {
               dismissScreenWelcomeToStart();
          }

          return true;
     }

     if (isScreenWelcomeActive() && isPointInsideBox(x, y, screenActionUi.tipsButton)) {
          setWelcomeSelectionIndex(1);
          dismissScreenWelcomeToTipsMenu();
          return true;
     }

     if (isScreenWelcomeActive() && isPointInsideBox(x, y, screenActionUi.menuButton)) {
          setWelcomeSelectionIndex(2);
          dismissScreenWelcomeToOptionsMenu();
          return true;
     }

     if (isScreenWelcomeActive() && isPointInsideBox(x, y, screenActionUi.returnButton)) {
          setWelcomeSelectionIndex(3);
          returnToWebsite();
          return true;
     }

     return true;
}

function handlePausedOverlayPointerDown(x, y) {
     if (!isPausedOverlayActive()) {
          return false;
     }

     if (isPointInsideBox(x, y, pausedActionUi.resumeButton)) {
          setPausedSelectionIndex(0);
          setGamePaused(false);
          syncUiBounds();
          return true;
     }

     if (isPointInsideBox(x, y, pausedActionUi.newGameButton)) {
          setPausedSelectionIndex(1);
          startNewGameRound();
          return true;
     }

     if (isPointInsideBox(x, y, pausedActionUi.tipsButton)) {
          setPausedSelectionIndex(2);
          dismissPausedToTipsMenu();
          return true;
     }

     if (isPointInsideBox(x, y, pausedActionUi.menuButton)) {
          setPausedSelectionIndex(3);
          dismissPausedToOptionsMenu();
          return true;
     }

     if (isPointInsideBox(x, y, pausedActionUi.returnButton)) {
          setPausedSelectionIndex(4);
          returnToWebsite();
          return true;
     }

     return true;
}

function handleTipsMenuPointerDown(x, y) {
     if (!isTipsListView()) {
          return false;
     }

     if (isPointInsideBox(x, y, gameMenuUi.backButton)) {
          setTipsSelectionIndex(0);
          closeMenuAndRefresh();
          return true;
     }

     return false;
}

function handleOptionsPointerDown(x, y) {
     if (!isOptionsView()) {
          return false;
     }

     if (isPointInsideBox(x, y, gameMenuUi.backButton)) {
          setOptionsSelectionRow(getOptionsBackRowIndex());
          closeMenuAndRefresh();
          return true;
     }

     if (blightLevel > 0 && isPointInsideBox(x, y, gameMenuUi.blightDecreaseButton)) {
          setOptionsSelectionRow(0);
          setOptionsSelectionCol(0);
          decreaseblightLevel();
          syncUiBounds();
          return true;
     }

     if (blightLevel < maxOptionLevelIndex && isPointInsideBox(x, y, gameMenuUi.blightIncreaseButton)) {
          setOptionsSelectionRow(0);
          setOptionsSelectionCol(1);
          increaseblightLevel();
          syncUiBounds();
          return true;
     }

     if (isJoystickEnabled() && movementLevel > 0 && isPointInsideBox(x, y, gameMenuUi.movementDecreaseButton)) {
          setOptionsSelectionRow(1);
          setOptionsSelectionCol(0);
          decreaseMovementLevel();
          syncUiBounds();
          return true;
     }

     if (isJoystickEnabled() && movementLevel < getMaxMovementOptionIndex() && isPointInsideBox(x, y, gameMenuUi.movementIncreaseButton)) {
          setOptionsSelectionRow(1);
          setOptionsSelectionCol(1);
          increaseMovementLevel();
          syncUiBounds();
          return true;
     }

     if (colorLevel > 0 && isPointInsideBox(x, y, gameMenuUi.colorDecreaseButton)) {
          setOptionsSelectionRow(getOptionsColorRowIndex());
          setOptionsSelectionCol(0);
          decreaseColorLevel();
          syncUiBounds();
          return true;
     }

     if (colorLevel < maxColorOptionIndex && isPointInsideBox(x, y, gameMenuUi.colorIncreaseButton)) {
          setOptionsSelectionRow(getOptionsColorRowIndex());
          setOptionsSelectionCol(1);
          increaseColorLevel();
          syncUiBounds();
          return true;
     }

     return true;
}

function handleOptionsDetailPointerDown(x, y) {
     if (!isOptionsDetailView()) {
          return false;
     }

     if (isPointInsideBox(x, y, gameMenuUi.backButton)) {
          setGameMenuView("options");
          syncUiBounds();
          return true;
     }

     if (
          gameMenuView !== "options_difficulty" &&
          gameMenuView !== "options_audio" &&
          gameMenuView !== "options_movement" &&
          gameMenuView !== "options_color"
     ) {
          return true;
     }

     if (gameMenuView === "options_difficulty") {
          if (isPointInsideBox(x, y, gameMenuUi.blightDecreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(0);
               decreaseblightLevel();
               syncUiBounds();
               return true;
          }

          if (isPointInsideBox(x, y, gameMenuUi.blightIncreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(1);
               increaseblightLevel();
               syncUiBounds();
               return true;
          }

          return true;
     }

     if (gameMenuView === "options_movement") {
          if (isPointInsideBox(x, y, gameMenuUi.movementDecreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(0);
               decreaseMovementLevel();
               syncUiBounds();
               return true;
          }

          if (isPointInsideBox(x, y, gameMenuUi.movementIncreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(1);
               increaseMovementLevel();
               syncUiBounds();
               return true;
          }

          return true;
     }

     if (gameMenuView === "options_color") {
          if (isPointInsideBox(x, y, gameMenuUi.colorDecreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(0);
               decreaseColorLevel();
               syncUiBounds();
               return true;
          }

          if (isPointInsideBox(x, y, gameMenuUi.colorIncreaseButton)) {
               setOptionsSelectionRow(0);
               setOptionsSelectionCol(1);
               increaseColorLevel();
               syncUiBounds();
               return true;
          }

          return true;
     }

     if (isPointInsideBox(x, y, gameMenuUi.musicDecreaseButton)) {
          setOptionsSelectionRow(0);
          setOptionsSelectionCol(0);
          decreaseMusicLevel();
          syncUiBounds();
          return true;
     }

     if (isPointInsideBox(x, y, gameMenuUi.musicIncreaseButton)) {
          setOptionsSelectionRow(0);
          setOptionsSelectionCol(1);
          increaseMusicLevel();
          syncUiBounds();
          return true;
     }

     if (isPointInsideBox(x, y, gameMenuUi.soundEffectsDecreaseButton)) {
          setOptionsSelectionRow(1);
          setOptionsSelectionCol(0);
          decreaseSoundEffectsLevel();
          syncUiBounds();
          return true;
     }

     if (isPointInsideBox(x, y, gameMenuUi.soundEffectsIncreaseButton)) {
          setOptionsSelectionRow(1);
          setOptionsSelectionCol(1);
          increaseSoundEffectsLevel();
          syncUiBounds();
          return true;
     }

     return true;
}

function beginMenuScrollDrag(event, x, y) {
     if (!isScrollableMenuView()) {
          return false;
     }

     if (isPointInsideBox(x, y, gameMenuUi.backButton)) {
          return false;
     }

     beginGameMenuScrollDrag(event.pointerId, y);
     preventPointerDefault(event);
     return true;
}

function updateMenuScrollDrag(event, x, y) {
     if (!isScrollableMenuView()) {
          return false;
     }

     if (gameMenuScroll.pointerId !== event.pointerId) {
          return false;
     }

     updateGameMenuScrollDrag(y);
     preventPointerDefault(event);
     return true;
}

function endMenuScrollDrag(event) {
     if (!endGameMenuScrollDrag(event.pointerId)) {
          return false;
     }

     preventPointerDefault(event);
     return true;
}

function handleMenuPointerDown(event, x, y) {
     if (!gameMenuOpen) {
          return false;
     }

     if (handleTipsMenuPointerDown(x, y)) {
          return true;
     }

     if (beginMenuScrollDrag(event, x, y)) {
          return true;
     }

     if (handleOptionsPointerDown(x, y)) {
          return true;
     }

     if (handleOptionsDetailPointerDown(x, y)) {
          return true;
     }

     if (isPointInsideBox(x, y, gameMenuUi.backButton)) {
          closeMenuAndRefresh();
          return true;
     }

     return true;
}

function handleWheel(event) {
     if (!isScrollableMenuView()) {
          return;
     }

     addGameMenuScrollOffset(event.deltaY);
     preventPointerDefault(event);
}

function handlePauseButtonPointerDown(event, x, y) {
     const button = touchControls.pauseButton;

     if (!isPointInsideBox(x, y, button)) {
          return false;
     }

     setPauseButtonPressed(true);
     setPauseButtonPointerId(event.pointerId);
     preventPointerDefault(event);
     return true;
}

function handlePauseButtonPointerUp(event, x, y) {
     const button = touchControls.pauseButton;

     if (touchControls.pauseButton.pointerId !== event.pointerId) {
          return false;
     }

     const releasedInside = isPointInsideBox(x, y, button);

     releasePauseButton(event.pointerId);

     if (!releasedInside) {
          return true;
     }

     setGamePaused(!gamePaused);
     syncUiBounds();
     return true;
}

function beginPointerMove(event, x, y) {
     if (!isTouchClickMovementMode()) {
          return false;
     }

     setTouchMoveTarget(x, y, event.pointerId);
     preventPointerDefault(event);
     return true;
}

function updatePointerMove(event, x, y) {
     if (!isTouchClickMovementMode()) {
          return false;
     }

     if (touchControls.touchMoveTarget.pointerId !== event.pointerId) {
          return false;
     }

     setTouchMoveTarget(x, y, event.pointerId);
     preventPointerDefault(event);
     return true;
}

function beginJoystickMove(event, x, y) {
     if (!isJoystickMovementMode() || !isPointInsideCircle(x, y, touchControls.joystick)) {
          return false;
     }

     clearPointerMove();
     setJoystickFromPoint(x, y, event.pointerId);
     preventPointerDefault(event);
     return true;
}

function updateJoystickMove(event, x, y) {
     if (!isJoystickMovementMode() || touchControls.joystick.pointerId !== event.pointerId) {
          return false;
     }

     setJoystickFromPoint(x, y, event.pointerId);
     preventPointerDefault(event);
     return true;
}

function endJoystickMove(event) {
     if (touchControls.joystick.pointerId !== event.pointerId) {
          return false;
     }

     clearJoystickInput(event.pointerId);
     preventPointerDefault(event);
     return true;
}

function endPointerMove(event) {
     if (touchControls.touchMoveTarget.pointerId !== event.pointerId) {
          return false;
     }

     clearPointerMove(event.pointerId);
     preventPointerDefault(event);
     return true;
}

function activateWelcomeSelection() {
     const selection = isOverlayScreenActive() ? 0 : welcomeSelectionIndex;

     if (selection === 0) {
          isOverlayScreenActive() ? startNewGameRound() : dismissScreenWelcomeToStart();
     }

     if (selection === 1 && isScreenWelcomeActive()) {
          dismissScreenWelcomeToTipsMenu();
     }

     if (selection === 2 && isScreenWelcomeActive()) {
          dismissScreenWelcomeToOptionsMenu();
     }

     if (selection === 3 && isScreenWelcomeActive()) {
          returnToWebsite();
     }
}

function activatePausedSelection() {
     if (pausedSelectionIndex === 0) {
          setGamePaused(false);
          syncUiBounds();
     }

     if (pausedSelectionIndex === 1) {
          startNewGameRound();
     }

     if (pausedSelectionIndex === 2) {
          dismissPausedToTipsMenu();
     }

     if (pausedSelectionIndex === 3) {
          dismissPausedToOptionsMenu();
     }

     if (pausedSelectionIndex === 4) {
          returnToWebsite();
     }
}

function activateTipsSelection() {
     closeMenuAndRefresh();
}

function activateOptionsSelection() {
     if (optionsSelection.row >= getOptionsBackRowIndex()) {
          closeMenuAndRefresh();
          return;
     }

     const optionName =
          optionsSelection.row === 0 ? "blight" :
          optionsSelection.row === 1 && isJoystickEnabled() ? "movement" :
          "color";
     const direction = optionsSelection.col === 0 ? -1 : 1;

     activateOptionAdjustment(optionName, direction);
}

function activateOptionsDetailSelection() {
     if (gameMenuView === "options_difficulty") {
          if (optionsSelection.row === 1) {
               setGameMenuView("options");
               syncUiBounds();
               return;
          }

          const direction = optionsSelection.col === 0 ? -1 : 1;
          activateOptionAdjustment("blight", direction);
          return;
     }

     if (gameMenuView === "options_audio") {
          if (optionsSelection.row === 2) {
               setGameMenuView("options");
               syncUiBounds();
               return;
          }

          const optionName = optionsSelection.row === 0 ? "music" : "soundEffects";
          const direction = optionsSelection.col === 0 ? -1 : 1;
          activateOptionAdjustment(optionName, direction);
     }

     if (gameMenuView === "options_movement") {
          if (optionsSelection.row === 1) {
               setGameMenuView("options");
               syncUiBounds();
               return;
          }

          const direction = optionsSelection.col === 0 ? -1 : 1;
          activateOptionAdjustment("movement", direction);
     }

     if (gameMenuView === "options_color") {
          if (optionsSelection.row === 1) {
               setGameMenuView("options");
               syncUiBounds();
               return;
          }

          const direction = optionsSelection.col === 0 ? -1 : 1;
          activateOptionAdjustment("color", direction);
     }
}

function handleWelcomeNavigation(event) {
     if (!isScreenWelcomeActive() && !isOverlayScreenActive()) {
          return false;
     }

     if (isEscapeKey(event)) {
          event.preventDefault();
          return true;
     }

     if (isEnterKey(event)) {
          event.preventDefault();
          activateWelcomeSelection();
          return true;
     }

     if (isOverlayScreenActive()) {
          setWelcomeSelectionIndex(0);
          return true;
     }

     if (isPreviousMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setWelcomeSelectionIndex(clamp(welcomeSelectionIndex - 1, 0, 3));
          return true;
     }

     if (isNextMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setWelcomeSelectionIndex(clamp(welcomeSelectionIndex + 1, 0, 3));
          return true;
     }

     return false;
}

function handlePausedNavigation(event) {
     if (!isPausedOverlayActive()) {
          return false;
     }

     if (isEscapeKey(event)) {
          event.preventDefault();
          setGamePaused(false);
          syncUiBounds();
          return true;
     }

     if (isEnterKey(event)) {
          event.preventDefault();
          activatePausedSelection();
          return true;
     }

     if (isPreviousMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setPausedSelectionIndex(clamp(pausedSelectionIndex - 1, 0, 4));
          return true;
     }

     if (isNextMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setPausedSelectionIndex(clamp(pausedSelectionIndex + 1, 0, 4));
          return true;
     }

     return false;
}

function handleTipsNavigation(event) {
     if (!gameMenuOpen) {
          return false;
     }

     if (isEscapeKey(event)) {
          event.preventDefault();
          closeMenuAndRefresh();
          return true;
     }

     if (!isTipsListView()) {
          return false;
     }

     if (isEnterKey(event)) {
          event.preventDefault();
          activateTipsSelection();
          return true;
     }

     if (isPreviousMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setTipsSelectionIndex(0);
          return true;
     }

     if (isNextMenuKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setTipsSelectionIndex(0);
          return true;
     }

     return false;
}

function handleOptionsNavigation(event) {
     if (!gameMenuOpen || !isOptionsView()) {
          return false;
     }

     if (isEscapeKey(event)) {
          event.preventDefault();
          closeMenuAndRefresh();
          return true;
     }

     if (isEnterKey(event)) {
          event.preventDefault();
          activateOptionsSelection();
          return true;
     }

     if (isUpKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionRow(clamp(optionsSelection.row - 1, 0, getOptionsBackRowIndex()));
          setOptionsSelectionCol(0);
          return true;
     }

     if (isDownKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionRow(clamp(optionsSelection.row + 1, 0, getOptionsBackRowIndex()));
          setOptionsSelectionCol(0);
          return true;
     }

     if (optionsSelection.row < getOptionsBackRowIndex() && isLeftKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionCol(0);
          activateOptionsSelection();
          return true;
     }

     if (optionsSelection.row < getOptionsBackRowIndex() && isRightKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionCol(1);
          activateOptionsSelection();
          return true;
     }

     return false;
}

function handleOptionsDetailNavigation(event) {
     if (!gameMenuOpen || !isOptionsDetailView()) {
          return false;
     }

     if (isEscapeKey(event)) {
          event.preventDefault();
          setGameMenuView("options");
          syncUiBounds();
          return true;
     }

     if (isEnterKey(event)) {
          event.preventDefault();
          activateOptionsDetailSelection();
          return true;
     }

     const maxRow = gameMenuView === "options_audio" ? 2 : 1;

     if (isUpKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionRow(clamp(optionsSelection.row - 1, 0, maxRow));
          setOptionsSelectionCol(0);
          return true;
     }

     if (isDownKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionRow(clamp(optionsSelection.row + 1, 0, maxRow));
          setOptionsSelectionCol(0);
          return true;
     }

     if (optionsSelection.row < maxRow && isLeftKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionCol(0);
          activateOptionsDetailSelection();
          return true;
     }

     if (optionsSelection.row < maxRow && isRightKey(event)) {
          event.preventDefault();
          showMenuKeyboardFocusForDirectionalArrow(event);
          setOptionsSelectionCol(1);
          activateOptionsDetailSelection();
          return true;
     }

     return false;
}

function handleUiNavigationKeyDown(event) {
     if (!isUiNavigationActive()) {
          return false;
     }

     return (
          handleWelcomeNavigation(event) ||
          handlePausedNavigation(event) ||
          handleTipsNavigation(event) ||
          handleOptionsNavigation(event) ||
          handleOptionsDetailNavigation(event)
     );
}

function handleKeyDown(event) {
     if (handleUiNavigationKeyDown(event)) {
          return;
     }

     if (isJoystickMovementMode()) {
          clearPointerMove();
     }

     setStoredKeyState(event, true);

     if (isEscapeKey(event)) {
          if (gameMenuOpen) {
               dismissMenuBackToPreviousScreen();
               syncUiBounds();
               return;
          }

          if (isScreenWelcomeActive()) {
               return;
          }

          if (!gameStarted || gameOver || gameWon) {
               showScreenWelcome();
               syncUiBounds();
               return;
          }

          setGamePaused(!gamePaused);
          syncUiBounds();
          return;
     }

     if (isSpaceKey(event)) {
          if (!gameStarted || gameMenuOpen || gameOver || gameWon || isScreenWelcomeActive()) {
               return;
          }

          event.preventDefault();
          setGamePaused(!gamePaused);
          syncUiBounds();
          return;
     }

     if (event.key.toLowerCase() === "p" && gameStarted && !gameMenuOpen && !gameOver && !gameWon) {
          setGamePaused(!gamePaused);
          syncUiBounds();
     }
}

function handleKeyUp(event) {
     setStoredKeyState(event, false);
}

function handlePointerDown(event) {
     if (!miniGameCanvas || !isPrimaryPointer(event)) {
          return;
     }

     const { x, y } = getCanvasPoint(event);

     if (handleWelcomeOrResultPointerDown(x, y)) {
          return;
     }

     if (handlePausedOverlayPointerDown(x, y)) {
          return;
     }

     if (handleMenuPointerDown(event, x, y)) {
          return;
     }

     if (!gameStarted || gamePaused || gameOver || gameWon) {
          return;
     }

     if (handlePauseButtonPointerDown(event, x, y)) {
          return;
     }

     if (beginJoystickMove(event, x, y)) {
          return;
     }

     beginPointerMove(event, x, y);
}

function handlePointerMove(event) {
     if (!miniGameCanvas || !isPrimaryPointer(event)) {
          return;
     }

     const { x, y } = getCanvasPoint(event);

     if (updateMenuScrollDrag(event, x, y)) {
          return;
     }

     if (updateJoystickMove(event, x, y)) {
          return;
     }

     updatePointerMove(event, x, y);
}

function handlePointerUp(event) {
     if (!miniGameCanvas || !isPrimaryPointer(event)) {
          return;
     }

     const { x, y } = getCanvasPoint(event);

     if (endMenuScrollDrag(event)) {
          return;
     }

     if (handlePauseButtonPointerUp(event, x, y)) {
          return;
     }

     if (endJoystickMove(event)) {
          return;
     }

     endPointerMove(event);
}

function handlePointerCancel(event) {
     if (!isPrimaryPointer(event)) {
          return;
     }

     releasePauseButton(event.pointerId);
     endMenuScrollDrag(event);
     endJoystickMove(event);
     endPointerMove(event);
}
