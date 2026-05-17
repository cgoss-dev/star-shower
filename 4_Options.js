// NOTE: 4_Options
// Player-facing settings, persistence helpers, and shared tunables for Star Shower.
//
// Owned here:
// - saved options / localStorage keys
// - option metadata for Music / Sound FX / Difficulty
// - shared tunables that are configuration, not runtime state
// - reusable measurement / layout helpers shared by canvas UI
// - helpers for loading/saving persistent settings
//
// NOT owned here:
// - mutable runtime state
// - game loop logic
// - rendering implementation
//
// Newbie note:
// - This file should answer "what settings exist?"
//   and "what reusable numbers should the rest of the game agree on?"
// - If code changes every frame, it belongs in `3_State.js` or gameplay files.
// - If code draws pixels, it belongs in `7_Draw.js`.
// - If code maps CSS into the canvas theme object, it belongs in `9_Config.js`.

import {
     miniGameCtx,
     miniGameWidth,
     miniGameHeight,
     musicLevel,
     soundEffectsLevel,
     baneLevel,
     movementLevel,
     colorLevel,
     setMusicLevel,
     setSoundEffectsLevel,
     setBaneLevel,
     setMovementLevel,
     setColorLevel
} from "./3_State.js";

import {
     getCssBoolean
} from "./9_Config.js";

// ==================================================
// STORAGE
// ==================================================

export const configStorageKeys = {
     options: "star-shower-options"
};

// ==================================================
// OPTION DEFINITIONS
// ==================================================

export const optionLevelLabels = ["Off", "Min", "Low", "Med", "Max"];
export const optionLevelValues = [0, 0.25, 0.5, 0.75, 1];
export const maxOptionLevelIndex = optionLevelLabels.length - 1;
export const defaultOptionLevelIndex = 2;
export const movementOptionLabels = ["Touch/Click + WASD/Arrows", "Joystick Left", "Joystick Right"];
export const movementOptionIndexes = {
     pointerKeyboard: 0,
     touchClick: 0,
     keyboard: 0,
     joystickLeft: 1,
     joystickRight: 2
};
export const maxMovementOptionIndex = movementOptionLabels.length - 1;
export const defaultMovementOptionIndex = 0;
export const colorOptionLabels = ["Bright", "Pastel", "Monochrome"];
export const maxColorOptionIndex = colorOptionLabels.length - 1;
export const defaultColorOptionIndex = 0;

export function isJoystickEnabled() {
     return getCssBoolean("--game-joystick-enabled", false);
}

export function getMaxMovementOptionIndex() {
     return isJoystickEnabled() ? maxMovementOptionIndex : movementOptionIndexes.pointerKeyboard;
}

export const optionDefinitions = {
     bane: {
          id: "bane",
          label: "Difficulty",
          defaultLevel: defaultOptionLevelIndex
     },

     music: {
          id: "music",
          label: "Music",
          defaultLevel: defaultOptionLevelIndex
     },

     soundEffects: {
          id: "soundEffects",
          label: "Sound FX",
          defaultLevel: defaultOptionLevelIndex
     },

     movement: {
          id: "movement",
          label: "Movement",
          defaultLevel: defaultMovementOptionIndex
     },

     color: {
          id: "color",
          label: "Color",
          defaultLevel: defaultColorOptionIndex
     }
};

// ====================================================================================================
// NOTE: SHARED TUNABLES
// These are configuration values rather than live state.
// ====================================================================================================

export const gameplayStartingHealth = 3;
export const maxPlayerHealth = 10;
export const maxVisibleHearts = maxPlayerHealth / 2;
export const strikeHealthDamage = 1;
export const magnetCollisionRadiusMultiplier = 3;

export const touchArriveDistance = 2;

export const playerTrailMaxPoints = 14;
export const playerGlowBlurFallback = 18;
export const particleGlowBlurFallback = 18;

export const starSizeMinFallback = 25;
export const starSizeMaxFallback = 30;

export const statusFlashSeconds = 1.25;

// ==================================================
// SMALL HELPERS
// ==================================================

export function clampOptionLevelIndex(value) {
     const numericValue = Number(value);

     if (!Number.isFinite(numericValue)) {
          return defaultOptionLevelIndex;
     }

     return Math.max(0, Math.min(maxOptionLevelIndex, Math.round(numericValue)));
}

export function clampMovementOptionIndex(value) {
     const numericValue = Number(value);

     if (!Number.isFinite(numericValue)) {
          return defaultMovementOptionIndex;
     }

     return Math.max(0, Math.min(getMaxMovementOptionIndex(), Math.round(numericValue)));
}

export function clampColorOptionIndex(value) {
     const numericValue = Number(value);

     if (!Number.isFinite(numericValue)) {
          return defaultColorOptionIndex;
     }

     return Math.max(0, Math.min(maxColorOptionIndex, Math.round(numericValue)));
}

export function getOptionLevelLabel(levelIndex) {
     return optionLevelLabels[clampOptionLevelIndex(levelIndex)] || optionLevelLabels[0];
}

export function getMovementOptionLabel(levelIndex) {
     return movementOptionLabels[clampMovementOptionIndex(levelIndex)] || movementOptionLabels[0];
}

export function getColorOptionLabel(levelIndex) {
     return colorOptionLabels[clampColorOptionIndex(levelIndex)] || colorOptionLabels[0];
}

export function getOptionLevelValue(levelIndex) {
     return optionLevelValues[clampOptionLevelIndex(levelIndex)] ?? optionLevelValues[0];
}

export function getOptionDefinition(optionName) {
     return optionDefinitions[optionName] || null;
}

export function getAllOptionDefinitions() {
     return Object.values(optionDefinitions);
}

export function getDefaultOptionSnapshot() {
     return {
          music: optionDefinitions.music.defaultLevel,
          soundEffects: optionDefinitions.soundEffects.defaultLevel,
          bane: optionDefinitions.bane.defaultLevel,
          movement: optionDefinitions.movement.defaultLevel,
          color: optionDefinitions.color.defaultLevel
     };
}

export function getCurrentOptionSnapshot() {
     return {
          music: musicLevel,
          soundEffects: soundEffectsLevel,
          bane: baneLevel,
          movement: movementLevel,
          color: colorLevel
     };
}

// ==================================================
// CANVAS UI HELPERS
// Shared reusable measurement/layout helpers.
// ==================================================

export function getUnifiedButtonFont(theme, fontWeight = 400, fontSize = null) {
     const { fonts, text } = theme;
     const resolvedFontSize = fontSize ?? text.buttonsOptions.fontSize;
     return `${fontWeight} ${resolvedFontSize}px ${fonts.body}`;
}

export function measureCanvasTextWidth(text, font) {
     if (!miniGameCtx) {
          return text.length * 12;
     }

     miniGameCtx.save();
     miniGameCtx.font = font;
     const width = miniGameCtx.measureText(text).width;
     miniGameCtx.restore();

     return width;
}

export function getUnifiedButtonWidth(theme, label, fontWeight = 400, fontSize = null, paddingX = null) {
     const { text } = theme;
     const resolvedFontSize = fontSize ?? text.buttonsOptions.fontSize;
     const resolvedPaddingX = paddingX ?? text.buttonsOptions.buttonPadding;
     const font = getUnifiedButtonFont(theme, fontWeight, resolvedFontSize);
     const textWidth = measureCanvasTextWidth(label, font);

     return textWidth + (resolvedPaddingX * 2);
}

export function getUnifiedButtonHeight(theme, fontSize = null, paddingY = null) {
     const { text } = theme;
     const resolvedFontSize = fontSize ?? text.buttonsOptions.fontSize;
     const resolvedPaddingY = paddingY ?? text.buttonsOptions.buttonPadding;

     return resolvedFontSize + (resolvedPaddingY * 2);
}

export function setOptionRowBounds(row, decreaseButton, increaseButton, x, y, width, height) {
     const arrowWidth = Math.min(48, Math.max(35, width * 0.18));

     row.x = x;
     row.y = y;
     row.width = width;
     row.height = height;

     decreaseButton.x = x;
     decreaseButton.y = y;
     decreaseButton.width = arrowWidth;
     decreaseButton.height = height;

     increaseButton.x = x + width - arrowWidth;
     increaseButton.y = y;
     increaseButton.width = arrowWidth;
     increaseButton.height = height;
}

export function getMenuScreenLayout(theme) {
     const { text } = theme;
     const title = text.title;
     const buttons = text.buttonsOptions;
     const spacing = text.canvasSpacing;

     const sidePadding = spacing.menuPadding;
     const topBotPadding = spacing.menuPadding;
     const optionStackGap = spacing.uiPadding;
     const titleFontSize = title.fontSize;

     const buttonHeight = getUnifiedButtonHeight(
          theme,
          buttons.fontSize,
          buttons.buttonPadding
     );
     const backButtonWidth = getUnifiedButtonWidth(theme, "PREVIOUS", 700);
     const backButtonX = (miniGameWidth - backButtonWidth) / 2;
     const backButtonY =
          miniGameHeight -
          buttonHeight -
          topBotPadding -
          buttons.backButtonBottomOffset;

     const titleCenterX = miniGameWidth / 2;
     const titleY = topBotPadding;

     return {
          sidePadding,
          menuTopBotPadding: topBotPadding,
          titleFontSize,
          titleGap: topBotPadding,
          rowGap: optionStackGap,
          titleCenterX,
          titleY,
          buttonHeight,
          backButtonWidth,
          backButtonX,
          backButtonY,
          contentTopY: titleY + titleFontSize + optionStackGap,
          contentWidth: miniGameWidth - (sidePadding * 2),
          contentBottomY: miniGameHeight - topBotPadding - buttonHeight - topBotPadding
     };
}

export function getMenuLayoutMetrics(theme, panelX, panelWidth) {
     const sharedLayout = getMenuScreenLayout(theme);
     const buttonWidth = panelWidth * 0.75;
     const buttonX = panelX + ((panelWidth - buttonWidth) / 2);

     return {
          buttonX,
          buttonWidth,
          rowGap: sharedLayout.rowGap,
          buttonHeight: sharedLayout.buttonHeight,
          backButtonWidth: sharedLayout.backButtonWidth,
          backButtonX: sharedLayout.backButtonX,
          backButtonY: sharedLayout.backButtonY,
          contentTopY: sharedLayout.contentTopY
     };
}

// ==================================================
// RICH TEXT TOKENS
// ==================================================

export function parseRichTextSegments(text) {
     const segments = [];
     const tokenPattern = /\{(icon[A-Za-z0-9_]+)\}/g;
     let lastIndex = 0;
     let match = tokenPattern.exec(text);

     while (match) {
          if (match.index > lastIndex) {
               segments.push({
                    type: "text",
                    value: text.slice(lastIndex, match.index)
               });
          }

          segments.push({
               type: "icon",
               value: match[1]
          });

          lastIndex = tokenPattern.lastIndex;
          match = tokenPattern.exec(text);
     }

     if (lastIndex < text.length) {
          segments.push({
               type: "text",
               value: text.slice(lastIndex)
          });
     }

     return segments;
}

// ==================================================
// PERSISTENCE
// ==================================================

function canUseStorage() {
     try {
          return typeof window !== "undefined" && Boolean(window.localStorage);
     } catch {
          return false;
     }
}

export function normalizeOptionSnapshot(snapshot = {}) {
     const defaults = getDefaultOptionSnapshot();

     return {
          music: clampOptionLevelIndex(snapshot.music ?? defaults.music),
          soundEffects: clampOptionLevelIndex(snapshot.soundEffects ?? defaults.soundEffects),
          bane: clampOptionLevelIndex(snapshot.bane ?? defaults.bane),
          movement: clampMovementOptionIndex(snapshot.movement ?? defaults.movement),
          color: clampColorOptionIndex(snapshot.color ?? defaults.color)
     };
}

export function saveOptionSnapshot(snapshot = getCurrentOptionSnapshot()) {
     if (!canUseStorage()) {
          return false;
     }

     const normalizedSnapshot = normalizeOptionSnapshot(snapshot);

     try {
          window.localStorage.setItem(
               configStorageKeys.options,
               JSON.stringify(normalizedSnapshot)
          );
          return true;
     } catch {
          return false;
     }
}

export function loadSavedOptionSnapshot() {
     const defaults = getDefaultOptionSnapshot();

     if (!canUseStorage()) {
          return defaults;
     }

     try {
          const rawValue = window.localStorage.getItem(configStorageKeys.options);

          if (!rawValue) {
               return defaults;
          }

          const parsedValue = JSON.parse(rawValue);
          return normalizeOptionSnapshot(parsedValue);
     } catch {
          return defaults;
     }
}

export function clearSavedOptionSnapshot() {
     if (!canUseStorage()) {
          return false;
     }

     try {
          window.localStorage.removeItem(configStorageKeys.options);
          return true;
     } catch {
          return false;
     }
}

export function applyOptionSnapshot(snapshot = loadSavedOptionSnapshot()) {
     const normalizedSnapshot = normalizeOptionSnapshot(snapshot);

     setMusicLevel(normalizedSnapshot.music);
     setSoundEffectsLevel(normalizedSnapshot.soundEffects);
     setBaneLevel(normalizedSnapshot.bane);
     setMovementLevel(normalizedSnapshot.movement);
     setColorLevel(normalizedSnapshot.color);

     return normalizedSnapshot;
}

export function restoreDefaultOptionSnapshot() {
     const defaults = getDefaultOptionSnapshot();
     applyOptionSnapshot(defaults);
     saveOptionSnapshot(defaults);
     return defaults;
}

// ==================================================
// SETTING-SPECIFIC HELPERS
// ==================================================

export function saveCurrentOptions() {
     return saveOptionSnapshot(getCurrentOptionSnapshot());
}

export function loadAndApplySavedOptions() {
     return applyOptionSnapshot(loadSavedOptionSnapshot());
}

export function setAndPersistMusicLevel(levelIndex) {
     setMusicLevel(clampOptionLevelIndex(levelIndex));
     saveCurrentOptions();
}

export function setAndPersistSoundEffectsLevel(levelIndex) {
     setSoundEffectsLevel(clampOptionLevelIndex(levelIndex));
     saveCurrentOptions();
}

export function setAndPersistBaneLevel(levelIndex) {
     setBaneLevel(clampOptionLevelIndex(levelIndex));
     saveCurrentOptions();
}

export function setAndPersistMovementLevel(levelIndex) {
     setMovementLevel(clampMovementOptionIndex(levelIndex));
     saveCurrentOptions();
}

export function setAndPersistColorLevel(levelIndex) {
     setColorLevel(clampColorOptionIndex(levelIndex));
     saveCurrentOptions();
}
