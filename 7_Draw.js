// NOTE: 7_Draw
// Canvas rendering, HUD, menus, overlays, text layout, and shared draw helpers.
//
// Owned here:
// - full canvas draw entry
// - HUD drawing
// - welcome / paused / win / lose overlays
// - tips / options menus
// - shared canvas text / shape helpers
// - hover cursor behavior for clickable canvas UI
// - player / entity drawing
//
// NOT owned here:
// - main game loop / startup flow
// - raw shared runtime state storage
// - gameplay rules / progression ownership
// - entity update / collision logic
//
// Newbie note:
// - This file should answer "what does the player see?"
// - If code changes gameplay state or movement rules, it belongs in `8_Entities.js`.
// - If code only stores mutable shared values, it belongs in `3_State.js`.
// - If code maps CSS/theme values into a canvas theme object, it belongs in `9_Config.js`.

import {
     miniGameCtx,
     miniGameWidth,
     miniGameHeight,
     player,
     touchControls,
     sparkleScore,
     playerHealth,
     activeStatusUi,
     gameStarted,
     gamePaused,
     gameMenuOpen,
     gameMenuView,
     gameOver,
     gameWon,
     gameOverlayText,
     gameOverlaySubtext,
     gameMenuUi,
     musicLevel,
     soundEffectsLevel,
     harmfulLevel,
     movementLevel,
     colorLevel,
     screenActionUi,
     pausedActionUi,
     welcomeSelectionIndex,
     pausedSelectionIndex,
     tipsSelectionIndex,
     optionsSelection,
     isEffectActive,
     hoverCanvasX,
     hoverCanvasY,
     isCanvasPointerInside,
     hoverTrackingAttachedCanvas,
     setHoverCanvasPosition,
     setCanvasPointerInside,
     setHoverTrackingAttachedCanvas,
     setButtonBounds,
     isPointInsideRect,
     resetActionButtonBounds
} from "./3_State.js";

import {
     maxOptionLevelIndex,
     maxMovementOptionIndex,
     maxColorOptionIndex,
     maxVisibleHearts,
     movementOptionIndexes,
     getOptionLevelLabel,
     getMovementOptionLabel,
     getColorOptionLabel,
     getUnifiedButtonFont,
     getUnifiedButtonWidth,
     getUnifiedButtonHeight,
     setOptionRowBounds,
     getMenuScreenLayout,
     getMenuLayoutMetrics,
     parseRichTextSegments,
     playerGlowBlurFallback
} from "./4_Options.js";

import {
     getCanvasTheme,
     getCssColor
} from "./9_Config.js";

import {
     drawSparkles,
     drawHealthHazards,
     drawEffectPickups,
     drawCollisionBursts,
     playerFaces,
     playerTrail,
     getParticleFillColor,
     getParticleGlowColor,
     resetPlayerPosition,
     clampPlayerToCanvas,
     updatePlayer,
     updatePlayerFaceState,
     updatePlayerTrail,
     syncPlayerHealthState,
     refreshPlayerFaceFromHealth,
     applyTemporaryPlayerFace,
     triggerPlayerFacePop,
     updatePlayerSpeedFromHealth,
     applyPlayerLevelScale,
     getPlayerLevelScale
} from "./8_Entities.js";

import {
     getCurrentLevelMeterUnits,
     maxLevelProgressUnits,
     progressUnitsPerCircle,
     getCurrentScreenActionTexts,
     getCurrentPausedActionTexts,
     getWelcomeInstructionLines,
     getHowToPlayLines,
     getEffectLines,
     getDifficultyOptionLines,
     getAudioOptionLines,
     getMovementOptionLines,
     getColorOptionLines
} from "./5_GameRules.js";

import {
     isScreenWelcomeActive,
     isOverlayScreenActive,
     getCurrentScreenTitleLines,
     getGameWelcomeAlpha,
     getLevelPopupText,
     getLevelPopupAlpha,
     getGameOverlayAlpha
} from "./2_GameEngine.js";

const siteTheme = window.SiteTheme;

// Re-export moved player/entity helpers so existing imports from this file keep working.
export {
     playerFaces,
     resetPlayerPosition,
     clampPlayerToCanvas,
     updatePlayer,
     updatePlayerFaceState,
     updatePlayerTrail,
     syncPlayerHealthState,
     refreshPlayerFaceFromHealth,
     applyTemporaryPlayerFace,
     triggerPlayerFacePop,
     updatePlayerSpeedFromHealth,
     applyPlayerLevelScale,
     getPlayerLevelScale
};

// ==================================================
// NOTE: TITLE SIZE HELPERS
// ==================================================

export function updateWelcomeTitleColors() {
}

export function getWelcomeCurrentColors() {
     return [];
}

export function updateTipsTitleColors() {
}

export function getWelcomeMarqueeFontSize(theme, titleLines = getCurrentScreenTitleLines(), config = theme.screens.welcome) {
     const titleStyle = getTextStyle(theme, config.textStyle || "marquee");

     if (!miniGameCtx) {
          return titleStyle.fontSize;
     }

     const sidePadding = titleStyle.sidePadding;
     const minSize = titleStyle.minSize;
     const shrinkStep = titleStyle.shrinkStep;
     const letterSpacing = titleStyle.letterSpacing || 0;
     let fontSize = titleStyle.fontSize;

     miniGameCtx.save();

     while (fontSize > minSize) {
          miniGameCtx.font = getTextFont(theme, config.textStyle || "marquee", 400, null, fontSize);

          const lineWidths = titleLines.map((line) => {
               let width = 0;

               for (let i = 0; i < line.length; i += 1) {
                    width += miniGameCtx.measureText(line[i]).width;
               }

               return width + (letterSpacing * Math.max(0, line.length - 1));
          });

          const widestLine = Math.max(...lineWidths);

          if (widestLine <= (miniGameWidth - (sidePadding * 2))) {
               break;
          }

          fontSize -= shrinkStep;
     }

     miniGameCtx.restore();

     return fontSize;
}

// ==================================================
// UI BOUNDS / HOVER
// ==================================================

function getCanvasRelativePointerPosition(event, canvas) {
     const rect = canvas.getBoundingClientRect();

     if (!rect.width || !rect.height) {
          return { x: 0, y: 0 };
     }

     return {
          x: ((event.clientX - rect.left) / rect.width) * miniGameWidth,
          y: ((event.clientY - rect.top) / rect.height) * miniGameHeight
     };
}

function getHoverableCanvasButtons() {
     const buttons = [];

     if (!gamePaused && !gameMenuOpen && !gameOver && !gameWon && gameStarted) {
          buttons.push(touchControls.pauseButton);
     }

     if (isScreenWelcomeActive() || isOverlayScreenActive()) {
          buttons.push(
               screenActionUi.startButton,
               screenActionUi.tipsButton,
               screenActionUi.menuButton,
               screenActionUi.returnButton
          );
     }

     if (gamePaused && !gameMenuOpen && !gameOver && !gameWon) {
          buttons.push(
               pausedActionUi.resumeButton,
               pausedActionUi.tipsButton,
               pausedActionUi.menuButton,
               pausedActionUi.returnButton
          );
     }

     if (gameMenuOpen) {
          buttons.push(gameMenuUi.backButton);

          if (gameMenuView === "tips") {
               buttons.push(
                    gameMenuUi.tipsHowToPlayButton,
                    gameMenuUi.tipsEffectsButton
               );
          }

          if (gameMenuView === "options") {
               buttons.push(
                    gameMenuUi.optionsDifficultyButton,
                    gameMenuUi.optionsMovementButton,
                    gameMenuUi.optionsColorButton
               );
          }

          if (gameMenuView === "options_difficulty") {
               buttons.push(
                    gameMenuUi.harmfulDecreaseButton,
                    gameMenuUi.harmfulIncreaseButton
               );
          }

          if (gameMenuView === "options_audio") {
               buttons.push(
                    gameMenuUi.musicDecreaseButton,
                    gameMenuUi.musicIncreaseButton,
                    gameMenuUi.soundEffectsDecreaseButton,
                    gameMenuUi.soundEffectsIncreaseButton
               );
          }

          if (gameMenuView === "options_movement") {
               buttons.push(
                    gameMenuUi.movementDecreaseButton,
                    gameMenuUi.movementIncreaseButton
               );
          }

          if (gameMenuView === "options_color") {
               buttons.push(
                    gameMenuUi.colorDecreaseButton,
                    gameMenuUi.colorIncreaseButton
               );
          }
     }

     return buttons.filter((button) => button && button.width > 0 && button.height > 0);
}

function updateCanvasCursor() {
     const canvas = miniGameCtx?.canvas;

     if (!canvas) {
          return;
     }

     if (!isCanvasPointerInside) {
          canvas.style.cursor = "default";
          return;
     }

     const isHoveringClickable = getHoverableCanvasButtons().some((button) =>
          isPointInsideRect(hoverCanvasX, hoverCanvasY, button)
     );

     canvas.style.cursor = isHoveringClickable ? "pointer" : "default";
}

function ensureCanvasHoverTracking() {
     const canvas = miniGameCtx?.canvas;

     if (!canvas || hoverTrackingAttachedCanvas === canvas) {
          return;
     }

     canvas.addEventListener("pointermove", (event) => {
          setCanvasPointerInside(true);

          const point = getCanvasRelativePointerPosition(event, canvas);
          setHoverCanvasPosition(point.x, point.y);

          updateCanvasCursor();
     });

     canvas.addEventListener("pointerleave", () => {
          setCanvasPointerInside(false);
          updateCanvasCursor();
     });

     setHoverTrackingAttachedCanvas(canvas);
}

function updateMenuUiBounds(theme = getCanvasTheme()) {
     const panelX = 0;
     const panelWidth = miniGameWidth;

     gameMenuUi.panel.x = 0;
     gameMenuUi.panel.y = 0;
     gameMenuUi.panel.width = miniGameWidth;
     gameMenuUi.panel.height = miniGameHeight;

     const layout = getMenuLayoutMetrics(theme, panelX, panelWidth);

     setButtonBounds(
          gameMenuUi.backButton,
          layout.backButtonX,
          layout.backButtonY,
          layout.backButtonWidth,
          layout.buttonHeight
     );

     if (gameMenuView === "tips") {
          const menuButtons = [
               { button: gameMenuUi.tipsHowToPlayButton, label: "GUIDE" },
               { button: gameMenuUi.tipsEffectsButton, label: "EFFECTS" }
          ];

          menuButtons.forEach((item, index) => {
               const width = getUnifiedButtonWidth(theme, item.label);
               const y = layout.contentTopY + (index * (layout.buttonHeight + layout.rowGap));
               const x = (miniGameWidth - width) / 2;

               setButtonBounds(item.button, x, y, width, layout.buttonHeight);
          });

          return;
     }

     if (
          gameMenuView === "tips_how_to_play" ||
          gameMenuView === "tips_effects"
     ) {
          return;
     }

     if (gameMenuView === "options") {
          const optionButtons = [
               { button: gameMenuUi.optionsDifficultyButton, label: "DIFFICULTY" },
               { button: gameMenuUi.optionsMovementButton, label: "MOVEMENT" },
               { button: gameMenuUi.optionsColorButton, label: "COLOR" }
          ];

          setButtonBounds(gameMenuUi.optionsAudioButton, 0, 0, 0, 0);

          optionButtons.forEach((item, index) => {
               const width = getUnifiedButtonWidth(theme, item.label);
               const y = layout.contentTopY + (index * (layout.buttonHeight + layout.rowGap));
               const x = (miniGameWidth - width) / 2;

               setButtonBounds(item.button, x, y, width, layout.buttonHeight);
          });

          return;
     }

     if (
          gameMenuView !== "options_difficulty" &&
          gameMenuView !== "options_audio" &&
          gameMenuView !== "options_movement" &&
          gameMenuView !== "options_color"
     ) {
          return;
     }

     if (gameMenuView === "options_difficulty") {
          setOptionRowBounds(
               gameMenuUi.harmfulRow,
               gameMenuUi.harmfulDecreaseButton,
               gameMenuUi.harmfulIncreaseButton,
               layout.buttonX,
               layout.contentTopY,
               layout.buttonWidth,
               layout.buttonHeight
          );

          return;
     }

     if (gameMenuView === "options_movement") {
          setOptionRowBounds(
               gameMenuUi.movementRow,
               gameMenuUi.movementDecreaseButton,
               gameMenuUi.movementIncreaseButton,
               layout.buttonX,
               layout.contentTopY,
               layout.buttonWidth,
               layout.buttonHeight
          );

          return;
     }

     if (gameMenuView === "options_color") {
          setOptionRowBounds(
               gameMenuUi.colorRow,
               gameMenuUi.colorDecreaseButton,
               gameMenuUi.colorIncreaseButton,
               layout.buttonX,
               layout.contentTopY,
               layout.buttonWidth,
               layout.buttonHeight
          );

          return;
     }

     const audioRows = [
          {
               row: gameMenuUi.musicRow,
               decreaseButton: gameMenuUi.musicDecreaseButton,
               increaseButton: gameMenuUi.musicIncreaseButton
          },
          {
               row: gameMenuUi.soundEffectsRow,
               decreaseButton: gameMenuUi.soundEffectsDecreaseButton,
               increaseButton: gameMenuUi.soundEffectsIncreaseButton
          }
     ];

     audioRows.forEach((item, index) => {
          const y = layout.contentTopY + (index * (layout.buttonHeight + layout.rowGap));

          setOptionRowBounds(
               item.row,
               item.decreaseButton,
               item.increaseButton,
               layout.buttonX,
               y,
               layout.buttonWidth,
               layout.buttonHeight
          );
     });
}

function updatePauseButtonBounds(theme = getCanvasTheme()) {
     const button = touchControls.pauseButton;
     const buttonStyle = getTextStyle(theme, "pauseButton");
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const buttonSize = buttonStyle.buttonSize || (buttonStyle.fontSize + canvasSpacing.uiPadding);

     button.width = buttonSize;
     button.height = buttonSize;
     button.x = (miniGameWidth - button.width) / 2;
     button.y = canvasSpacing.uiPadding;
}

function updateJoystickBounds(theme = getCanvasTheme()) {
     const joystick = touchControls.joystick;
     const joystickStyle = getTextStyle(theme, "joystick");
     const isRightSide = movementLevel === movementOptionIndexes.joystickRight;
     const edgeGap = joystickStyle.edgeGap || 0;
     const canvasMin = Math.min(miniGameWidth, miniGameHeight);
     const baseRadius = Math.min(joystickStyle.baseRadius, canvasMin * 0.24);
     const knobRadius = Math.min(joystickStyle.knobRadius, baseRadius * 0.55);

     joystick.baseRadius = baseRadius;
     joystick.knobRadius = knobRadius;
     joystick.maxDistance = Math.max(1, baseRadius - knobRadius);
     joystick.deadZone = joystickStyle.deadZone;
     joystick.x = isRightSide ?
          miniGameWidth - baseRadius - edgeGap :
          baseRadius + edgeGap;
     joystick.y = miniGameHeight - baseRadius - edgeGap - (joystickStyle.yOffset || 0);
}

export function syncUiBounds() {
     const theme = getCanvasTheme();

     updatePauseButtonBounds(theme);
     updateJoystickBounds(theme);
     updateMenuUiBounds(theme);
     updateCanvasCursor();
}

export function updatePauseButtonState() {
     if (gameMenuOpen || gameOver || gameWon) {
          touchControls.pauseButton.isPressed = false;
          touchControls.pauseButton.pointerId = null;
     }
}

export function updateScreenTitleColorState() {
     return;
}

// ==================================================
// NOTE: SHARED DRAW HELPERS
// ==================================================

export function drawRoundedRect(x, y, width, height, radius) {
     if (!miniGameCtx) {
          return;
     }

     const r = Math.min(radius, width / 2, height / 2);

     miniGameCtx.beginPath();
     miniGameCtx.moveTo(x + r, y);
     miniGameCtx.lineTo(x + width - r, y);
     miniGameCtx.quadraticCurveTo(x + width, y, x + width, y + r);
     miniGameCtx.lineTo(x + width, y + height - r);
     miniGameCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
     miniGameCtx.lineTo(x + r, y + height);
     miniGameCtx.quadraticCurveTo(x, y + height, x, y + height - r);
     miniGameCtx.lineTo(x, y + r);
     miniGameCtx.quadraticCurveTo(x, y, x + r, y);
     miniGameCtx.closePath();
}

export function drawPanelBox(x, y, width, height, theme, lineWidth = null) {
     if (!miniGameCtx) {
          return;
     }

     const { colors, glow, sizes } = theme;
     const resolvedLineWidth = lineWidth ?? sizes.borderWidth;
     const outerWidth = sizes.borderWidthFocus || sizes.borderWidth || 1;
     const insetWidth = sizes.panelBorderWidth || outerWidth;

     miniGameCtx.shadowColor = getCanvasGlowColor(colors.controlGlow);
     miniGameCtx.shadowBlur = glow.uiStrongGlow;

     miniGameCtx.fillStyle = colors.menuPanelFill;
     miniGameCtx.fillRect(x, y, width, height);

     miniGameCtx.shadowBlur = 0;
     miniGameCtx.lineJoin = "miter";
     miniGameCtx.lineCap = "butt";

     miniGameCtx.strokeStyle = colors.fontColor;
     miniGameCtx.lineWidth = outerWidth;
     miniGameCtx.strokeRect(x, y, width, height);

     miniGameCtx.strokeStyle = colors.controlFill;
     miniGameCtx.lineWidth = insetWidth;
     miniGameCtx.strokeRect(
          x + (insetWidth / 2),
          y + (insetWidth / 2),
          width - insetWidth,
          height - insetWidth
     );

     miniGameCtx.strokeStyle = colors.outlineStrong;
     miniGameCtx.lineWidth = resolvedLineWidth;
     miniGameCtx.strokeRect(
          x + (resolvedLineWidth / 2),
          y + (resolvedLineWidth / 2),
          width - resolvedLineWidth,
          height - resolvedLineWidth
     );
}

function getTrailGlowBlur() {
     return siteTheme?.getGlowSettings?.().gameParticleBlur ?? playerGlowBlurFallback;
}

function drawGlowingCanvasText(ctx, text, x, y, color, font, align = "left", baseline = "middle", theme = null, shouldGlow = true) {
     if (!ctx) {
          return;
     }

     const glow = theme?.glow || {};
     const blur1 = glow.uiTitleGlow1 ?? 8;
     const blur2 = glow.uiTitleGlow2 ?? 16;
     const blur3 = glow.uiTitleGlow3 ?? 26;

     ctx.save();
     ctx.font = font;
     ctx.textAlign = align;
     ctx.textBaseline = baseline;
     ctx.fillStyle = color;
     ctx.shadowColor = getCanvasGlowColor(color);

     if (!shouldGlow) {
          ctx.shadowBlur = 0;
          ctx.fillText(text, x, y);
          ctx.restore();
          return;
     }

     ctx.shadowBlur = blur1;
     ctx.fillText(text, x, y);

     ctx.shadowBlur = blur2;
     ctx.fillText(text, x, y);

     ctx.shadowBlur = blur3;
     ctx.fillText(text, x, y);

     ctx.restore();
}

function getTextStyle(theme, styleName) {
     return theme.text?.[styleName] || {};
}

function getTextFont(theme, styleName, fontWeight = 400, fontOverride = null, fontSizeOverride = null) {
     const style = getTextStyle(theme, styleName);
     const fontKey = fontOverride || style.font || "body";
     const fontFamily = theme.fonts[fontKey] || fontKey;
     const fontSize = fontSizeOverride ?? style.fontSize ?? theme.sizes.uiFontSm;

     return `${fontWeight} ${fontSize}px ${fontFamily}`;
}

function getTextColor(theme, styleName, letterIndex = 0) {
     const style = getTextStyle(theme, styleName);

     if (style.rainbow) {
          return getRainbowTextColor(theme, style, letterIndex);
     }

     return style.color || theme.colors.fontColor;
}

function getRichTextIcon(theme, tokenName) {
     return theme.text?.friendsEnemiesIcons?.[tokenName] || null;
}

function getRainbowTextColor(theme, style, letterIndex) {
     const palette = getColorModeTextPalette(theme, style);

     if (!palette.length) {
          return style.color || theme.colors.titleText || theme.colors.fontColor;
     }

     const cycleMs = theme.animation?.titleRainbowCycleMs || 120;
     const cycleOffset = Math.floor(performance.now() / cycleMs);

     return palette[(letterIndex + cycleOffset) % palette.length];
}

function getColorModeTextPalette(theme, style) {
     if (colorLevel === 0) {
          return [
               getCssColor("--tertiary-01", "#f00"),
               getCssColor("--tertiary-08", "#08f"),
               getCssColor("--tertiary-07", "#0f0")
          ];
     }

     if (colorLevel === 2) {
          return Array.from({ length: 12 }, (_item, index) => {
               const variableName = `--mocha-${String(index + 1).padStart(2, "0")}`;
               return getCssColor(variableName, "#f5c2e7");
          });
     }

     if (colorLevel === 3) {
          return [
               getCssColor("--color-gray2", "#666"),
               getCssColor("--color-gray3", "#999"),
               getCssColor("--color-white", "#fff")
          ];
     }

     return style.palette || theme.colors.titleRainbow || [];
}

function drawStyledCanvasText(
     ctx,
     text,
     x,
     y,
     styleName,
     theme,
     options = {}
) {
     if (!ctx) {
          return;
     }

     const style = getTextStyle(theme, styleName);
     const fontWeight = options.fontWeight ?? 400;
     const font = options.font || getTextFont(theme, styleName, fontWeight);
     const align = options.align || "left";
     const baseline = options.baseline || "middle";
     const shouldGlow = options.glow ?? style.glow;
     const fallbackColor = options.color || style.color || theme.colors.fontColor;
     const letterSpacing = style.letterSpacing ?? 0;

     if (!style.rainbow) {
          drawGlowingCanvasText(
               ctx,
               text,
               x,
               y,
               fallbackColor,
               font,
               align,
               baseline,
               theme,
               shouldGlow
          );
          return;
     }

     const letters = Array.from(text);
     const letterWidths = [];

     ctx.save();
     ctx.font = font;

     letters.forEach((letter) => {
          letterWidths.push(ctx.measureText(letter).width);
     });

     ctx.restore();

     const totalWidth =
          letterWidths.reduce((sum, width) => sum + width, 0) +
          (letterSpacing * Math.max(0, letters.length - 1));

     let letterX = x;

     if (align === "center") {
          letterX = x - (totalWidth / 2);
     } else if (align === "right") {
          letterX = x - totalWidth;
     }

     letters.forEach((letter, index) => {
          drawGlowingCanvasText(
               ctx,
               letter,
               letterX,
               y,
               getTextColor(theme, styleName, index),
               font,
               "left",
               baseline,
               theme,
               shouldGlow
          );

          letterX += letterWidths[index] + letterSpacing;
     });
}

export function drawMenuScreenTitle(title, theme, centerX, y) {
     if (!miniGameCtx) {
          return;
     }

     const titleStyle = getTextStyle(theme, "title");
     const titleFontSize = titleStyle.fontSize;
     const letterSpacing = titleStyle.letterSpacing;

     miniGameCtx.save();
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     miniGameCtx.font = getTextFont(theme, "title", 400);

     const letterWidths = [];

     for (let i = 0; i < title.length; i += 1) {
          letterWidths.push(miniGameCtx.measureText(title[i]).width);
     }

     const totalWidth =
          letterWidths.reduce((sum, width) => sum + width, 0) +
          (letterSpacing * Math.max(0, title.length - 1));

     let titleX = centerX - (totalWidth / 2);

     for (let i = 0; i < title.length; i += 1) {
          const letter = title[i];
          drawGlowingCanvasText(
               miniGameCtx,
               letter,
               titleX,
               y,
               getTextColor(theme, "title", i),
               getTextFont(theme, "title", 400),
               "left",
               "top",
               theme,
               titleStyle.glow
          );

          titleX += letterWidths[i] + letterSpacing;
     }

     miniGameCtx.restore();
}

function getShortOptionLevelLabel(levelIndex) {
     return getOptionLevelLabel(levelIndex).toUpperCase();
}

function getShortMovementOptionLabel(levelIndex) {
     const labels = ["TOUCHCLICK/WASDARROWS", "JOYSTICKLEFT", "JOYSTICK RIGHT"];

     return labels[levelIndex] || getMovementOptionLabel(levelIndex).toUpperCase();
}

function getShortColorOptionLabel(levelIndex) {
     const labels = ["HIGH CONTRAST", "VIBRANT", "PASTEL", "Black & White"];

     return labels[levelIndex] || getColorOptionLabel(levelIndex).toUpperCase();
}

function getCanvasColorModeFilter() {
     return "none";
}

function applyCanvasColorModeFilter() {
     if (miniGameCtx) {
          miniGameCtx.filter = getCanvasColorModeFilter();
     }
}

function resetCanvasColorModeFilter() {
     if (miniGameCtx) {
          miniGameCtx.filter = "none";
     }
}

function getCanvasGlowColor(color) {
     return colorLevel === 3
          ? getCssColor("--color-white", "#ffffff")
          : color;
}

function drawUnifiedTextButton(button, label, theme, isFocused = false, fontWeight = 400, fontSize = null) {
     if (!miniGameCtx || !button) {
          return;
     }

     const { colors } = theme;
     const buttonStyle = getTextStyle(theme, "buttonsOptions");
     const resolvedFontSize = fontSize ?? buttonStyle.fontSize;
     const centerX = button.x + (button.width / 2);
     const centerY = button.y + (button.height / 2);

     miniGameCtx.save();
     drawPanelBox(button.x, button.y, button.width, button.height, theme);

     if (isFocused) {
          miniGameCtx.strokeStyle = colors.fontColor;
          miniGameCtx.lineWidth = theme.sizes.borderWidthFocus;
          miniGameCtx.strokeRect(
               button.x + (theme.sizes.borderWidthFocus / 2),
               button.y + (theme.sizes.borderWidthFocus / 2),
               button.width - theme.sizes.borderWidthFocus,
               button.height - theme.sizes.borderWidthFocus
          );
     }

     miniGameCtx.restore();

     drawGlowingCanvasText(
          miniGameCtx,
          label,
          centerX,
          centerY + 1,
          buttonStyle.color || colors.controlText,
          getTextFont(theme, "buttonsOptions", fontWeight, null, resolvedFontSize),
          "center",
          "middle",
          theme,
          isFocused && buttonStyle.glow
     );
}

export function drawMenuButton(button, label, theme, isFocused = false) {
     drawUnifiedTextButton(button, label, theme, isFocused, 400, getTextStyle(theme, "buttonsOptions").fontSize);
}

export function drawMenuBackButton(button, theme, isFocused = false) {
     drawUnifiedTextButton(button, "PREVIOUS", theme, isFocused, 700, getTextStyle(theme, "buttonsOptions").fontSize);
}

export function drawOptionStepper(
     row,
     decreaseButton,
     increaseButton,
     label,
     value,
     levelIndex,
     theme,
     isRowFocused = false,
     focusedSide = -1,
     maxLevelIndex = maxOptionLevelIndex
) {
     if (!miniGameCtx || !row || !decreaseButton || !increaseButton) {
          return;
     }

     const { colors } = theme;
     const optionsStyle = getTextStyle(theme, "buttonsOptions");
     const centerY = row.y + (row.height / 2);
     const canDecrease = levelIndex > 0;
     const canIncrease = levelIndex < maxLevelIndex;
     const optionTextColor = optionsStyle.color || colors.controlText;
     const activeArrowColor = getCssColor("--color-white", "#ffffff");
     const arrowScale = optionsStyle.arrowScale || 1;
     const arrowFont = getTextFont(theme, "buttonsOptions", 700, null, optionsStyle.fontSize * arrowScale);

     function drawStepperArrow(button, rotation, isEnabled, isFocused) {
          miniGameCtx.save();
          miniGameCtx.globalAlpha = isEnabled ? 1 : 0.28;
          miniGameCtx.translate(button.x + (button.width / 2), centerY + 1);
          miniGameCtx.rotate(rotation);

          drawGlowingCanvasText(
               miniGameCtx,
               "\u21E7",
               0,
               0,
               isEnabled ? activeArrowColor : optionTextColor,
               arrowFont,
               "center",
               "middle",
               theme,
               isEnabled && isFocused && optionsStyle.glow
          );

          miniGameCtx.restore();
     }

     miniGameCtx.save();
     drawPanelBox(row.x, row.y, row.width, row.height, theme);

     if (isRowFocused) {
          miniGameCtx.strokeStyle = colors.fontColor;
          miniGameCtx.lineWidth = theme.sizes.borderWidthFocus;
          miniGameCtx.strokeRect(
               row.x + (theme.sizes.borderWidthFocus / 2),
               row.y + (theme.sizes.borderWidthFocus / 2),
               row.width - theme.sizes.borderWidthFocus,
               row.height - theme.sizes.borderWidthFocus
          );
     }

     miniGameCtx.restore();

     drawStepperArrow(decreaseButton, -Math.PI / 2, canDecrease, focusedSide === 0);

     drawGlowingCanvasText(
          miniGameCtx,
          value,
          row.x + (row.width / 2),
          centerY + 1,
          optionTextColor,
          getTextFont(theme, "buttonsOptions", 400),
          "center",
          "middle",
          theme,
          isRowFocused && optionsStyle.glow
     );

     drawStepperArrow(increaseButton, Math.PI / 2, canIncrease, focusedSide === 1);
}

export function drawControlButton(button, isPressed, theme) {
     if (!miniGameCtx || !button) {
          return;
     }

     const { colors, glow, sizes } = theme;
     const centerX = button.x + (button.width / 2);
     const centerY = button.y + (button.height / 2);
     const radius = button.width / 3;

     miniGameCtx.save();
     miniGameCtx.shadowColor = getCanvasGlowColor(colors.touchGlow);
     miniGameCtx.shadowBlur = isPressed ? glow.uiStrongGlow : glow.uiMediumGlow;

     miniGameCtx.beginPath();
     miniGameCtx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);

     miniGameCtx.fillStyle = colors.touchFill;
     miniGameCtx.fill();

     miniGameCtx.lineWidth = sizes.touchBorderWidth;
     miniGameCtx.strokeStyle = colors.touchStroke;
     miniGameCtx.stroke();

     miniGameCtx.restore();
}

// ==================================================
// PLAYER DRAW
// ==================================================

export function drawPlayerTrail() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getTrailGlowBlur();

     for (let i = playerTrail.length - 1; i >= 0; i -= 1) {
          const trail = playerTrail[i];
          const lifeRatio = trail.life / trail.maxLife;
          const trailColor = getParticleFillColor(trail);
          const trailGlowColor = getParticleGlowColor(trailColor);

          miniGameCtx.save();
          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.75);
          miniGameCtx.strokeStyle = trailColor;
          miniGameCtx.shadowColor = getCanvasGlowColor(trailGlowColor);
          miniGameCtx.shadowBlur = glowBlur;
          miniGameCtx.lineWidth = Math.max(1, trail.width * lifeRatio);
          miniGameCtx.lineCap = "round";

          miniGameCtx.beginPath();
          miniGameCtx.moveTo(trail.fromX, trail.fromY);
          miniGameCtx.lineTo(trail.toX, trail.toY);
          miniGameCtx.stroke();

          miniGameCtx.restore();
     }
}

export function drawPlayer() {
     if (!miniGameCtx) {
          return;
     }

     miniGameCtx.save();

     const drawSize = player.size * (player.hitScale || 1);

     miniGameCtx.globalAlpha = 1;
     miniGameCtx.font = `${drawSize}px Arial, Helvetica, sans-serif`;
     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";
     miniGameCtx.fillStyle = "#ffffff";
     miniGameCtx.shadowColor = "transparent";
     miniGameCtx.shadowBlur = 0;

     let playerYOffset = 0;

     if (player.char === playerFaces.smile) {
          playerYOffset = 3;
     }

     miniGameCtx.fillText(player.char, player.x, player.y + playerYOffset);
     miniGameCtx.restore();
}

// ==================================================
// RICH TEXT DRAW
// ==================================================

export function drawWrappedRichText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
     const font = options.font || ctx.font;
     const iconBaseSize = options.iconBaseSize || options.fontSize || 10;
     const iconFontFamily = options.iconFontFamily || options.fontFamily || "sans-serif";
     const iconYOffset = options.iconYOffset || 0;
     const segments = parseRichTextSegments(text);
     const tokens = [];

     segments.forEach((segment) => {
          if (segment.type === "icon") {
               tokens.push(segment);
               return;
          }

          segment.value.split(/(\s+)/).forEach((part) => {
               if (part) {
                    tokens.push({
                         type: "text",
                         value: part
                    });
               }
          });
     });

     function getTokenFont(token) {
          if (token.type !== "icon") {
               return font;
          }

          const icon = getRichTextIcon(options.theme, token.value);

          if (!icon) {
               return font;
          }

          return `400 ${iconBaseSize * icon.scale}px ${iconFontFamily}`;
     }

     function getTokenText(token) {
          if (token.type !== "icon") {
               return token.value;
          }

          const icon = getRichTextIcon(options.theme, token.value);

          return icon ? icon.particle : token.value;
     }

     function getTokenXOffset(token) {
          if (token.type !== "icon") {
               return 0;
          }

          const icon = getRichTextIcon(options.theme, token.value);

          if (!icon) {
               return 0;
          }

          return icon.xOffset || 0;
     }

     function getTokenYOffset(token) {
          if (token.type !== "icon") {
               return 0;
          }

          const icon = getRichTextIcon(options.theme, token.value);

          if (!icon) {
               return 0;
          }

          const scaleOffset = -((iconBaseSize * icon.scale - iconBaseSize) * 0.28);
          const customOffset = icon.yOffset || 0;

          return iconYOffset + scaleOffset + customOffset;
     }

     const lines = [];
     let currentLine = [];
     let currentWidth = 0;

     tokens.forEach((token) => {
          ctx.font = getTokenFont(token);

          const tokenText = getTokenText(token);
          const tokenWidth = ctx.measureText(tokenText).width;
          const shouldWrap = currentWidth + tokenWidth > maxWidth && currentLine.length > 0;

          if (shouldWrap) {
               lines.push(currentLine);
               currentLine = [];
               currentWidth = 0;
          }

          currentLine.push(token);
          currentWidth += tokenWidth;
     });

     if (currentLine.length) {
          lines.push(currentLine);
     }

     lines.forEach((lineTokens, lineIndex) => {
          let currentX = x;
          const currentY = y + (lineIndex * lineHeight);

          lineTokens.forEach((token) => {
               ctx.font = getTokenFont(token);

               const tokenText = getTokenText(token);
               const tokenXOffset = getTokenXOffset(token);
               const tokenYOffset = getTokenYOffset(token);

               ctx.fillText(tokenText, currentX + tokenXOffset, currentY + tokenYOffset);
               currentX += ctx.measureText(tokenText).width;
          });
     });

     ctx.font = font;

     return lines.length;
}

export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
     return drawWrappedRichText(ctx, text, x, y, maxWidth, lineHeight);
}

// ====================================================================================================
// NOTE: BACKGROUND / HUD / TOUCH
// ====================================================================================================

export function drawMiniGameBackground() {
     if (!miniGameCtx) {
          return;
     }

     miniGameCtx.clearRect(0, 0, miniGameWidth, miniGameHeight);
     miniGameCtx.fillStyle = getCssColor("--black-50", "rgba(0, 0, 0, 0.5)");
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);
}

function getStatusSecondsRemaining() {
     if (activeStatusUi.timer <= 0) {
          return "";
     }

     return `${Math.ceil(activeStatusUi.timer / 60)}s`;
}

function getCircleMeterGlyph(circleMeterStyle, filledUnits) {
     if (filledUnits >= progressUnitsPerCircle) {
          return circleMeterStyle.fullChar;
     }

     if (filledUnits > 0) {
          return circleMeterStyle.halfChar;
     }

     return circleMeterStyle.emptyChar;
}

function getCircleMeterInkMetrics(ctx, circleMeterStyle) {
     const metrics = ctx.measureText(circleMeterStyle.fullChar);
     const top = Number.isFinite(metrics.actualBoundingBoxAscent)
          ? -metrics.actualBoundingBoxAscent
          : 0;
     const bottom = Number.isFinite(metrics.actualBoundingBoxDescent)
          ? metrics.actualBoundingBoxDescent
          : circleMeterStyle.fontSize;

     return {
          left: metrics.actualBoundingBoxLeft || 0,
          right: metrics.actualBoundingBoxRight || 0,
          top,
          bottom: bottom > top ? bottom : circleMeterStyle.fontSize
     };
}

export function drawScore(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors, glow } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const circleMeterStyle = getTextStyle(theme, "circleMeters");
     const levelStatusStyle = getTextStyle(theme, "levelStatus");
     const scoreReadyStyle = getTextStyle(theme, "scoreReady");
     const scoreIconStyle = getTextStyle(theme, "scoreIcon");
     const levelText = "LEVELS";
     const sparkleText = String(sparkleScore).padStart(3, "0");
     const levelMeterUnits = getCurrentLevelMeterUnits();

     miniGameCtx.save();
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     miniGameCtx.fillStyle = circleMeterStyle.color || colors.meterFull;
     miniGameCtx.shadowColor = getCanvasGlowColor(circleMeterStyle.color || colors.meterGlow);
     miniGameCtx.shadowBlur = circleMeterStyle.glow ? glow.uiSoftGlow : 0;
     miniGameCtx.font = getTextFont(theme, "circleMeters", 400);

     const circleAdvance =
          (circleMeterStyle.fontSize * circleMeterStyle.advanceScale) +
          (circleMeterStyle.letterSpacing || 0);
     const circleSlots = maxLevelProgressUnits / progressUnitsPerCircle;
     const leftEdgeX = canvasSpacing.uiPadding;
     const circleInkMetrics = getCircleMeterInkMetrics(miniGameCtx, circleMeterStyle);
     const levelY = canvasSpacing.uiPadding;
     drawStyledCanvasText(
          miniGameCtx,
          levelText,
          leftEdgeX,
          levelY,
          "levelStatus",
          theme,
          {
               color: levelStatusStyle.color || colors.meterFull,
               align: "left",
               baseline: "top"
          }
     );

     const meterY = levelY + levelStatusStyle.fontSize + canvasSpacing.circleTitleGap - circleInkMetrics.top;
     let currentX = leftEdgeX + circleInkMetrics.left;

     for (let i = 0; i < circleSlots; i += 1) {
          const slotUnits = Math.max(0, Math.min(progressUnitsPerCircle, levelMeterUnits - (i * progressUnitsPerCircle)));

          miniGameCtx.fillText(getCircleMeterGlyph(circleMeterStyle, slotUnits), currentX, meterY);
          currentX += circleAdvance;
     }

     const sparkleY = meterY + circleInkMetrics.bottom + canvasSpacing.uiRowGap;
     const scoreIconX = leftEdgeX + scoreIconStyle.xOffset;
     const scoreIconY = sparkleY + scoreIconStyle.yOffset;

     miniGameCtx.font = getTextFont(theme, "scoreIcon", 400);
     const scoreIconWidth = miniGameCtx.measureText(scoreIconStyle.particle).width;

     drawGlowingCanvasText(
          miniGameCtx,
          scoreIconStyle.particle,
          scoreIconX,
          scoreIconY,
          scoreIconStyle.color || colors.meterFull,
          getTextFont(theme, "scoreIcon", 400),
          "left",
          "top",
          theme,
          scoreIconStyle.glow
     );

     drawGlowingCanvasText(
          miniGameCtx,
          sparkleText,
          scoreIconX + scoreIconWidth + scoreIconStyle.gap,
          sparkleY,
          scoreReadyStyle.color || colors.meterFull,
          getTextFont(theme, "scoreReady", 400),
          "left",
          "top",
          theme,
          scoreReadyStyle.glow
     );

     miniGameCtx.restore();
}

export function drawHealth(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors, glow } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const circleMeterStyle = getTextStyle(theme, "circleMeters");
     const levelStatusStyle = getTextStyle(theme, "levelStatus");
     const scoreReadyStyle = getTextStyle(theme, "scoreReady");
     const statusIconStyle = getTextStyle(theme, "statusIcon");
     const statusTitle = "STATUS";
     const statusLabel = activeStatusUi.label || "READY";
     const statusSeconds = getStatusSecondsRemaining();
     const statusIcon = activeStatusUi.particle || "";

     miniGameCtx.save();
     miniGameCtx.textAlign = "right";
     miniGameCtx.textBaseline = "top";
     miniGameCtx.fillStyle = circleMeterStyle.color || colors.statusText;
     miniGameCtx.shadowColor = getCanvasGlowColor(circleMeterStyle.color || colors.statusTextGlow);
     miniGameCtx.shadowBlur = circleMeterStyle.glow ? glow.uiSoftGlow : 0;

     miniGameCtx.font = getTextFont(theme, "circleMeters", 400);

     const circleAdvance =
          (circleMeterStyle.fontSize * circleMeterStyle.advanceScale) +
          (circleMeterStyle.letterSpacing || 0);
     const healthUnits = playerHealth;
     const maxHealthUnits = maxVisibleHearts * progressUnitsPerCircle;
     const circleSlots = maxHealthUnits / progressUnitsPerCircle;
     const rightEdgeX = miniGameWidth - canvasSpacing.uiPadding;
     const circleInkMetrics = getCircleMeterInkMetrics(miniGameCtx, circleMeterStyle);
     const statusTitleY = canvasSpacing.uiPadding;

     drawStyledCanvasText(
          miniGameCtx,
          statusTitle,
          rightEdgeX,
          statusTitleY,
          "levelStatus",
          theme,
          {
               color: levelStatusStyle.color || colors.statusText,
               align: "right",
               baseline: "top"
          }
     );

     const meterY = statusTitleY + levelStatusStyle.fontSize + canvasSpacing.circleTitleGap - circleInkMetrics.top;
     let currentX = rightEdgeX - circleInkMetrics.right;

     for (let i = 0; i < circleSlots; i += 1) {
          const slotUnits = Math.max(0, Math.min(progressUnitsPerCircle, healthUnits - (i * progressUnitsPerCircle)));

          miniGameCtx.fillText(getCircleMeterGlyph(circleMeterStyle, slotUnits), currentX, meterY);
          currentX -= circleAdvance;
     }

     const statusDetailY = meterY + circleInkMetrics.bottom + canvasSpacing.uiRowGap;

     if (statusIcon) {
          const iconX = rightEdgeX + statusIconStyle.xOffset;

          miniGameCtx.font = getTextFont(theme, "statusIcon", 400);
          const statusIconWidth = miniGameCtx.measureText(statusIcon).width;
          const statusTextX = iconX - statusIconWidth - statusIconStyle.gap;

          drawGlowingCanvasText(
               miniGameCtx,
               statusLabel,
               statusTextX,
               statusDetailY,
               scoreReadyStyle.color || colors.statusText,
               getTextFont(theme, "scoreReady", 400),
               "right",
               "top",
               theme,
               scoreReadyStyle.glow
          );

          drawGlowingCanvasText(
               miniGameCtx,
               statusIcon,
               iconX,
               statusDetailY + statusIconStyle.yOffset,
               statusIconStyle.color || colors.statusText,
               getTextFont(theme, "statusIcon", 400),
               "right",
               "top",
               theme,
               statusIconStyle.glow
          );

          if (statusSeconds) {
               const statusSecondsY = statusDetailY + scoreReadyStyle.fontSize + canvasSpacing.uiRowGap;

               drawGlowingCanvasText(
                    miniGameCtx,
                    statusSeconds,
                    rightEdgeX,
                    statusSecondsY,
                    scoreReadyStyle.color || colors.statusText,
                    getTextFont(theme, "scoreReady", 400),
                    "right",
                    "top",
                    theme,
                    scoreReadyStyle.glow
               );
          }
     } else {
          drawGlowingCanvasText(
               miniGameCtx,
               "READY",
               rightEdgeX,
               statusDetailY,
               scoreReadyStyle.color || colors.statusText,
               getTextFont(theme, "scoreReady", 400),
               "right",
               "top",
               theme,
               scoreReadyStyle.glow
          );
     }

     miniGameCtx.restore();
}

export function drawFogOverlay() {
     if (!miniGameCtx || !isEffectActive("fog")) {
          return;
     }

     const clearRadius = Math.max(44, Math.min(82, miniGameWidth * 0.16));
     const fadeRadius = clearRadius * 1.5;

     miniGameCtx.save();

     const gradient = miniGameCtx.createRadialGradient(
          player.x,
          player.y,
          clearRadius,
          player.x,
          player.y,
          fadeRadius
     );

     gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
     gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.2)");
     gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

     miniGameCtx.fillStyle = gradient;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     miniGameCtx.restore();
}

export function drawTouchButtons(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const buttonStyle = getTextStyle(theme, "pauseButton");
     const button = touchControls.pauseButton;

     if (!button) {
          return;
     }

     drawControlButton(button, button.isPressed, theme);

     drawGlowingCanvasText(
          miniGameCtx,
          button.label,
          button.x + (button.width / 2),
          button.y + (button.height / 2) + 1,
          buttonStyle.color || colors.touchText,
          getTextFont(theme, "pauseButton", 400),
          "center",
          "middle",
          theme,
          button.isPressed && buttonStyle.glow
     );
}

export function drawJoystick(theme) {
     if (
          !miniGameCtx ||
          (
               movementLevel !== movementOptionIndexes.joystickLeft &&
               movementLevel !== movementOptionIndexes.joystickRight
          )
     ) {
          return;
     }

     const { colors, glow, sizes } = theme;
     const joystick = touchControls.joystick;
     const joystickStyle = getTextStyle(theme, "joystick");
     const knobX = joystick.x + (joystick.dx * joystick.maxDistance);
     const knobY = joystick.y + (joystick.dy * joystick.maxDistance);

     miniGameCtx.save();

     miniGameCtx.shadowColor = getCanvasGlowColor(colors.touchGlow);
     miniGameCtx.shadowBlur = joystickStyle.glow ? glow.uiMediumGlow : 0;
     miniGameCtx.fillStyle = joystickStyle.fill || colors.touchFill;
     miniGameCtx.strokeStyle = joystickStyle.stroke || colors.touchStroke;
     miniGameCtx.lineWidth = sizes.touchBorderWidth;

     miniGameCtx.beginPath();
     miniGameCtx.arc(joystick.x, joystick.y, joystick.baseRadius, 0, Math.PI * 2);
     miniGameCtx.fill();
     miniGameCtx.stroke();

     miniGameCtx.shadowBlur = joystick.isActive && joystickStyle.glow ? glow.uiStrongGlow : 0;
     miniGameCtx.fillStyle = joystickStyle.knobFill || colors.touchText;

     miniGameCtx.beginPath();
     miniGameCtx.arc(knobX, knobY, joystick.knobRadius, 0, Math.PI * 2);
     miniGameCtx.fill();

     miniGameCtx.restore();
}

// ==================================================
// NOTE: MENU / OVERLAY SCREENS
// ==================================================

function drawTipsMenuScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focusedIndex = tipsSelectionIndex;

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("TIPS", theme, layout.titleCenterX, layout.titleY);
     drawMenuButton(gameMenuUi.tipsHowToPlayButton, "GUIDE", theme, focusedIndex === 0);
     drawMenuButton(gameMenuUi.tipsEffectsButton, "EFFECTS", theme, focusedIndex === 1);
     drawMenuBackButton(gameMenuUi.backButton, theme, focusedIndex === 2);

     miniGameCtx.restore();
}

function drawMenuDetailLines(theme, lines, startY) {
     const { colors } = theme;
     const detailStyle = getTextStyle(theme, "buttonsOptions");
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const screenLayout = getMenuScreenLayout(theme);
     let textY = startY;
     const fontSize = detailStyle.fontSize;
     const lineHeight = canvasSpacing.bodyLineHeight;
     const hasIconGutter = lines.some((line) => line.includes("{icon"));
     const iconGutterWidth = hasIconGutter ? canvasSpacing.friendsEnemiesIconGutter : 0;
     const iconX = screenLayout.sidePadding + (iconGutterWidth * 0.25);
     const detailTextX = screenLayout.sidePadding + iconGutterWidth;
     const detailTextWidth = miniGameWidth - detailTextX - screenLayout.sidePadding;

     miniGameCtx.fillStyle = detailStyle.color || colors.fontColor;
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     miniGameCtx.shadowColor = getCanvasGlowColor(detailStyle.color || colors.fontColor);
     miniGameCtx.shadowBlur = 0;
     miniGameCtx.font = getTextFont(theme, "buttonsOptions", 400);

     lines.forEach((line) => {
          const richSegments = parseRichTextSegments(line);
          const firstSegment = richSegments[0];
          const hasLeadingIcon = firstSegment?.type === "icon";
          const bodyText = hasLeadingIcon
               ? richSegments
                    .slice(1)
                    .map((segment) => segment.value)
                    .join("")
                    .trimStart()
               : line;

          if (hasLeadingIcon) {
               const icon = getRichTextIcon(theme, firstSegment.value);

               if (icon) {
                    drawGlowingCanvasText(
                         miniGameCtx,
                         icon.particle,
                         iconX + (icon.xOffset || 0),
                         textY + (icon.yOffset || 0) - ((fontSize * icon.scale - fontSize) * 0.28),
                         detailStyle.color || colors.fontColor,
                         getTextFont(theme, "buttonsOptions", 400, "body", fontSize * icon.scale),
                         "left",
                         "top",
                         theme,
                         false
                    );
               }
          }

          textY += (
               drawWrappedText(
                    miniGameCtx,
                    bodyText,
                    detailTextX,
                    textY,
                    detailTextWidth,
                    lineHeight
               ) * lineHeight
          );
     });

     return textY;
}

function drawTipsDetailScreen(theme, title, lines) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const screenLayout = getMenuScreenLayout(theme);

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle(title, theme, screenLayout.titleCenterX, screenLayout.titleY);
     drawMenuDetailLines(theme, lines, screenLayout.contentTopY);
     drawMenuBackButton(gameMenuUi.backButton, theme, true);
     miniGameCtx.restore();
}

function getOptionDescriptionY(layout, rowCount = 1) {
     const rowStackHeight = (rowCount * layout.buttonHeight) + (Math.max(0, rowCount - 1) * layout.rowGap);

     return layout.contentTopY + rowStackHeight + layout.titleGap;
}

function drawOptionsScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focused = optionsSelection;

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("OPTIONS", theme, layout.titleCenterX, layout.titleY);
     drawMenuButton(gameMenuUi.optionsDifficultyButton, "DIFFICULTY", theme, focused.row === 0);
     drawMenuButton(gameMenuUi.optionsMovementButton, "MOVEMENT", theme, focused.row === 1);
     drawMenuButton(gameMenuUi.optionsColorButton, "COLOR", theme, focused.row === 2);
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 3);

     miniGameCtx.restore();
}

function drawDifficultyOptionsScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focused = optionsSelection;
     const optionLines = getDifficultyOptionLines();

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("DIFFICULTY", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.harmfulRow,
          gameMenuUi.harmfulDecreaseButton,
          gameMenuUi.harmfulIncreaseButton,
          "Difficulty",
          getShortOptionLevelLabel(harmfulLevel),
          harmfulLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1
     );

     drawMenuDetailLines(theme, optionLines, getOptionDescriptionY(layout, 1));
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 1);
     miniGameCtx.restore();
}

function drawAudioOptionsScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focused = optionsSelection;
     const optionLines = getAudioOptionLines();

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("AUDIO", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.musicRow,
          gameMenuUi.musicDecreaseButton,
          gameMenuUi.musicIncreaseButton,
          "Music",
          getShortOptionLevelLabel(musicLevel),
          musicLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1
     );

     drawOptionStepper(
          gameMenuUi.soundEffectsRow,
          gameMenuUi.soundEffectsDecreaseButton,
          gameMenuUi.soundEffectsIncreaseButton,
          "Sound FX",
          getShortOptionLevelLabel(soundEffectsLevel),
          soundEffectsLevel,
          theme,
          focused.row === 1,
          focused.row === 1 ? focused.col : -1
     );

     drawMenuDetailLines(theme, optionLines, getOptionDescriptionY(layout, 2));
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 2);
     miniGameCtx.restore();
}

function drawMovementOptionsScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focused = optionsSelection;
     const optionLines = getMovementOptionLines();

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("MOVEMENT", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.movementRow,
          gameMenuUi.movementDecreaseButton,
          gameMenuUi.movementIncreaseButton,
          "Movement",
          getShortMovementOptionLabel(movementLevel),
          movementLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1,
          maxMovementOptionIndex
     );

     drawMenuDetailLines(theme, optionLines, getOptionDescriptionY(layout, 1));
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 1);
     miniGameCtx.restore();
}

function drawColorOptionsScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const focused = optionsSelection;
     const optionLines = getColorOptionLines();

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("COLOR", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.colorRow,
          gameMenuUi.colorDecreaseButton,
          gameMenuUi.colorIncreaseButton,
          "Color",
          getShortColorOptionLabel(colorLevel),
          colorLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1,
          maxColorOptionIndex
     );

     drawMenuDetailLines(theme, optionLines, getOptionDescriptionY(layout, 1));
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 1);
     miniGameCtx.restore();
}

function drawStaticOptionsScreen(theme, title, lines) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle(title, theme, layout.titleCenterX, layout.titleY);
     drawMenuDetailLines(theme, lines, layout.contentTopY);
     drawMenuBackButton(gameMenuUi.backButton, theme, true);
     miniGameCtx.restore();
}

function drawSharedActionScreen(
     theme,
     config,
     titleLines,
     actionTexts,
     selectionIndex,
     actionUi,
     primaryButtonKey,
     selectionMap,
     overlayAlpha = 1,
     drawOverlayFill = false,
     instructionLines = []
) {
     if (!miniGameCtx) {
          return;
     }

     const titleStyleName = config.textStyle || "marquee";
     const titleStyle = getTextStyle(theme, titleStyleName);
     const buttonStyle = getTextStyle(theme, "buttonsOptions");
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const titleFontSize = getWelcomeMarqueeFontSize(theme, titleLines, config);
     const titleLetterSpacing = titleStyle.letterSpacing ?? 0;
     const titleStackGap = titleStyle.stackGap;
     const titleMenuGap = canvasSpacing.menuPadding;
     const resolvedInstructionLines = Array.isArray(instructionLines) ? instructionLines.filter(Boolean) : [];
     const instructionGap = resolvedInstructionLines.length ? canvasSpacing.uiRowGap : 0;
     const instructionLineHeight = buttonStyle.fontSize * 1.35;

     miniGameCtx.save();
     miniGameCtx.globalAlpha = overlayAlpha;

     if (drawOverlayFill && config.overlayFill) {
          miniGameCtx.fillStyle = config.overlayFill;
          miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);
     }

     const measuredActions = actionTexts.map((text) => ({
          text,
          textWidth: getUnifiedButtonWidth(
               theme,
               text,
               400,
               buttonStyle.fontSize,
               buttonStyle.buttonExteriorPadding
          ) - (buttonStyle.buttonExteriorPadding * 2)
     }));

     const actionGap = canvasSpacing.betweenButtons;
     const tallestButtonHeight = getUnifiedButtonHeight(
          theme,
          buttonStyle.fontSize,
          buttonStyle.buttonExteriorPadding
     );

     const titleBlockHeight =
          titleFontSize +
          ((titleLines.length - 1) * (titleFontSize + titleStackGap));

     const totalTitleBlockHeight =
          titleBlockHeight +
          titleMenuGap +
          tallestButtonHeight +
          instructionGap +
          (resolvedInstructionLines.length * instructionLineHeight);

     const titleCenterY = miniGameHeight / 2;
     const stackTopY =
          titleCenterY -
          (totalTitleBlockHeight / 2);

     miniGameCtx.font = getTextFont(theme, titleStyleName, 400, null, titleFontSize);
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "middle";

     let titleLetterIndex = 0;

     titleLines.forEach((line, lineIndex) => {
          const y = stackTopY + (lineIndex * (titleFontSize + titleStackGap)) + (titleFontSize / 2);
          const letterWidths = [];

          miniGameCtx.font = getTextFont(theme, titleStyleName, 400, null, titleFontSize);

          for (let i = 0; i < line.length; i += 1) {
               letterWidths.push(miniGameCtx.measureText(line[i]).width);
          }

          const totalWidth =
               letterWidths.reduce((sum, width) => sum + width, 0) +
               (titleLetterSpacing * Math.max(0, line.length - 1));
          let x = (miniGameWidth - totalWidth) / 2;

          for (let i = 0; i < line.length; i += 1) {
               const letter = line[i];
               const titleColor = getTextColor(theme, titleStyleName, titleLetterIndex);

               drawGlowingCanvasText(
                    miniGameCtx,
                    letter,
                    x,
                    y,
                    titleColor,
                    getTextFont(theme, titleStyleName, 400, null, titleFontSize),
                    "left",
                    "middle",
                    theme,
                    titleStyle.glow
               );

               x += letterWidths[i] + titleLetterSpacing;
               titleLetterIndex += 1;
          }
     });

     resetActionButtonBounds(actionUi, primaryButtonKey);

     const actionY =
          stackTopY +
          titleBlockHeight +
          titleMenuGap +
          (tallestButtonHeight / 2);

     const totalActionWidth =
          measuredActions.reduce((sum, item) => sum + item.textWidth + (buttonStyle.buttonExteriorPadding * 2), 0) +
          (actionGap * Math.max(0, measuredActions.length - 1));

     let currentX = (miniGameWidth - totalActionWidth) / 2;

     measuredActions.forEach((item) => {
          const buttonWidth = item.textWidth + (buttonStyle.buttonExteriorPadding * 2);
          const buttonHeight = tallestButtonHeight;
          const buttonX = currentX;
          const buttonY = actionY - (buttonHeight / 2);
          const buttonSelectionIndex = selectionMap[item.text];
          const isFocused = buttonSelectionIndex === selectionIndex;

          drawUnifiedTextButton(
               { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
               item.text,
               theme,
               isFocused,
               400,
               buttonStyle.fontSize
          );

          if (buttonSelectionIndex === 0) {
               setButtonBounds(actionUi[primaryButtonKey], buttonX, buttonY, buttonWidth, buttonHeight);
          }

          if (item.text === "TIPS") {
               setButtonBounds(actionUi.tipsButton, buttonX, buttonY, buttonWidth, buttonHeight);
          }

          if (item.text === "OPTIONS") {
               setButtonBounds(actionUi.menuButton, buttonX, buttonY, buttonWidth, buttonHeight);
          }

          if (item.text === "RETURN") {
               setButtonBounds(actionUi.returnButton, buttonX, buttonY, buttonWidth, buttonHeight);
          }

          currentX += buttonWidth + actionGap;
     });

     if (resolvedInstructionLines.length) {
          const instructionY = actionY + (tallestButtonHeight / 2) + instructionGap + (buttonStyle.fontSize / 2);

          resolvedInstructionLines.forEach((line, lineIndex) => {
               drawGlowingCanvasText(
                    miniGameCtx,
                    line,
                    miniGameWidth / 2,
                    instructionY + (lineIndex * instructionLineHeight),
                    buttonStyle.color,
                    getTextFont(theme, "buttonsOptions", 400),
                    "center",
                    "middle",
                    theme,
                    buttonStyle.glow
               );
          });
     }

     miniGameCtx.restore();
}

function drawGameWelcomeOverlay(theme) {
     if (!miniGameCtx || (!isScreenWelcomeActive() && !isOverlayScreenActive())) {
          return;
     }

     const { screens } = theme;
     const isWelcomeScreen = isScreenWelcomeActive();
     const screenConfig = isWelcomeScreen ? screens.welcome : screens.result;
     const alpha = getGameWelcomeAlpha();
     const titleLines = getCurrentScreenTitleLines();
     const actionTexts = getCurrentScreenActionTexts();
     const selectionIndex = isOverlayScreenActive() ? 0 : welcomeSelectionIndex;

     drawSharedActionScreen(
          theme,
          screenConfig,
          titleLines,
          actionTexts,
          selectionIndex,
          screenActionUi,
          "startButton",
          {
               "NEW GAME": 0,
               "TIPS": 1,
               "OPTIONS": 2,
               "RETURN": 3
          },
          alpha,
          !isWelcomeScreen,
          isWelcomeScreen ? getWelcomeInstructionLines() : []
     );
}

function drawPausedOverlay(theme) {
     if (!miniGameCtx || !gamePaused || gameMenuOpen || gameOver || gameWon) {
          return;
     }

     drawSharedActionScreen(
          theme,
          theme.screens.paused,
          ["PAUSED"],
          getCurrentPausedActionTexts(),
          pausedSelectionIndex,
          pausedActionUi,
          "resumeButton",
          {
               "RESUME": 0,
               "TIPS": 1,
               "OPTIONS": 2,
               "RETURN": 3
          },
          1,
          true
     );
}

function drawGameStatusOverlay(theme) {
     if (!miniGameCtx || !gameOverlayText || gameMenuOpen) {
          return;
     }

     const { colors } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const titleStyle = getTextStyle(theme, "levelStatus");
     const subtextStyle = getTextStyle(theme, "scoreReady");
     const alpha = getGameOverlayAlpha();
     const titleY = miniGameHeight / 2;
     const hasSubtext = Boolean(gameOverlaySubtext);
     const titleFontSize = titleStyle.fontSize;
     const subtextFontSize = subtextStyle.fontSize;
     const panelPadding = canvasSpacing.uiPadding;
     const gapBetweenLines = hasSubtext ? canvasSpacing.uiRowGap : 0;
     const subtextY = titleY + (titleFontSize / 2) + gapBetweenLines + (subtextFontSize / 2);

     miniGameCtx.save();
     miniGameCtx.globalAlpha = alpha;

     miniGameCtx.fillStyle = colors.controlFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     miniGameCtx.font = getTextFont(theme, "levelStatus", 400);
     const titleWidth = miniGameCtx.measureText(gameOverlayText).width;

     let subWidth = 0;
     if (hasSubtext) {
          miniGameCtx.font = getTextFont(theme, "scoreReady", 400);
          subWidth = miniGameCtx.measureText(gameOverlaySubtext).width;
     }

     const panelWidth = Math.max(titleWidth, subWidth) + (panelPadding * 2);
     const panelHeight =
          titleFontSize +
          (hasSubtext ? subtextFontSize + gapBetweenLines : 0) +
          (panelPadding * 2);
     const panelX = (miniGameWidth - panelWidth) / 2;
     const panelY = titleY - panelPadding - (titleFontSize / 2);

     drawPanelBox(panelX, panelY, panelWidth, panelHeight, theme);

     drawGlowingCanvasText(
          miniGameCtx,
          gameOverlayText,
          miniGameWidth / 2,
          titleY,
          titleStyle.color || colors.fontColor,
          getTextFont(theme, "levelStatus", 400),
          "center",
          "middle",
          theme,
          titleStyle.glow
     );

     if (hasSubtext) {
          drawGlowingCanvasText(
               miniGameCtx,
               gameOverlaySubtext,
               miniGameWidth / 2,
               subtextY,
               subtextStyle.color || colors.fontColor,
               getTextFont(theme, "scoreReady", 400),
               "center",
               "middle",
               theme,
               subtextStyle.glow
          );
     }

     miniGameCtx.restore();
}

function drawLevelPopup(theme) {
     const popupText = getLevelPopupText();
     const alpha = getLevelPopupAlpha();

     if (!miniGameCtx || !popupText || alpha <= 0 || gameMenuOpen || gameOver || gameWon) {
          return;
     }

     const { colors } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const titleStyle = getTextStyle(theme, "title");
     const panelPadding = canvasSpacing.uiPadding;
     const popupY = miniGameHeight * 0.28;

     miniGameCtx.save();
     miniGameCtx.globalAlpha = alpha;
     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";
     miniGameCtx.font = getTextFont(theme, "title", 400);

     const panelWidth = miniGameCtx.measureText(popupText).width + (panelPadding * 2);
     const panelHeight = titleStyle.fontSize + (panelPadding * 2);
     const panelX = (miniGameWidth - panelWidth) / 2;
     const panelY = popupY - (panelHeight / 2);

     drawPanelBox(panelX, panelY, panelWidth, panelHeight, theme);

     drawStyledCanvasText(
          miniGameCtx,
          popupText,
          miniGameWidth / 2,
          popupY,
          "title",
          theme,
          {
               color: titleStyle.color || colors.fontColor,
               align: "center",
               baseline: "middle"
          }
     );

     miniGameCtx.restore();
}

// ==================================================
// NOTE: MASTER DRAW ENTRY
// ==================================================

export function drawGame() {
     const theme = getCanvasTheme();

     ensureCanvasHoverTracking();
     drawMiniGameBackground();
     applyCanvasColorModeFilter();

     if (isScreenWelcomeActive()) {
          drawGameWelcomeOverlay(theme);
          resetCanvasColorModeFilter();
          updateCanvasCursor();
          return;
     }

     if (gameStarted) {
          drawSparkles();
          drawHealthHazards();
          drawEffectPickups();
          drawCollisionBursts();
          drawPlayerTrail();
          drawPlayer();

          drawFogOverlay();

          drawScore(theme);
          drawHealth(theme);
          drawJoystick(theme);
          drawLevelPopup(theme);

          if (!gamePaused && !gameMenuOpen && !gameOver && !gameWon) {
               drawTouchButtons(theme);
          }
     }

     if (gameMenuOpen) {
          if (gameMenuView === "tips") {
               drawTipsMenuScreen(theme);
          } else if (gameMenuView === "tips_how_to_play") {
               drawTipsDetailScreen(theme, "GUIDE", getHowToPlayLines());
          } else if (gameMenuView === "tips_effects") {
               drawTipsDetailScreen(theme, "EFFECTS", getEffectLines());
          } else if (gameMenuView === "options") {
               drawOptionsScreen(theme);
          } else if (gameMenuView === "options_difficulty") {
               drawDifficultyOptionsScreen(theme);
          } else if (gameMenuView === "options_audio") {
               drawAudioOptionsScreen(theme);
          } else if (gameMenuView === "options_movement") {
               drawMovementOptionsScreen(theme);
          } else if (gameMenuView === "options_color") {
               drawColorOptionsScreen(theme);
          }
     } else if (gamePaused && !gameOver && !gameWon) {
          drawPausedOverlay(theme);
     } else if (isOverlayScreenActive()) {
          drawGameWelcomeOverlay(theme);
     } else {
          drawGameStatusOverlay(theme);
     }

     resetCanvasColorModeFilter();
     updateCanvasCursor();
}
