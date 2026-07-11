// NOTE: draw/index
// Canvas rendering, menus, overlays, text layout, and shared draw helpers.
//
// Owned here:
// - full canvas draw entry
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
// - If code changes gameplay state or movement rules, it belongs in `entities/index.js`.
// - If code only stores mutable shared values, it belongs in `state.js`.
// - If code maps CSS/theme values into a canvas theme object, it belongs in `game.js`.

import {
     miniGameCtx,
     miniGameWidth,
     miniGameHeight,
     player,
     touchControls,
     playerHealth,
     starScore,
     gameStarted,
     gamePaused,
     gameMenuOpen,
     gameMenuView,
     gameOver,
     gameWon,
     gameOverlayText,
     gameOverlaySubtext,
     gameplayPopupText,
     gameMenuUi,
     hurtLevel,
     movementLevel,
     colorLevel,
     screenActionUi,
     pausedActionUi,
     welcomeSelectionIndex,
     pausedSelectionIndex,
     tipsSelectionIndex,
     optionsSelection,
     gameMenuScroll,
     activeStatusUi,
     getMenuKeyboardFocusAlpha,
     isHelphurtActive,
     hoverCanvasX,
     hoverCanvasY,
     isCanvasPointerInside,
     hoverTrackingAttachedCanvas,
     setHoverCanvasPosition,
     setCanvasPointerInside,
     setHoverTrackingAttachedCanvas,
     setButtonBounds,
     setGameMenuScrollMax,
     isPointInsideRect,
     resetActionButtonBounds
} from "../state.js";

import {
     maxDifficultyOptionIndex,
     getMaxMovementOptionIndex,
     maxPlayerHealth,
     movementOptionIndexes,
     isJoystickEnabled,
     getMovementOptionLabel,
     getUnifiedButtonFont,
     getUnifiedButtonWidth,
     getUnifiedButtonHeight,
     setOptionRowBounds,
     getMenuScreenLayout,
     getMenuLayoutMetrics,
     parseRichTextSegments,
     playerGlowBlurFallback
} from "../options.js";

import {
     drawStars,
     drawStrikes,
     drawHelphurtPickups,
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
     syncPlayerSize
} from "../entities/index.js";

import {
     getCanvasTheme,
     getCssColor,
     getCurrentLevelNumber,
     getCurrentLevelProgressRatio,
     maxLevelProgressUnits,
     getCurrentScreenActionTexts,
     getCurrentPausedActionTexts,
     getHowToPlayLines,
     getHelpLines,
     getHurtLines,
     getDifficultyOptionLines,
     getMovementOptionLines,
     isScreenWelcomeActive,
     isOverlayScreenActive,
     getCurrentScreenTitleLines,
     getGameWelcomeAlpha,
     getGameOverlayAlpha,
     getGameplayPopupAlpha,
     getDifficultyOptionLabel,
     isRoundIntroActive,
     getRoundIntroAlpha,
     getRoundIntroLines
} from "../game.js";

import {
     stepperLeftIcon,
     stepperRightIcon,
     richTextIconAssetImages
} from "./assets.js";

const siteTheme = window.SiteTheme;
const levelProgressPulseFrames = 18;
const keyboardFocusFill = "rgba(255, 255, 255, 0.25)";

let lastLevelProgressFilledStars = null;
let levelProgressPulseTimer = 0;

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
     syncPlayerSize
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
               screenActionUi.effectsButton,
               screenActionUi.menuButton,
               screenActionUi.returnButton
          );
     }

     if (gamePaused && !gameMenuOpen && !gameOver && !gameWon) {
          buttons.push(
               pausedActionUi.resumeButton,
               pausedActionUi.tipsButton,
               pausedActionUi.effectsButton,
               pausedActionUi.menuButton,
               pausedActionUi.returnButton
          );
     }

     if (gameMenuOpen) {
          buttons.push(gameMenuUi.backButton);

          if (gameMenuView === "tips") {
               return buttons;
          }

          if (gameMenuView === "options") {
               if (hurtLevel > 0) {
                    buttons.push(gameMenuUi.hurtDecreaseButton);
               }

               if (hurtLevel < maxDifficultyOptionIndex) {
                    buttons.push(gameMenuUi.hurtIncreaseButton);
               }

               if (isJoystickEnabled() && movementLevel > 0) {
                    buttons.push(gameMenuUi.movementDecreaseButton);
               }

               if (isJoystickEnabled() && movementLevel < getMaxMovementOptionIndex()) {
                    buttons.push(gameMenuUi.movementIncreaseButton);
               }

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

     if (gameMenuView === "options") {
          const sliderRowHeight = layout.buttonHeight * 2;
          const optionsBodyGap = getTextStyle(theme, "canvasSpacing").bodyLineHeight;
          const showMovementOption = isJoystickEnabled();
          const optionRows = [
               {
                    row: gameMenuUi.hurtRow,
                    decreaseButton: gameMenuUi.hurtDecreaseButton,
                    increaseButton: gameMenuUi.hurtIncreaseButton
               }
          ];

          if (showMovementOption) {
               optionRows.push({
                    row: gameMenuUi.movementRow,
                    decreaseButton: gameMenuUi.movementDecreaseButton,
                    increaseButton: gameMenuUi.movementIncreaseButton
               });
          } else {
               setButtonBounds(gameMenuUi.movementRow, 0, 0, 0, 0);
               setButtonBounds(gameMenuUi.movementDecreaseButton, 0, 0, 0, 0);
               setButtonBounds(gameMenuUi.movementIncreaseButton, 0, 0, 0, 0);
          }

          setButtonBounds(gameMenuUi.optionsDifficultyButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.optionsMovementButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.optionsColorButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.colorRow, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.colorDecreaseButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.colorIncreaseButton, 0, 0, 0, 0);

          optionRows.forEach((item, index) => {
               setOptionRowBounds(
                    item.row,
                    item.decreaseButton,
                    item.increaseButton,
                    layout.buttonX,
                    layout.contentTopY +
                         optionsBodyGap +
                         (index * (sliderRowHeight + layout.rowGap)) +
                         (index > 0 ? optionsBodyGap : 0),
                    layout.buttonWidth,
                    sliderRowHeight
               );
          });

          return;
     }

     if (
          gameMenuView !== "options_difficulty" &&
          gameMenuView !== "options_movement"
     ) {
          return;
     }

     if (gameMenuView === "options_difficulty") {
          setOptionRowBounds(
               gameMenuUi.hurtRow,
               gameMenuUi.hurtDecreaseButton,
               gameMenuUi.hurtIncreaseButton,
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
}

function updatePauseButtonBounds(theme = getCanvasTheme()) {
     const button = touchControls.pauseButton;
     const buttonStyle = getTextStyle(theme, "pauseButton");
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const buttonSize = buttonStyle.buttonSize || (buttonStyle.fontSize + canvasSpacing.uiPadding);

     button.width = buttonSize;
     button.height = buttonSize;
     button.x = miniGameWidth - button.width - canvasSpacing.uiPadding;
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

export function drawPanelBox(x, y, width, height, theme, lineWidth = null, fillStyle = null) {
     if (!miniGameCtx) {
          return;
     }

     const { colors, sizes } = theme;
     const resolvedLineWidth = lineWidth ?? sizes.borderWidth;
     const outerWidth = sizes.borderWidthFocus || sizes.borderWidth || 1;
     const insetWidth = sizes.panelBorderWidth || outerWidth;
     const cornerRadius = getControlCornerRadius(theme, width, height);

     miniGameCtx.shadowBlur = 0;
     miniGameCtx.fillStyle = fillStyle || colors.menuPanelFill;
     drawRoundedRect(x, y, width, height, cornerRadius);
     miniGameCtx.fill();

     miniGameCtx.lineJoin = "round";
     miniGameCtx.lineCap = "round";

     miniGameCtx.strokeStyle = colors.fontColor;
     miniGameCtx.lineWidth = outerWidth;
     drawRoundedRect(
          x + (outerWidth / 2),
          y + (outerWidth / 2),
          width - outerWidth,
          height - outerWidth,
          Math.max(0, cornerRadius - (outerWidth / 2))
     );
     miniGameCtx.stroke();

     miniGameCtx.strokeStyle = colors.frameInset;
     miniGameCtx.lineWidth = insetWidth;
     drawRoundedRect(
          x + insetWidth,
          y + insetWidth,
          width - (insetWidth * 2),
          height - (insetWidth * 2),
          Math.max(0, cornerRadius - insetWidth)
     );
     miniGameCtx.stroke();

     miniGameCtx.strokeStyle = colors.outlineStrong;
     miniGameCtx.lineWidth = resolvedLineWidth;
     drawRoundedRect(
          x + (resolvedLineWidth / 2),
          y + (resolvedLineWidth / 2),
          width - resolvedLineWidth,
          height - resolvedLineWidth,
          Math.max(0, cornerRadius - (resolvedLineWidth / 2))
     );
     miniGameCtx.stroke();
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

function getFittedTextFont(theme, styleName, text, maxWidth = Infinity, fontWeight = 400) {
     const style = getTextStyle(theme, styleName);
     const minFontSize = 10;
     const baseFontSize = Math.max(minFontSize, style.fontSize ?? theme.sizes.uiFontSm);

     if (!miniGameCtx || !Number.isFinite(maxWidth) || maxWidth <= 0) {
          return getTextFont(theme, styleName, fontWeight);
     }

     miniGameCtx.font = getTextFont(theme, styleName, fontWeight, null, baseFontSize);

     const measuredWidth = miniGameCtx.measureText(text).width;

     if (measuredWidth <= maxWidth) {
          return getTextFont(theme, styleName, fontWeight, null, baseFontSize);
     }

     const fittedFontSize = Math.max(minFontSize, Math.floor(baseFontSize * (maxWidth / measuredWidth)));

     return getTextFont(theme, styleName, fontWeight, null, fittedFontSize);
}

function getTextColor(theme, styleName, letterIndex = 0) {
     const style = getTextStyle(theme, styleName);

     if (style.rainbow) {
          return getRainbowTextColor(theme, style, letterIndex);
     }

     return style.color || theme.colors.fontColor;
}

function getRichTextIcon(theme, tokenName) {
     return theme.text?.guideIcons?.[tokenName] || null;
}

function getRichTextIconAsset(src) {
     if (!src) {
          return null;
     }

     if (!richTextIconAssetImages[src]) {
          richTextIconAssetImages[src] = new Image();
          richTextIconAssetImages[src].src = src;
     }

     return richTextIconAssetImages[src];
}

function getRichTextIconSize(icon, iconBaseSize) {
     return iconBaseSize;
}

function getRichTextIconWidth(ctx, icon, iconBaseSize, iconFont) {
     const assetImage = getRichTextIconAsset(icon.assetSrc);

     if (assetImage?.complete && assetImage.naturalWidth > 0) {
          return getRichTextIconSize(icon, iconBaseSize);
     }

     ctx.font = iconFont;
     return ctx.measureText(icon.particle).width;
}

function drawTintedRichTextIcon(ctx, icon, x, y, size, color) {
     const assetImage = getRichTextIconAsset(icon.assetSrc);

     if (!assetImage?.complete || assetImage.naturalWidth <= 0) {
          return false;
     }

     const tintCanvas = document.createElement("canvas");
     const tintCtx = tintCanvas.getContext("2d");
     const drawSize = Math.ceil(size);

     tintCanvas.width = drawSize;
     tintCanvas.height = drawSize;

     tintCtx.drawImage(assetImage, 0, 0, drawSize, drawSize);
     tintCtx.globalCompositeOperation = "source-in";
     tintCtx.fillStyle = color;
     tintCtx.fillRect(0, 0, drawSize, drawSize);

     ctx.drawImage(tintCanvas, x, y, size, size);
     return true;
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
     function getTertiaryPalette() {
          return Array.from({ length: 12 }, (_item, index) => {
               const variableName = `--tertiary-${String(index + 1).padStart(2, "0")}`;
               return getCssColor(variableName, "#f0f");
          });
     }

     function getCatppuccinPalette() {
          return Array.from({ length: 12 }, (_item, index) => {
               const variableName = `--mocha-${String(index + 1).padStart(2, "0")}`;
               return getCssColor(variableName, "#f5c2e7");
          });
     }

     if (colorLevel === 0) {
          return getTertiaryPalette();
     }

     if (colorLevel === 1 || colorLevel === 2) {
          return getCatppuccinPalette();
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

function getShortDifficultyOptionLabel(levelIndex) {
     return getDifficultyOptionLabel(levelIndex).toUpperCase();
}

function getDifficultyOptionDescription(levelIndex) {
     return getDifficultyOptionLines()[levelIndex] || getShortDifficultyOptionLabel(levelIndex);
}

function getShortMovementOptionLabel(levelIndex) {
     const labels = ["Click / Arrows", "Joystick Left", "Joystick Right"];

     return labels[levelIndex] || getMovementOptionLabel(levelIndex).toUpperCase();
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
     return colorLevel === 2
          ? getCssColor("--color-white", "#ffffff")
          : color;
}

function getControlCornerRadius(theme, width, height) {
     return Math.min(theme.sizes.controlRadius || 0, width / 2, height / 2);
}

function fillRoundedControlRect(x, y, width, height, radius, fillStyle) {
     miniGameCtx.fillStyle = fillStyle;
     drawRoundedRect(x, y, width, height, radius);
     miniGameCtx.fill();
}

function strokeRoundedControlRect(x, y, width, height, radius, lineWidth, strokeStyle) {
     miniGameCtx.strokeStyle = strokeStyle;
     miniGameCtx.lineWidth = lineWidth;
     drawRoundedRect(
          x + (lineWidth / 2),
          y + (lineWidth / 2),
          width - lineWidth,
          height - lineWidth,
          Math.max(0, radius - (lineWidth / 2))
     );
     miniGameCtx.stroke();
}

function drawUnifiedTextButton(button, label, theme, isFocused = false, fontWeight = 400, fontSize = null) {
     if (!miniGameCtx || !button) {
          return;
     }

     const { colors } = theme;
     const buttonStyle = getTextStyle(theme, "buttonsOptions");
     const resolvedFontSize = fontSize ?? buttonStyle.fontSize;
     const labelMaxWidth = Math.max(1, button.width - (buttonStyle.buttonPadding * 2));
     const centerX = button.x + (button.width / 2);
     const centerY = button.y + (button.height / 2);
     const cornerRadius = getControlCornerRadius(theme, button.width, button.height);
     const borderWidth = theme.sizes.borderWidthFocus || theme.sizes.borderWidth || 1;

     miniGameCtx.save();

     const focusAlpha = getMenuKeyboardFocusAlpha();

     if (isFocused && focusAlpha > 0) {
          miniGameCtx.globalAlpha *= focusAlpha;
          fillRoundedControlRect(button.x, button.y, button.width, button.height, cornerRadius, keyboardFocusFill);
     }

     strokeRoundedControlRect(
          button.x,
          button.y,
          button.width,
          button.height,
          cornerRadius,
          borderWidth,
          buttonStyle.color || colors.controlText
     );

     miniGameCtx.restore();

     drawGlowingCanvasText(
          miniGameCtx,
          label,
          centerX,
          centerY + 1,
          buttonStyle.color || colors.controlText,
          getFittedTextFont(
               {
                    ...theme,
                    text: {
                         ...theme.text,
                         buttonsOptions: {
                              ...buttonStyle,
                              fontSize: resolvedFontSize
                         }
                    }
               },
               "buttonsOptions",
               label,
               labelMaxWidth,
               fontWeight
          ),
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
     drawUnifiedTextButton(button, "PREVIOUS", theme, isFocused, 400, getTextStyle(theme, "buttonsOptions").fontSize);
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
     maxLevelIndex = maxDifficultyOptionIndex
) {
     if (!miniGameCtx || !row || !decreaseButton || !increaseButton) {
          return;
     }

     const { colors } = theme;
     const optionsStyle = getTextStyle(theme, "buttonsOptions");
     const centerY = row.y + (row.height / 2);
     const titleY = row.y + (row.height * 0.25);
     const valueY = row.y + (row.height * 0.75);
     const canDecrease = levelIndex > 0;
     const canIncrease = levelIndex < maxLevelIndex;
     const optionTextColor = optionsStyle.color || colors.controlText;
     const arrowScale = optionsStyle.arrowScale || 1;
     const arrowIconSize = Math.min(row.height * 0.5, optionsStyle.fontSize * arrowScale);
     const cornerRadius = getControlCornerRadius(theme, row.width, row.height);
     const borderWidth = theme.sizes.borderWidthFocus || theme.sizes.borderWidth || 1;

     function drawStepperArrow(button, icon, isEnabled) {
          if (!isEnabled) {
               return;
          }

          const iconX = button.x + ((button.width - arrowIconSize) / 2);
          const iconY = centerY - (arrowIconSize / 2);

          miniGameCtx.save();
          if (icon.complete && icon.naturalWidth > 0) {
               miniGameCtx.drawImage(icon, iconX, iconY, arrowIconSize, arrowIconSize);
          }
          miniGameCtx.restore();
     }

     miniGameCtx.save();

     const focusAlpha = getMenuKeyboardFocusAlpha();

     if (isRowFocused && focusAlpha > 0) {
          miniGameCtx.globalAlpha *= focusAlpha;
          fillRoundedControlRect(row.x, row.y, row.width, row.height, cornerRadius, keyboardFocusFill);
     }

     strokeRoundedControlRect(
          row.x,
          row.y,
          row.width,
          row.height,
          cornerRadius,
          borderWidth,
          optionsStyle.color || colors.controlText
     );

     miniGameCtx.restore();

     drawStepperArrow(decreaseButton, stepperLeftIcon, canDecrease);

     drawGlowingCanvasText(
          miniGameCtx,
          label,
          row.x + (row.width / 2),
          titleY,
          optionTextColor,
          getTextFont(theme, "buttonsOptions", 700),
          "center",
          "middle",
          theme,
          isRowFocused && optionsStyle.glow
     );

     drawGlowingCanvasText(
          miniGameCtx,
          value,
          row.x + (row.width / 2),
          valueY,
          optionTextColor,
          getTextFont(theme, "buttonsOptions", 400),
          "center",
          "middle",
          theme,
          isRowFocused && optionsStyle.glow
     );

     drawStepperArrow(increaseButton, stepperRightIcon, canIncrease);
}

function formatHudUnitValue(value) {
     return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getHealthBadgeText() {
     const currentHearts = Math.max(0, Math.min(maxPlayerHealth, playerHealth));
     const maxHearts = maxPlayerHealth;

     return `💚 ${formatHudUnitValue(currentHearts)}/${formatHudUnitValue(maxHearts)}`;
}

function getWinBadgeText() {
     return `🏆 ${getCurrentLevelNumber()}/${maxLevelProgressUnits}`;
}

function getScoreBadgeText() {
     return `⭐ ${String(starScore).padStart(3, "0")}`;
}

function getLevelProgressFilledStars() {
     return Math.round(getCurrentLevelProgressRatio() * maxLevelProgressUnits);
}

function getLevelProgressStars(filledStars = getLevelProgressFilledStars()) {

     return Array.from({ length: maxLevelProgressUnits }, (_item, index) => (
          index < filledStars ? "★" : "☆"
     )).join("");
}

function getStatusTextLines() {
     if (activeStatusUi.text) {
          return activeStatusUi.text.split(/\s{2,}/).filter(Boolean);
     }

     if (!activeStatusUi.particle || activeStatusUi.timer <= 0) {
          return [];
     }

     return [`${activeStatusUi.particle} ${Math.ceil(activeStatusUi.timer / 60)}s`];
}

function getCompactStatusText(statusText, maxWidth) {
     if (maxWidth >= 90) {
          return statusText;
     }

     return statusText.split(/\s+/)[0] || statusText;
}

function drawHudText(theme, text, x, y, align = "left", styleName = "scoreReady", maxWidth = Infinity) {
     if (!miniGameCtx || !text) {
          return;
     }

     const { colors } = theme;
     const textStyle = getTextStyle(theme, styleName);
     const font = getFittedTextFont(theme, styleName, text, maxWidth, 400);

     miniGameCtx.save();
     drawGlowingCanvasText(
          miniGameCtx,
          text,
          x,
          y,
          textStyle.color || colors.bodyText,
          font,
          align,
          "top",
          theme,
          textStyle.glow
     );
     miniGameCtx.restore();
}

function drawHudBadges(theme) {
     const spacing = getTextStyle(theme, "canvasSpacing");
     const padding = spacing.uiPadding || 8;
     const lineHeight = getTextStyle(theme, "scoreReady").fontSize + spacing.hudRowGap;
     const leftX = padding;
     const rightX = miniGameWidth - padding;
     const statusLines = getStatusTextLines();
     const sideColumnWidth = Math.max(64, (miniGameWidth - (padding * 2)) * 0.3);

     drawHudText(theme, getWinBadgeText(), leftX, padding, "left", "scoreReady", sideColumnWidth);
     drawHudText(theme, getScoreBadgeText(), leftX, padding + lineHeight, "left", "scoreReady", sideColumnWidth);
     drawHudText(theme, getHealthBadgeText(), leftX, padding + (lineHeight * 2), "left", "scoreReady", sideColumnWidth);

     drawHudText(theme, "⏯️", rightX, padding, "right", "scoreReady", sideColumnWidth);

     statusLines.forEach((statusText, index) => {
          drawHudText(
               theme,
               getCompactStatusText(statusText, sideColumnWidth),
               rightX,
               padding + (lineHeight * (index + 1)),
               "right",
               "scoreReady",
               sideColumnWidth
          );
     });
}

function drawLevelProgressStars(theme) {
     const spacing = getTextStyle(theme, "canvasSpacing");
     const padding = spacing.uiPadding || 8;
     const progressStyle = getTextStyle(theme, "hudProgress");
     const maxWidth = Math.max(80, miniGameWidth - (padding * 2));
     const filledStars = getLevelProgressFilledStars();
     const progressText = getLevelProgressStars(filledStars);
     const y = Math.max(
          padding,
          miniGameHeight - padding - progressStyle.fontSize
     );

     if (lastLevelProgressFilledStars === null) {
          lastLevelProgressFilledStars = filledStars;
     } else if (filledStars > lastLevelProgressFilledStars) {
          levelProgressPulseTimer = levelProgressPulseFrames;
          lastLevelProgressFilledStars = filledStars;
     } else if (filledStars < lastLevelProgressFilledStars) {
          lastLevelProgressFilledStars = filledStars;
     }

     const pulseRatio = levelProgressPulseTimer / levelProgressPulseFrames;
     const scale = 1 + (0.1 * pulseRatio);
     const centerY = y + (progressStyle.fontSize / 2);

     if (levelProgressPulseTimer > 0) {
          levelProgressPulseTimer -= 1;
     }

     miniGameCtx.save();
     miniGameCtx.translate(miniGameWidth / 2, centerY);
     miniGameCtx.scale(scale, scale);
     drawHudText(theme, progressText, 0, -(progressStyle.fontSize / 2), "center", "hudProgress", maxWidth / scale);
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

          return `400 ${getRichTextIconSize(icon, iconBaseSize)}px ${iconFontFamily}`;
     }

     function getTokenIcon(token) {
          if (token.type !== "icon") {
               return null;
          }

          return getRichTextIcon(options.theme, token.value);
     }

     function getTokenText(token) {
          if (token.type !== "icon") {
               return token.value;
          }

          const icon = getRichTextIcon(options.theme, token.value);

          return icon ? icon.particle : token.value;
     }

     function getTokenWidth(token) {
          if (token.type !== "icon") {
               ctx.font = font;
               return ctx.measureText(token.value).width;
          }

          const icon = getTokenIcon(token);

          if (!icon) {
               ctx.font = font;
               return ctx.measureText(token.value).width;
          }

          return getRichTextIconWidth(ctx, icon, iconBaseSize, getTokenFont(token));
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

          const customOffset = icon.yOffset || 0;

          return iconYOffset + customOffset;
     }

     const lines = [];
     let currentLine = [];
     let currentWidth = 0;

     tokens.forEach((token) => {
          const tokenWidth = getTokenWidth(token);
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
               const icon = getTokenIcon(token);
               const iconSize = icon ? getRichTextIconSize(icon, iconBaseSize) : 0;
               const tokenXOffset = getTokenXOffset(token);
               const tokenYOffset = getTokenYOffset(token);
               const tokenWidth = getTokenWidth(token);

               if (
                    icon &&
                    drawTintedRichTextIcon(
                         ctx,
                         icon,
                         currentX + tokenXOffset,
                         currentY + tokenYOffset,
                         iconSize,
                         options.color || ctx.fillStyle
                    )
               ) {
                    currentX += tokenWidth;
                    return;
               }

               ctx.font = getTokenFont(token);
               ctx.fillText(getTokenText(token), currentX + tokenXOffset, currentY + tokenYOffset);
               currentX += tokenWidth;
          });
     });

     ctx.font = font;

     return lines.length;
}

export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
     return drawWrappedRichText(ctx, text, x, y, maxWidth, lineHeight);
}

// ====================================================================================================
// NOTE: BACKGROUND / TOUCH
// ====================================================================================================

export function drawMiniGameBackground() {
     if (!miniGameCtx) {
          return;
     }

     miniGameCtx.clearRect(0, 0, miniGameWidth, miniGameHeight);
     miniGameCtx.fillStyle = getCssColor("--black-50", "rgba(0, 0, 0, 0.5)");
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);
}


export function drawFogOverlay() {
     if (!miniGameCtx || !isHelphurtActive("fog")) {
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

export function drawJoystick(theme) {
     if (
          !miniGameCtx ||
          !isJoystickEnabled() ||
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

     const lines = [
          "TIPS",
          ...getHowToPlayLines()
     ];

     drawScrollableInfoScreen(theme, lines);
}

function drawEffectsMenuScreen(theme) {
     if (!miniGameCtx) {
          return;
     }

     const lines = [
          "HELPS",
          ...getHelpLines(),
          "",
          "HURTS",
          ...getHurtLines()
     ];

     drawScrollableInfoScreen(theme, lines);
}

function drawScrollableInfoScreen(theme, lines) {
     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     const viewportTop = layout.titleY;
     const viewportBottom = layout.contentBottomY;
     const viewportHeight = Math.max(0, viewportBottom - viewportTop);

     miniGameCtx.save();
     miniGameCtx.beginPath();
     miniGameCtx.rect(0, viewportTop, miniGameWidth, viewportHeight);
     miniGameCtx.clip();

     const contentStartY = viewportTop - gameMenuScroll.offset;
     const contentEndY = drawMenuDetailLines(theme, lines, contentStartY, { centerContent: true });
     const contentHeight = contentEndY - contentStartY;

     miniGameCtx.restore();

     const scrollMax = Math.max(0, contentHeight - viewportHeight);

     setGameMenuScrollMax(scrollMax);

     drawMenuBackButton(gameMenuUi.backButton, theme, tipsSelectionIndex === 0);

     miniGameCtx.restore();
}

function drawMenuDetailLines(theme, lines, startY, options = {}) {
     const { colors } = theme;
     const detailStyle = getTextStyle(theme, "buttonsOptions");
     const titleStyle = getTextStyle(theme, "title");
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const screenLayout = getMenuScreenLayout(theme);
     let textY = startY;
     const fontSize = detailStyle.fontSize;
     const lineHeight = canvasSpacing.bodyLineHeight;
     const sectionHeadingHeight = titleStyle.fontSize;
     const hasIconGutter = lines.some((line) => line.includes("{icon"));
     const iconGutterWidth = hasIconGutter ? canvasSpacing.guideIconGutter : 0;
     const iconX = screenLayout.sidePadding + (iconGutterWidth * 0.25);
     const detailTextX = screenLayout.sidePadding + iconGutterWidth;
     const detailTextWidth = miniGameWidth - detailTextX - screenLayout.sidePadding;
     const sectionHeadings = new Set(["TIPS", "EFFECTS", "HELPS", "HURTS"]);
     const shouldCenterContent = Boolean(options.centerContent);

     miniGameCtx.fillStyle = detailStyle.color || colors.fontColor;
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     miniGameCtx.shadowColor = getCanvasGlowColor(detailStyle.color || colors.fontColor);
     miniGameCtx.shadowBlur = 0;
     miniGameCtx.font = getTextFont(theme, "buttonsOptions", 400);

     function measureDetailLine(firstSegment, bodyText) {
          const hasLeadingIcon = firstSegment?.type === "icon";
          const textFont = getTextFont(theme, "buttonsOptions", 400);
          let icon = null;
          let iconFont = textFont;
          let iconWidth = 0;
          const iconGap = hasLeadingIcon ? fontSize * 0.45 : 0;

          miniGameCtx.font = textFont;
          const textWidth = miniGameCtx.measureText(bodyText).width;

          if (hasLeadingIcon) {
               icon = getRichTextIcon(theme, firstSegment.value);

               if (icon) {
                    iconFont = getTextFont(theme, "buttonsOptions", 400, "body", getRichTextIconSize(icon, fontSize));
                    iconWidth = getRichTextIconWidth(miniGameCtx, icon, fontSize, iconFont);
               }
          }

          return iconWidth + (icon ? iconGap : 0) + textWidth;
     }

     function getCenteredBodyBlockX() {
          if (!shouldCenterContent) {
               return 0;
          }

          let maxBodyLineWidth = 0;

          lines.forEach((line) => {
               if (!line.trim() || sectionHeadings.has(line)) {
                    return;
               }

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

               maxBodyLineWidth = Math.max(maxBodyLineWidth, measureDetailLine(firstSegment, bodyText));
          });

          return (miniGameWidth - maxBodyLineWidth) / 2;
     }

     const centeredBodyBlockX = getCenteredBodyBlockX();

     function drawCenteredDetailLine(line, firstSegment, bodyText) {
          const hasLeadingIcon = firstSegment?.type === "icon";
          const textFont = getTextFont(theme, "buttonsOptions", 400);
          let icon = null;
          let iconFont = textFont;
          let iconWidth = 0;
          const iconGap = hasLeadingIcon ? fontSize * 0.45 : 0;
          let currentX = centeredBodyBlockX;

          if (hasLeadingIcon) {
               icon = getRichTextIcon(theme, firstSegment.value);

               if (icon) {
                    iconFont = getTextFont(theme, "buttonsOptions", 400, "body", getRichTextIconSize(icon, fontSize));
                    iconWidth = getRichTextIconWidth(miniGameCtx, icon, fontSize, iconFont);
               }
          }

          if (icon) {
               const iconX = currentX + (icon.xOffset || 0);
               const iconY = textY + (icon.yOffset || 0);

               if (!drawTintedRichTextIcon(
                    miniGameCtx,
                    icon,
                    iconX,
                    iconY,
                    getRichTextIconSize(icon, fontSize),
                    detailStyle.color || colors.fontColor
               )) {
                    miniGameCtx.font = iconFont;
                    miniGameCtx.fillText(
                         icon.particle,
                         iconX,
                         iconY
                    );
               }

               currentX += iconWidth + iconGap;
          }

          miniGameCtx.font = textFont;
          miniGameCtx.fillText(bodyText || line, currentX, textY);
          miniGameCtx.font = textFont;

          return 1;
     }

     lines.forEach((line) => {
          if (!line.trim()) {
               textY += lineHeight * 0.5;
               return;
          }

          if (sectionHeadings.has(line)) {
               if (line !== "TIPS" && line !== "EFFECTS") {
                    textY += lineHeight;
               }

               drawMenuScreenTitle(line, theme, screenLayout.titleCenterX, textY);
               textY += sectionHeadingHeight + (lineHeight * 0.5);
               return;
          }

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

          if (shouldCenterContent) {
               textY += drawCenteredDetailLine(line, firstSegment, bodyText) * lineHeight;
               return;
          }

          if (hasLeadingIcon) {
               const icon = getRichTextIcon(theme, firstSegment.value);

               if (icon) {
                    const iconSize = getRichTextIconSize(icon, fontSize);
                    const richIconX = iconX + (icon.xOffset || 0);
                    const richIconY = textY + (icon.yOffset || 0);

                    if (!drawTintedRichTextIcon(
                         miniGameCtx,
                         icon,
                         richIconX,
                         richIconY,
                         iconSize,
                         detailStyle.color || colors.fontColor
                    )) {
                         drawGlowingCanvasText(
                              miniGameCtx,
                              icon.particle,
                              richIconX,
                              richIconY,
                              detailStyle.color || colors.fontColor,
                              getTextFont(theme, "buttonsOptions", 400, "body", iconSize),
                              "left",
                              "top",
                              theme,
                              false
                         );
                    }
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
     const showMovementOption = isJoystickEnabled();
     const backRowIndex = showMovementOption ? 2 : 1;

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("OPTIONS", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.hurtRow,
          gameMenuUi.hurtDecreaseButton,
          gameMenuUi.hurtIncreaseButton,
          "DIFFICULTY",
          getDifficultyOptionDescription(hurtLevel),
          hurtLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1,
          maxDifficultyOptionIndex
     );

     if (showMovementOption) {
          drawOptionStepper(
               gameMenuUi.movementRow,
               gameMenuUi.movementDecreaseButton,
               gameMenuUi.movementIncreaseButton,
               "MOVEMENT",
               getShortMovementOptionLabel(movementLevel),
               movementLevel,
               theme,
               focused.row === 1,
               focused.row === 1 ? focused.col : -1,
               getMaxMovementOptionIndex()
          );
     }

     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === backRowIndex);

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
          gameMenuUi.hurtRow,
          gameMenuUi.hurtDecreaseButton,
          gameMenuUi.hurtIncreaseButton,
          "Difficulty",
          getShortDifficultyOptionLabel(hurtLevel),
          hurtLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1,
          maxDifficultyOptionIndex
     );

     drawMenuDetailLines(theme, optionLines, getOptionDescriptionY(layout, 1));
     drawMenuBackButton(gameMenuUi.backButton, theme, focused.row === 1);
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
          getMaxMovementOptionIndex()
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
     let titleFontSize = getWelcomeMarqueeFontSize(theme, titleLines, config);
     const titleLetterSpacing = titleStyle.letterSpacing ?? 0;
     const titleStackGap = titleStyle.stackGap;
     const titleMenuGap = canvasSpacing.menuPadding;
     const resolvedInstructionLines = Array.isArray(instructionLines) ? instructionLines.filter(Boolean) : [];
     const titleContentGap = resolvedInstructionLines.length ? canvasSpacing.uiRowGap : titleMenuGap;
     const instructionGap = resolvedInstructionLines.length ? canvasSpacing.uiRowGap : 0;
     const instructionLineHeight = buttonStyle.fontSize * 1.5;
     const instructionBlockHeight = resolvedInstructionLines.length * instructionLineHeight;
     const instructionMaxWidth = Math.max(120, miniGameWidth - (canvasSpacing.uiPadding * 2));
     const availableStackHeight = Math.max(1, miniGameHeight - (canvasSpacing.uiPadding * 2));
     const websiteActionText = "DEVELOPER";

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
               buttonStyle.buttonPadding
          ) - (buttonStyle.buttonPadding * 2)
     }));

     const actionGap = canvasSpacing.betweenButtons;
     let actionRowGap = canvasSpacing.uiRowGap;
     const tallestButtonHeight = getUnifiedButtonHeight(
          theme,
          buttonStyle.fontSize,
          buttonStyle.buttonPadding
     );
     const maxActionRowWidth = Math.max(120, miniGameWidth - (canvasSpacing.uiPadding * 2));

     function getActionButtonWidth(item) {
          return Math.min(
               maxActionRowWidth,
               item.textWidth + (buttonStyle.buttonPadding * 2)
          );
     }

     function shouldUseFullActionRow(item) {
          return getActionButtonWidth(item) > (maxActionRowWidth / 2);
     }

     function getActionRows() {
          const rows = [];
          let currentRow = [];
          let currentRowWidth = 0;

          measuredActions.forEach((item) => {
               const buttonWidth = getActionButtonWidth(item);
               const isFullRow = shouldUseFullActionRow(item);

               if (isFullRow) {
                    if (currentRow.length) {
                         rows.push(currentRow);
                         currentRow = [];
                         currentRowWidth = 0;
                    }

                    rows.push([item]);
                    return;
               }

               const nextRowWidth = currentRow.length
                    ? currentRowWidth + actionGap + buttonWidth
                    : buttonWidth;

               if (currentRow.length && nextRowWidth > maxActionRowWidth) {
                    rows.push(currentRow);
                    currentRow = [item];
                    currentRowWidth = buttonWidth;
                    return;
               }

               currentRow.push(item);
               currentRowWidth = nextRowWidth;
          });

          if (currentRow.length) {
               rows.push(currentRow);
          }

          return rows;
     }

     const actionRows = getActionRows().filter((row) => row.length);
     let actionBlockHeight =
          (actionRows.length * tallestButtonHeight) +
          (actionRowGap * Math.max(0, actionRows.length - 1));

     let titleBlockHeight =
          titleFontSize +
          ((titleLines.length - 1) * (titleFontSize + titleStackGap));

     let totalTitleBlockHeight =
          titleBlockHeight +
          titleContentGap +
          instructionBlockHeight +
          instructionGap +
          actionBlockHeight;

     while (totalTitleBlockHeight > availableStackHeight && titleFontSize > titleStyle.minSize) {
          titleFontSize = Math.max(titleStyle.minSize, titleFontSize - (titleStyle.shrinkStep || 2));
          titleBlockHeight =
               titleFontSize +
               ((titleLines.length - 1) * (titleFontSize + titleStackGap));
          totalTitleBlockHeight =
               titleBlockHeight +
               titleContentGap +
               instructionBlockHeight +
               instructionGap +
               actionBlockHeight;
     }

     if (totalTitleBlockHeight > availableStackHeight) {
          actionRowGap = Math.max(2, actionRowGap / 2);
          actionBlockHeight =
               (actionRows.length * tallestButtonHeight) +
               (actionRowGap * Math.max(0, actionRows.length - 1));
          totalTitleBlockHeight =
               titleBlockHeight +
               titleContentGap +
               instructionBlockHeight +
               instructionGap +
               actionBlockHeight;
     }

     const titleCenterY = miniGameHeight / 2;
     const stackTopY = Math.max(
          canvasSpacing.uiPadding,
          titleCenterY -
          (totalTitleBlockHeight / 2)
     );

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

     if (resolvedInstructionLines.length) {
          const instructionY =
               stackTopY +
               titleBlockHeight +
               titleContentGap +
               (buttonStyle.fontSize / 2);

          resolvedInstructionLines.forEach((line, lineIndex) => {
               drawGlowingCanvasText(
                    miniGameCtx,
                    line,
                    miniGameWidth / 2,
                    instructionY + (lineIndex * instructionLineHeight),
                    buttonStyle.color,
                    getFittedTextFont(theme, "buttonsOptions", line, instructionMaxWidth, 400),
                    "center",
                    "middle",
                    theme,
                    buttonStyle.glow
               );
          });
     }

     const firstActionY =
          stackTopY +
          titleBlockHeight +
          titleContentGap +
          instructionBlockHeight +
          instructionGap +
          (tallestButtonHeight / 2);

     actionRows.forEach((rowActions, rowIndex) => {
          const actionY = firstActionY + (rowIndex * (tallestButtonHeight + actionRowGap));
          const totalActionWidth =
               rowActions.reduce((sum, item) => sum + getActionButtonWidth(item), 0) +
               (actionGap * Math.max(0, rowActions.length - 1));
          let currentX = (miniGameWidth - totalActionWidth) / 2;

          rowActions.forEach((item) => {
               const buttonWidth = getActionButtonWidth(item);
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

               if (item.text === "NEW GAME" && actionUi.newGameButton) {
                    setButtonBounds(actionUi.newGameButton, buttonX, buttonY, buttonWidth, buttonHeight);
               }

               if (item.text === "TIPS") {
                    setButtonBounds(actionUi.tipsButton, buttonX, buttonY, buttonWidth, buttonHeight);
               }

               if (item.text === "EFFECTS" && actionUi.effectsButton) {
                    setButtonBounds(actionUi.effectsButton, buttonX, buttonY, buttonWidth, buttonHeight);
               }

               if (item.text === "OPTIONS") {
                    setButtonBounds(actionUi.menuButton, buttonX, buttonY, buttonWidth, buttonHeight);
               }

               if (item.text === websiteActionText) {
                    setButtonBounds(actionUi.returnButton, buttonX, buttonY, buttonWidth, buttonHeight);
               }

               currentX += buttonWidth + actionGap;
          });
     });

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
               "EFFECTS": 2,
               "OPTIONS": 3,
               "DEVELOPER": 4
          },
          alpha,
          !isWelcomeScreen,
          []
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
               "NEW GAME": 1,
               "TIPS": 2,
               "EFFECTS": 3,
               "OPTIONS": 4,
               "DEVELOPER": 5
          },
          1,
          true
     );
}

function drawRoundIntroOverlay(theme) {
     if (!miniGameCtx || !isRoundIntroActive()) {
          return;
     }

     const { screens } = theme;
     const introLines = getRoundIntroLines();
     const alpha = getRoundIntroAlpha();
     const fontSize = getWelcomeMarqueeFontSize(theme, introLines, screens.paused);
     const lineGap = fontSize * 0.45;
     const totalHeight =
          (introLines.length * fontSize) +
          (Math.max(0, introLines.length - 1) * lineGap);
     const startY = (miniGameHeight / 2) - (totalHeight / 2) + (fontSize / 2);

     miniGameCtx.save();
     miniGameCtx.globalAlpha = alpha;
     miniGameCtx.fillStyle = screens.paused.overlayFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);
     miniGameCtx.restore();

     introLines.forEach((line, index) => {
          drawCenteredMarqueeText(
               theme,
               line,
               miniGameWidth / 2,
               startY + (index * (fontSize + lineGap)),
               fontSize,
               alpha,
               true
          );
     });
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

function drawCenteredMarqueeText(theme, text, x, y, fontSize, alpha, isRainbow = true) {
     if (!miniGameCtx || !text) {
          return;
     }

     const styleName = "marquee";
     const textStyle = getTextStyle(theme, styleName);
     const letterSpacing = textStyle.letterSpacing ?? 0;
     const font = getTextFont(theme, styleName, 400, null, fontSize);
     const graphemes = typeof Intl !== "undefined" && Intl.Segmenter
          ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (segment) => segment.segment)
          : Array.from(text);
     const letterWidths = [];

     miniGameCtx.font = font;

     for (let i = 0; i < graphemes.length; i += 1) {
          letterWidths.push(miniGameCtx.measureText(graphemes[i]).width);
     }

     const totalWidth =
          letterWidths.reduce((sum, width) => sum + width, 0) +
          (letterSpacing * Math.max(0, graphemes.length - 1));
     let currentX = x - (totalWidth / 2);

     miniGameCtx.save();
     miniGameCtx.globalAlpha = alpha;

     for (let i = 0; i < graphemes.length; i += 1) {
          const letter = graphemes[i];

          drawGlowingCanvasText(
               miniGameCtx,
               letter,
               currentX,
               y,
               isRainbow ? getTextColor(theme, styleName, i) : getCssColor("--color-white", "#fff"),
               font,
               "left",
               "middle",
               theme,
               true
          );

          currentX += letterWidths[i] + letterSpacing;
     }

     miniGameCtx.restore();
}

function drawGameplayPopup(theme) {
     if (!miniGameCtx || !gameplayPopupText || gameMenuOpen || gameOver || gameWon) {
          return;
     }

     const popupAlpha = getGameplayPopupAlpha();

     if (popupAlpha <= 0) {
          return;
     }

     const marqueeStyle = getTextStyle(theme, "marquee");
     const fontSize = marqueeStyle.fontSize || theme.sizes.uiFontLg;
     const isLevelPopup = gameplayPopupText === "Lvl Up!";
     const y = Math.min(
          miniGameHeight - fontSize,
          miniGameHeight * 0.78
     );

     drawCenteredMarqueeText(theme, gameplayPopupText, miniGameWidth / 2, y, fontSize, popupAlpha, isLevelPopup);
}

// ==================================================
// NOTE: MASTER DRAW ENTRY
// ==================================================

export function drawGame() {
     // Draw order pseudocode:
     // 1. Paint the background and apply the selected color mode.
     // 2. If welcome is active, draw only that screen and exit.
     // 3. Draw gameplay entities from back to front.
     // 4. Draw menus/overlays, then keep gameplay HUD on top when no menu is open.
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
          drawStars();
          drawStrikes();
          drawHelphurtPickups();
          drawCollisionBursts();
          drawPlayerTrail();
          drawPlayer();

          drawFogOverlay();

          drawGameplayPopup(theme);
     }

     if (gameMenuOpen) {
          if (gameMenuView === "tips") {
               drawTipsMenuScreen(theme);
          } else if (gameMenuView === "effects") {
               drawEffectsMenuScreen(theme);
          } else if (gameMenuView === "options") {
               drawOptionsScreen(theme);
          }
     } else if (gamePaused && !gameOver && !gameWon) {
          drawPausedOverlay(theme);
     } else if (isRoundIntroActive()) {
          drawRoundIntroOverlay(theme);
     } else if (isOverlayScreenActive()) {
          drawGameWelcomeOverlay(theme);
     } else {
          drawGameStatusOverlay(theme);
     }

     if (gameStarted && !gameMenuOpen) {
          drawHudBadges(theme);
          drawLevelProgressStars(theme);

          if (!gamePaused && !gameOver && !gameWon) {
               drawJoystick(theme);
          }
     }

     resetCanvasColorModeFilter();
     updateCanvasCursor();
}
