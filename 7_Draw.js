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
     starScore,
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
     blightLevel,
     movementLevel,
     colorLevel,
     screenActionUi,
     pausedActionUi,
     welcomeSelectionIndex,
     pausedSelectionIndex,
     tipsSelectionIndex,
     optionsSelection,
     gameMenuScroll,
     getMenuKeyboardFocusAlpha,
     isBoostblightActive,
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
     resetActionButtonBounds,
     getLevelMeterPulseScale,
     getHealthMeterPulseScale
} from "./3_State.js";

import {
     maxOptionLevelIndex,
     getMaxMovementOptionIndex,
     maxColorOptionIndex,
     maxVisibleHearts,
     movementOptionIndexes,
     isJoystickEnabled,
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
     drawStars,
     drawStrikes,
     drawBoostblightPickups,
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
} from "./8_Entities.js";

import {
     getCurrentLevelMeterUnits,
     maxLevelProgressUnits,
     progressUnitsPerCircle,
     getCurrentScreenActionTexts,
     getCurrentPausedActionTexts,
     getWelcomeInstructionLines,
     getHowToPlayLines,
     getBoostLines,
     getblightLines,
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
     getLevelPopupSubtext,
     getLevelPopupIcon,
     getLevelPopupAlpha,
     getGameOverlayAlpha
} from "./2_GameEngine.js";

const siteTheme = window.SiteTheme;
const pauseButtonIcon = new Image();
pauseButtonIcon.src = "./images/icons/not-started.svg";
const stepperLeftIcon = new Image();
stepperLeftIcon.src = "./images/icons/chevron-left.svg";
const stepperRightIcon = new Image();
stepperRightIcon.src = "./images/icons/chevron-right.svg";
const circleMeterAssetImages = {};
const richTextIconAssetImages = {};

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
               return buttons;
          }

          if (gameMenuView === "options") {
               if (blightLevel > 0) {
                    buttons.push(gameMenuUi.blightDecreaseButton);
               }

               if (blightLevel < maxOptionLevelIndex) {
                    buttons.push(gameMenuUi.blightIncreaseButton);
               }

               if (isJoystickEnabled() && movementLevel > 0) {
                    buttons.push(gameMenuUi.movementDecreaseButton);
               }

               if (isJoystickEnabled() && movementLevel < getMaxMovementOptionIndex()) {
                    buttons.push(gameMenuUi.movementIncreaseButton);
               }

               if (colorLevel > 0) {
                    buttons.push(gameMenuUi.colorDecreaseButton);
               }

               if (colorLevel < maxColorOptionIndex) {
                    buttons.push(gameMenuUi.colorIncreaseButton);
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

     if (gameMenuView === "tips") {
          setButtonBounds(gameMenuUi.tipsHowToPlayButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.tipsBoostsButton, 0, 0, 0, 0);

          return;
     }

     if (gameMenuView === "options") {
          const sliderRowHeight = layout.buttonHeight * 2;
          const optionsBodyGap = getTextStyle(theme, "canvasSpacing").bodyLineHeight;
          const showMovementOption = isJoystickEnabled();
          const optionRows = [
               {
                    row: gameMenuUi.blightRow,
                    decreaseButton: gameMenuUi.blightDecreaseButton,
                    increaseButton: gameMenuUi.blightIncreaseButton
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

          optionRows.push({
               row: gameMenuUi.colorRow,
               decreaseButton: gameMenuUi.colorDecreaseButton,
               increaseButton: gameMenuUi.colorIncreaseButton
          });

          setButtonBounds(gameMenuUi.optionsDifficultyButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.optionsAudioButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.optionsMovementButton, 0, 0, 0, 0);
          setButtonBounds(gameMenuUi.optionsColorButton, 0, 0, 0, 0);

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
          gameMenuView !== "options_audio" &&
          gameMenuView !== "options_movement" &&
          gameMenuView !== "options_color"
     ) {
          return;
     }

     if (gameMenuView === "options_difficulty") {
          setOptionRowBounds(
               gameMenuUi.blightRow,
               gameMenuUi.blightDecreaseButton,
               gameMenuUi.blightIncreaseButton,
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

function getShortOptionLevelLabel(levelIndex) {
     return getOptionLevelLabel(levelIndex).toUpperCase();
}

function getDifficultyOptionDescription(levelIndex) {
     return getDifficultyOptionLines()[levelIndex] || getShortOptionLevelLabel(levelIndex);
}

function getShortMovementOptionLabel(levelIndex) {
     const labels = ["Click / Arrows", "Joystick Left", "Joystick Right"];

     return labels[levelIndex] || getMovementOptionLabel(levelIndex).toUpperCase();
}

function getShortColorOptionLabel(levelIndex) {
     const labels = ["Bright", "Pastel", "Monochrome"];

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
     const centerX = button.x + (button.width / 2);
     const centerY = button.y + (button.height / 2);
     const cornerRadius = getControlCornerRadius(theme, button.width, button.height);
     const borderWidth = theme.sizes.borderWidthFocus || theme.sizes.borderWidth || 1;

     miniGameCtx.save();

     const focusAlpha = getMenuKeyboardFocusAlpha();

     if (isFocused && focusAlpha > 0) {
          miniGameCtx.globalAlpha *= focusAlpha;
          fillRoundedControlRect(button.x, button.y, button.width, button.height, cornerRadius, colors.menuPanelFill);
     }

     strokeRoundedControlRect(button.x, button.y, button.width, button.height, cornerRadius, borderWidth, getCssColor("--color-white", "#ffffff"));

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
          fillRoundedControlRect(row.x, row.y, row.width, row.height, cornerRadius, colors.menuPanelFill);
     }

     strokeRoundedControlRect(row.x, row.y, row.width, row.height, cornerRadius, borderWidth, getCssColor("--color-white", "#ffffff"));

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

function drawPauseButtonIcon(button, theme) {
     if (!miniGameCtx || !button) {
          return;
     }

     const { colors } = theme;
     const buttonStyle = getTextStyle(theme, "pauseButton");
     const iconSize = Math.min(button.width, button.height) * (buttonStyle.iconScale || 0.62);
     const iconX = button.x + ((button.width - iconSize) / 2);
     const iconY = button.y + ((button.height - iconSize) / 2);

     if (pauseButtonIcon.complete && pauseButtonIcon.naturalWidth > 0) {
          miniGameCtx.drawImage(pauseButtonIcon, iconX, iconY, iconSize, iconSize);
          return;
     }

     drawGlowingCanvasText(
          miniGameCtx,
          "\u23EF\uFE0E",
          button.x + (button.width / 2),
          button.y + (button.height / 2) + 1,
          buttonStyle.color || colors.touchText,
          getTextFont(theme, "pauseButton", 400),
          "center",
          "middle",
          theme,
          false
     );
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

function getCircleMeterAssetSrc(circleMeterStyle, filledUnits) {
     if (filledUnits >= progressUnitsPerCircle) {
          return circleMeterStyle.fullAssetSrc;
     }

     if (filledUnits > 0) {
          return circleMeterStyle.halfAssetSrc;
     }

     return circleMeterStyle.emptyAssetSrc;
}

function getCircleMeterAssetImage(assetSrc) {
     if (!assetSrc) {
          return null;
     }

     if (!circleMeterAssetImages[assetSrc]) {
          const image = new Image();
          image.src = assetSrc;
          circleMeterAssetImages[assetSrc] = image;
     }

     return circleMeterAssetImages[assetSrc];
}

function drawCircleMeterSlot(ctx, circleMeterStyle, filledUnits, x, y, options = {}) {
     const assetImage = getCircleMeterAssetImage(getCircleMeterAssetSrc(circleMeterStyle, filledUnits));

     if (assetImage?.complete && assetImage.naturalWidth > 0) {
          const iconSize = circleMeterStyle.fontSize * (circleMeterStyle.assetScale || 1);

          if (options.rotateHalf && filledUnits > 0 && filledUnits < progressUnitsPerCircle) {
               ctx.save();
               ctx.translate(x, y + (iconSize / 2));
               ctx.rotate(Math.PI);
               ctx.drawImage(assetImage, -(iconSize / 2), -(iconSize / 2), iconSize, iconSize);
               ctx.restore();
               return;
          }

          ctx.drawImage(assetImage, x - (iconSize / 2), y, iconSize, iconSize);
     }
}

function getCircleMeterInkMetrics(circleMeterStyle) {
     const iconSize = circleMeterStyle.fontSize * (circleMeterStyle.assetScale || 1);

     return {
          left: -(iconSize / 2),
          right: iconSize / 2,
          top: 0,
          bottom: iconSize
     };
}

function drawActiveHudBox(theme, x, y, width, height, side = "left", edge = "top") {
     const { colors } = theme;
     const borderWidth = theme.sizes.borderWidthFocus || theme.sizes.borderWidth || 1;
     const cornerRadius = Math.min(getControlCornerRadius(theme, width, height), height * 0.18);
     const isRightSide = side === "right";
     const isBottomEdge = edge === "bottom";
     const innerX = isRightSide ? x : x + width;
     const outerX = isRightSide ? x + width : x;
     const innerCornerX = isRightSide ? x + cornerRadius : x + width - cornerRadius;
     const bottomY = y + height;
     const strokeInnerX = innerX - (isRightSide ? -borderWidth / 2 : borderWidth / 2);
     const strokeCornerX = innerCornerX + (isRightSide ? borderWidth / 2 : -borderWidth / 2);

     miniGameCtx.save();
     miniGameCtx.shadowBlur = 0;
     miniGameCtx.fillStyle = colors.menuPanelFill;
     miniGameCtx.beginPath();

     if (isBottomEdge) {
          miniGameCtx.moveTo(outerX, bottomY);
          miniGameCtx.lineTo(innerX, bottomY);
          miniGameCtx.lineTo(innerX, y + cornerRadius);
          miniGameCtx.quadraticCurveTo(innerX, y, innerCornerX, y);
          miniGameCtx.lineTo(outerX, y);
     } else {
          miniGameCtx.moveTo(outerX, y);
          miniGameCtx.lineTo(innerX, y);
          miniGameCtx.lineTo(innerX, bottomY - cornerRadius);
          miniGameCtx.quadraticCurveTo(innerX, bottomY, innerCornerX, bottomY);
          miniGameCtx.lineTo(outerX, bottomY);
     }

     miniGameCtx.closePath();
     miniGameCtx.fill();

     miniGameCtx.strokeStyle = getCssColor("--color-white", "#ffffff");
     miniGameCtx.lineWidth = borderWidth;
     miniGameCtx.beginPath();

     if (isBottomEdge) {
          miniGameCtx.moveTo(strokeInnerX, bottomY);
          miniGameCtx.lineTo(strokeInnerX, y + cornerRadius);
          miniGameCtx.quadraticCurveTo(strokeInnerX, y + (borderWidth / 2), strokeCornerX, y + (borderWidth / 2));
          miniGameCtx.lineTo(outerX, y + (borderWidth / 2));
     } else {
          miniGameCtx.moveTo(strokeInnerX, y);
          miniGameCtx.lineTo(strokeInnerX, bottomY - cornerRadius);
          miniGameCtx.quadraticCurveTo(strokeInnerX, bottomY - (borderWidth / 2), strokeCornerX, bottomY - (borderWidth / 2));
          miniGameCtx.lineTo(outerX, bottomY - (borderWidth / 2));
     }

     miniGameCtx.stroke();
     miniGameCtx.restore();
}

export function drawScore(theme) {
     if (!miniGameCtx) {
          return;
     }

     const { colors } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const circleMeterStyle = getTextStyle(theme, "circleMeters");
     const levelStatusStyle = getTextStyle(theme, "levelStatus");
     const scoreReadyStyle = getTextStyle(theme, "scoreReady");
     const levelText = "LEVELS";
     const starText = String(starScore).padStart(3, "0");
     const levelMeterUnits = getCurrentLevelMeterUnits();

     miniGameCtx.save();
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     const circleAdvance =
          (circleMeterStyle.fontSize * circleMeterStyle.advanceScale) +
          (circleMeterStyle.letterSpacing || 0);
     const circleSlots = maxLevelProgressUnits / progressUnitsPerCircle;
     const panelPadding = canvasSpacing.uiPadding;
     const panelX = 0;
     const circleInkMetrics = getCircleMeterInkMetrics(circleMeterStyle);
     const meterWidth =
          ((circleSlots - 1) * circleAdvance) +
          circleInkMetrics.right -
          circleInkMetrics.left;
     const panelContentHeight =
          panelPadding +
          levelStatusStyle.fontSize +
          canvasSpacing.circleTitleGap +
          circleInkMetrics.bottom -
          circleInkMetrics.top +
          canvasSpacing.uiRowGap +
          scoreReadyStyle.fontSize +
          panelPadding;

     miniGameCtx.font = getTextFont(theme, "scoreReady", 400);
     const scoreRowWidth = miniGameCtx.measureText(starText).width;
     miniGameCtx.font = getTextFont(theme, "levelStatus", 400);
     const levelTextWidth =
          miniGameCtx.measureText(levelText).width +
          ((levelStatusStyle.letterSpacing || 0) * Math.max(0, levelText.length - 1));
     const panelWidth = Math.max(levelTextWidth, meterWidth, scoreRowWidth) + (panelPadding * 2);
     const panelHeight = panelContentHeight;
     const panelY = miniGameHeight - panelHeight;
     const panelCenterX = panelX + (panelWidth / 2);
     const levelY = panelY + panelPadding;
     const meterY = levelY + levelStatusStyle.fontSize + canvasSpacing.circleTitleGap - circleInkMetrics.top;
     const starY = meterY + circleInkMetrics.bottom + canvasSpacing.uiRowGap;

     drawActiveHudBox(theme, panelX, panelY, panelWidth, panelHeight, "left", "bottom");

     drawStyledCanvasText(
          miniGameCtx,
          levelText,
          panelCenterX,
          levelY,
          "levelStatus",
          theme,
          {
               color: levelStatusStyle.color || colors.meterFull,
               align: "center",
               baseline: "top"
          }
     );

     miniGameCtx.save();
     miniGameCtx.translate(panelCenterX, meterY);
     miniGameCtx.scale(getLevelMeterPulseScale(), getLevelMeterPulseScale());
     miniGameCtx.textAlign = "center";

     for (let i = 0; i < circleSlots; i += 1) {
          const slotUnits = Math.max(0, Math.min(progressUnitsPerCircle, levelMeterUnits - (i * progressUnitsPerCircle)));
          const circleX = (i - ((circleSlots - 1) / 2)) * circleAdvance;

          drawCircleMeterSlot(miniGameCtx, circleMeterStyle, slotUnits, circleX, 0);
     }

     miniGameCtx.restore();

     drawGlowingCanvasText(
          miniGameCtx,
          starText,
          panelCenterX,
          starY,
          scoreReadyStyle.color || colors.meterFull,
          getTextFont(theme, "scoreReady", 400),
          "center",
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

     const { colors } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const circleMeterStyle = getTextStyle(theme, "circleMeters");
     const levelStatusStyle = getTextStyle(theme, "levelStatus");
     const scoreReadyStyle = getTextStyle(theme, "scoreReady");
     const statusTitle = "STATUS";
     const statusLabel = activeStatusUi.label || "READY";
     const statusSeconds = getStatusSecondsRemaining();

     miniGameCtx.save();
     miniGameCtx.textAlign = "left";
     miniGameCtx.textBaseline = "top";
     const circleAdvance =
          (circleMeterStyle.fontSize * circleMeterStyle.advanceScale) +
          (circleMeterStyle.letterSpacing || 0);
     const healthUnits = playerHealth;
     const maxHealthUnits = maxVisibleHearts * progressUnitsPerCircle;
     const circleSlots = maxHealthUnits / progressUnitsPerCircle;
     const circleInkMetrics = getCircleMeterInkMetrics(circleMeterStyle);
     const panelPadding = canvasSpacing.uiPadding;
     const meterWidth =
          ((circleSlots - 1) * circleAdvance) +
          circleInkMetrics.right -
          circleInkMetrics.left;
     const detailLineHeight = scoreReadyStyle.fontSize;
     const hasStatusSeconds = Boolean(statusSeconds);
     const statusSecondsHeight = hasStatusSeconds
          ? scoreReadyStyle.fontSize + canvasSpacing.uiRowGap
          : 0;
     const statusLabelWidth = (() => {
          miniGameCtx.font = getTextFont(theme, "scoreReady", 400);
          return miniGameCtx.measureText(statusLabel).width;
     })();
     const statusRowWidth = statusLabelWidth;
     miniGameCtx.font = getTextFont(theme, "levelStatus", 400);
     const statusTitleWidth =
          miniGameCtx.measureText(statusTitle).width +
          ((levelStatusStyle.letterSpacing || 0) * Math.max(0, statusTitle.length - 1));
     const panelWidth = Math.max(statusTitleWidth, meterWidth, statusRowWidth) + (panelPadding * 2);
     const panelX = miniGameWidth - panelWidth;
     const panelCenterX = panelX + (panelWidth / 2);
     const panelHeight =
          panelPadding +
          levelStatusStyle.fontSize +
          canvasSpacing.circleTitleGap +
          circleInkMetrics.bottom -
          circleInkMetrics.top +
          canvasSpacing.uiRowGap +
          detailLineHeight +
          statusSecondsHeight +
          panelPadding;
     const panelY = miniGameHeight - panelHeight;
     const statusTitleY = panelY + panelPadding;
     const meterY = statusTitleY + levelStatusStyle.fontSize + canvasSpacing.circleTitleGap - circleInkMetrics.top;
     const statusDetailY = meterY + circleInkMetrics.bottom + canvasSpacing.uiRowGap;

     drawActiveHudBox(theme, panelX, panelY, panelWidth, panelHeight, "right", "bottom");

     drawStyledCanvasText(
          miniGameCtx,
          statusTitle,
          panelCenterX,
          statusTitleY,
          "levelStatus",
          theme,
          {
               color: levelStatusStyle.color || colors.statusText,
               align: "center",
               baseline: "top"
          }
     );

     miniGameCtx.save();
     miniGameCtx.translate(panelCenterX, meterY);
     miniGameCtx.scale(getHealthMeterPulseScale(), getHealthMeterPulseScale());
     miniGameCtx.textAlign = "center";

     for (let i = 0; i < circleSlots; i += 1) {
          const fillIndex = circleSlots - 1 - i;
          const slotUnits = Math.max(0, Math.min(progressUnitsPerCircle, healthUnits - (fillIndex * progressUnitsPerCircle)));
          const circleX = (i - ((circleSlots - 1) / 2)) * circleAdvance;

          drawCircleMeterSlot(miniGameCtx, circleMeterStyle, slotUnits, circleX, 0, { rotateHalf: true });
     }

     miniGameCtx.restore();

     drawGlowingCanvasText(
          miniGameCtx,
          statusLabel,
          panelCenterX,
          statusDetailY,
          scoreReadyStyle.color || colors.statusText,
          getTextFont(theme, "scoreReady", 400),
          "center",
          "top",
          theme,
          scoreReadyStyle.glow
     );

     if (statusSeconds) {
          const statusSecondsY = statusDetailY + scoreReadyStyle.fontSize + canvasSpacing.uiRowGap;

          drawGlowingCanvasText(
               miniGameCtx,
               statusSeconds,
               panelCenterX,
               statusSecondsY,
               scoreReadyStyle.color || colors.statusText,
               getTextFont(theme, "scoreReady", 400),
               "center",
               "top",
               theme,
               scoreReadyStyle.glow
          );
     }

     miniGameCtx.restore();
}

export function drawFogOverlay() {
     if (!miniGameCtx || !isBoostblightActive("fog")) {
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

     const button = touchControls.pauseButton;

     if (!button) {
          return;
     }

     drawPauseButtonIcon(button, theme);
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

     const { colors } = theme;
     const layout = getMenuScreenLayout(theme);
     const lines = [
          "TIPS",
          ...getHowToPlayLines(),
          "",
          "BOOSTS",
          ...getBoostLines(),
          "",
          "blightS",
          ...getblightLines()
     ];

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

     if (scrollMax > 0 && viewportHeight > 0) {
          const scrollbarWidth = theme.sizes.borderWidthFocus || theme.sizes.borderWidth || 1;
          const scrollbarX = miniGameWidth - layout.sidePadding + (scrollbarWidth / 2);
          const thumbHeight = Math.max(viewportHeight * (viewportHeight / contentHeight), viewportHeight * 0.2);
          const thumbTravel = viewportHeight - thumbHeight;
          const thumbY = viewportTop + (thumbTravel * (gameMenuScroll.offset / scrollMax));

          miniGameCtx.save();
          miniGameCtx.globalAlpha = 0.7;
          miniGameCtx.strokeStyle = colors.fontColor;
          miniGameCtx.lineWidth = scrollbarWidth;
          miniGameCtx.beginPath();
          miniGameCtx.moveTo(scrollbarX, thumbY);
          miniGameCtx.lineTo(scrollbarX, thumbY + thumbHeight);
          miniGameCtx.stroke();
          miniGameCtx.restore();
     }

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
     const sectionHeadings = new Set(["TIPS", "BOOSTS", "blightS"]);
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
               if (line !== "TIPS") {
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
     const colorRowIndex = showMovementOption ? 2 : 1;
     const backRowIndex = showMovementOption ? 3 : 2;

     miniGameCtx.save();
     miniGameCtx.fillStyle = colors.menuScreenFill;
     miniGameCtx.fillRect(0, 0, miniGameWidth, miniGameHeight);

     drawMenuScreenTitle("OPTIONS", theme, layout.titleCenterX, layout.titleY);

     drawOptionStepper(
          gameMenuUi.blightRow,
          gameMenuUi.blightDecreaseButton,
          gameMenuUi.blightIncreaseButton,
          "DIFFICULTY",
          getDifficultyOptionDescription(blightLevel),
          blightLevel,
          theme,
          focused.row === 0,
          focused.row === 0 ? focused.col : -1
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

     drawOptionStepper(
          gameMenuUi.colorRow,
          gameMenuUi.colorDecreaseButton,
          gameMenuUi.colorIncreaseButton,
          "COLOR",
          getShortColorOptionLabel(colorLevel),
          colorLevel,
          theme,
          focused.row === colorRowIndex,
          focused.row === colorRowIndex ? focused.col : -1,
          maxColorOptionIndex
     );

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
          gameMenuUi.blightRow,
          gameMenuUi.blightDecreaseButton,
          gameMenuUi.blightIncreaseButton,
          "Difficulty",
          getShortOptionLevelLabel(blightLevel),
          blightLevel,
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
          getMaxMovementOptionIndex()
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
     const titleContentGap = resolvedInstructionLines.length ? canvasSpacing.uiRowGap : titleMenuGap;
     const instructionGap = resolvedInstructionLines.length ? canvasSpacing.uiRowGap : 0;
     const instructionLineHeight = buttonStyle.fontSize * 1.5;
     const instructionBlockHeight = resolvedInstructionLines.length * instructionLineHeight;
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

     function getActionRows() {
          if (miniGameWidth > 520) {
               return [measuredActions];
          }

          if (actionTexts[0] === "RESUME") {
               return [
                    measuredActions.slice(0, 2),
                    measuredActions.slice(2, 4),
                    measuredActions.slice(4)
               ];
          }

          return [
               measuredActions.slice(0, 3),
               measuredActions.slice(3)
          ];
     }

     const actionGap = canvasSpacing.betweenButtons;
     const actionRowGap = canvasSpacing.uiRowGap;
     const tallestButtonHeight = getUnifiedButtonHeight(
          theme,
          buttonStyle.fontSize,
          buttonStyle.buttonPadding
     );
     const actionRows = getActionRows().filter((row) => row.length);
     const actionBlockHeight =
          (actionRows.length * tallestButtonHeight) +
          (actionRowGap * Math.max(0, actionRows.length - 1));

     const titleBlockHeight =
          titleFontSize +
          ((titleLines.length - 1) * (titleFontSize + titleStackGap));

     const totalTitleBlockHeight =
          titleBlockHeight +
          titleContentGap +
          instructionBlockHeight +
          instructionGap +
          actionBlockHeight;

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
                    getTextFont(theme, "buttonsOptions", 400),
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
               rowActions.reduce((sum, item) => sum + item.textWidth + (buttonStyle.buttonPadding * 2), 0) +
               (actionGap * Math.max(0, rowActions.length - 1));
          let currentX = (miniGameWidth - totalActionWidth) / 2;

          rowActions.forEach((item) => {
               const buttonWidth = item.textWidth + (buttonStyle.buttonPadding * 2);
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
               "OPTIONS": 2,
               "DEVELOPER": 3
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
               "NEW GAME": 1,
               "TIPS": 2,
               "OPTIONS": 3,
               "DEVELOPER": 4
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
     const popupSubtext = getLevelPopupSubtext();
     const popupIconName = getLevelPopupIcon();
     const alpha = getLevelPopupAlpha();

     if (!miniGameCtx || !popupText || alpha <= 0 || gameMenuOpen || gameOver || gameWon) {
          return;
     }

     const { colors } = theme;
     const canvasSpacing = getTextStyle(theme, "canvasSpacing");
     const titleStyle = getTextStyle(theme, "title");
     const subtextStyle = getTextStyle(theme, "scoreReady");
     const panelPadding = canvasSpacing.uiPadding;
     const gapBetweenLines = popupSubtext ? canvasSpacing.uiRowGap : 0;
     const titleIcon = popupIconName ? getRichTextIcon(theme, popupIconName) : null;
     const titleIconSize = titleIcon ? getRichTextIconSize(titleIcon, titleStyle.fontSize) : 0;
     const titleIconGap = titleIcon ? canvasSpacing.betweenButtons : 0;

     miniGameCtx.save();
     miniGameCtx.globalAlpha = alpha;
     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";
     miniGameCtx.font = getTextFont(theme, "title", 400);

     const titleWidth = miniGameCtx.measureText(popupText).width;
     const fullTitleWidth = titleWidth + titleIconSize + titleIconGap;
     let subtextWidth = 0;

     if (popupSubtext) {
          miniGameCtx.font = getTextFont(theme, "scoreReady", 400);
          subtextWidth = miniGameCtx.measureText(popupSubtext).width;
     }

     const panelWidth = Math.max(fullTitleWidth, subtextWidth) + (panelPadding * 2);
     const panelHeight =
          titleStyle.fontSize +
          (popupSubtext ? subtextStyle.fontSize + gapBetweenLines : 0) +
          (panelPadding * 2);
     const popupY = Math.min(
          miniGameHeight - (panelHeight / 2) - panelPadding,
          Math.max(miniGameHeight * 0.75 + (panelHeight / 2), miniGameHeight * 0.875)
     );
     const panelX = (miniGameWidth - panelWidth) / 2;
     const panelY = popupY - (panelHeight / 2);
     const titleY = popupSubtext
          ? popupY - ((subtextStyle.fontSize + gapBetweenLines) / 2)
          : popupY;
     const subtextY = titleY + (titleStyle.fontSize / 2) + gapBetweenLines + (subtextStyle.fontSize / 2);

     drawPanelBox(panelX, panelY, panelWidth, panelHeight, theme);

     const titleStartX = (miniGameWidth - fullTitleWidth) / 2;

     if (titleIcon) {
          const iconX = titleStartX + (titleIcon.xOffset || 0);
          const iconY =
               titleY -
               (titleIconSize / 2) +
               (titleIcon.yOffset || 0);

          if (!drawTintedRichTextIcon(
               miniGameCtx,
               titleIcon,
               iconX,
               iconY,
               titleIconSize,
               titleStyle.color || colors.fontColor
          )) {
               drawGlowingCanvasText(
                    miniGameCtx,
                    titleIcon.particle,
                    iconX,
                    titleY,
                    titleStyle.color || colors.fontColor,
                    getTextFont(theme, "title", 400, "body", titleIconSize),
                    "left",
                    "middle",
                    theme,
                    titleStyle.glow
               );
          }
     }

     drawGlowingCanvasText(
          miniGameCtx,
          popupText,
          titleStartX + titleIconSize + titleIconGap,
          titleY,
          titleStyle.color || colors.fontColor,
          getTextFont(theme, "title", 400),
          "left",
          "middle",
          theme,
          titleStyle.glow
     );

     if (popupSubtext) {
          drawGlowingCanvasText(
               miniGameCtx,
               popupSubtext,
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
          drawStars();
          drawStrikes();
          drawBoostblightPickups();
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
          } else if (gameMenuView === "options") {
               drawOptionsScreen(theme);
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
