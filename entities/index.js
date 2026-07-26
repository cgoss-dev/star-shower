// NOTE: entities/index
// Player behavior, stars, help/hurt pickups, collision bursts, and help/hurt state for Star Shower.
//
// Owned here:
// - player reset / clamping / movement / face-state sync / trail-state updates
// - star spawning / updates / collection
// - help and hurt pickup definitions
// - active help/hurt timers and status sync
// - collision burst creation / updates
// - shared falling-object color cycle
//
// NOT owned here:
// - main game loop / win checks
// - raw shared state storage
// - canvas HUD / menus / overlays rendering
//
// Newbie note:
// - This file should answer "what are the game things doing?"
// - If code only draws the final frame, it belongs in `draw/index.js`.
// - If code stores shared arrays or flags, it belongs in `state.js`.

import {
     miniGameCtx,
     miniGameWidth,
     miniGameHeight,
     player,
     keys,
     touchControls,
     gamePaused,
     gameWon,
     playerHealth,
     starScore,
     scoreMultiplier,
     stars,
     strikes,
     helphurtPickups,
     collisionBursts,
     starSpawnTimer,
     starSpawnCount,
     helphurtPickupSpawnTimer,
     hurtLevel,
     movementLevel,
     colorLevel,
     helphurtTimers,
     setStarSpawnTimer,
     addStarSpawnCount,
     setHelphurtPickupSpawnTimer,
     addStarScore,
     setStarScore,
     setScoreMultiplier,
     addPlayerHealth,
     setPlayerHealth,
     setHelphurtTimer,
     isHelphurtActive,
     decrementHelphurtTimers,
     setActiveStatusUi,
     clearActiveStatusUi,
     triggerDamageFeedback,
     triggerHealingFeedback,
     triggerStatusPulse,
     clearTouchMoveTarget,
     randomItem,
     randomNumber,
     isCollidingWithStar
} from "../state.js?v=20260711-50";

import {
     maxPlayerHealth,
     particleGlowBlurFallback,
     starSizeMinFallback,
     starSizeMaxFallback,
     strikeHealthDamage,
     magnetCollisionRadiusMultiplier,
     magnetRadiusMinScale,
     magnetRadiusMaxScale,
     statusFlashSeconds,
     touchArriveDistance,
     movementOptionIndexes
} from "../options.js?v=20260711-50";

import {
     areStrikesUnlockedForCurrentLevel,
     getCurrentLevelNumber,
     getUnlockedHelpNamesForCurrentLevel,
     getUnlockedHurtNamesForCurrentLevel,
     starShowerHelphurtIcons,
     starShowerGuideIcons,
     starShowerHealthParticles,
     starShowerRainbowPalette,
     getCssColor,
     showGameplayPopup
} from "../game.js?v=20260711-50";

import {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerMinimumSpeed,
     playerSpeedMinScale,
     playerSpeedMaxScale,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
     strikeSpawnIntervalMin,
     strikeSpawnIntervalMax,
     openingStrikeGraceStarSpawns,
     openingHelphurtGraceStarSpawns,
     helphurtPickupCap,
     collisionBurstParticleCount,
     fallingObjectSpeedMin,
     fallingObjectSpeedMax,
     spawnDensityBaselineArea,
     spawnDensityMinScale,
     spawnDensityMaxScale,
     fallSpeedMinScale,
     fallSpeedMaxScale,
     fallingObjectSpeedStep,
     helphurtSpawnIntervalsByDifficulty,
     helphurtFallSpeedMultipliersByLevel,
     playerTrailCountMax,
     playerTrailCountMin,
     playerTrailActiveCountMax,
     playerTrailLifeMax,
     playerTrailLifeMin,
     playerTrailWidthMax,
     playerTrailWidthMin,
     playerTrailOffsetMax,
     playerTrailOffsetMin,
     playerTrailLengthMax,
     playerTrailLengthMin,
     playerTrailPointCountMax,
     playerTrailPointDistance,
     playerTrailPointLife,
     playerTrailColorHoldPoints,
     playerTrailAnchorYRatio,
     starParticles,
     strikeParticles,
     strikeAssetSrc,
     burstChars
} from "./constants.js?v=20260711-50";

export {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerMinimumSpeed,
     playerSpeedMinScale,
     playerSpeedMaxScale,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
     strikeSpawnIntervalMin,
     strikeSpawnIntervalMax,
     openingStrikeGraceStarSpawns,
     openingHelphurtGraceStarSpawns,
     helphurtPickupCap,
     collisionBurstParticleCount,
     fallingObjectSpeedMin,
     fallingObjectSpeedMax,
     helphurtSpawnIntervalsByDifficulty,
     helphurtFallSpeedMultipliersByLevel,
     playerTrailCountMax,
     playerTrailCountMin,
     playerTrailActiveCountMax,
     playerTrailLifeMax,
     playerTrailLifeMin,
     playerTrailWidthMax,
     playerTrailWidthMin,
     playerTrailOffsetMax,
     playerTrailOffsetMin,
     playerTrailLengthMax,
     playerTrailLengthMin,
     playerTrailPointCountMax,
     playerTrailPointDistance,
     playerTrailPointLife,
     playerTrailColorHoldPoints,
     playerTrailAnchorYRatio,
     starParticles,
     strikeParticles,
     strikeAssetSrc,
     burstChars
};

const siteTheme = window.SiteTheme;

// ====================================================================================================
// NOTE: PLAYER
// ====================================================================================================

export const playerFaces = {
     neutral: "😐",
     smile: "🙂",
     healthTwo: "😟",
     healthFour: "😁",
     star: "😁",
     hurt: "😫",
     maxHealth: "🤩",
     lowHealth: "😰",
     dead: "☠️",
     frozen: "🥶",
     dazed: "😵‍💫"
};

const pickupAssetImages = {};
let lastSpawnedHelphurtName = "";

function getHelpTypes() {
     return Object.values(starShowerHelphurtIcons).filter((type) => type.category === "help");
}

function getHurtTypes() {
     return Object.values(starShowerHelphurtIcons).filter((type) => type.category === "hurt");
}

export function resetHelphurtIntroState() {
     lastSpawnedHelphurtName = "";
}

function getPickupAssetImage(src) {
     if (!src) {
          return null;
     }

     if (!pickupAssetImages[src]) {
          pickupAssetImages[src] = new Image();
          pickupAssetImages[src].src = src;
     }

     return pickupAssetImages[src];
}

function clampSpawnDensityScale(value) {
     return Math.max(spawnDensityMinScale, Math.min(spawnDensityMaxScale, value));
}

function getSpawnDensityScale() {
     if (miniGameWidth <= 0 || miniGameHeight <= 0) {
          return spawnDensityMaxScale;
     }

     return clampSpawnDensityScale((miniGameWidth * miniGameHeight) / spawnDensityBaselineArea);
}

function getScreenAreaScale(minScale, maxScale) {
     if (miniGameWidth <= 0 || miniGameHeight <= 0) {
          return minScale;
     }

     const areaRatio = (miniGameWidth * miniGameHeight) / spawnDensityBaselineArea;
     const areaScale = Math.sqrt(areaRatio);

     return Math.max(minScale, Math.min(maxScale, areaScale));
}

function clampFallSpeedScale(value) {
     return Math.max(fallSpeedMinScale, Math.min(fallSpeedMaxScale, value));
}

function getFallSpeedScale() {
     if (miniGameWidth <= 0 || miniGameHeight <= 0) {
          return fallSpeedMaxScale;
     }

     const areaRatio = (miniGameWidth * miniGameHeight) / spawnDensityBaselineArea;

     return clampFallSpeedScale(Math.sqrt(areaRatio));
}

function roundToFallSpeedStep(value) {
     return Math.max(
          fallingObjectSpeedStep,
          Math.round(value / fallingObjectSpeedStep) * fallingObjectSpeedStep
     );
}

function getScaledStarSpawnDelay() {
     return starSpawnDelay / getSpawnDensityScale();
}

function getScaledStarSpawnCap() {
     return Math.max(1, Math.round(starSpawnCap * getSpawnDensityScale()));
}

function getScaledStrikeSpawnCap() {
     return Math.max(1, Math.round(getScaledStarSpawnCap() * strikeSpawnRatio));
}

function getScaledHelphurtPickupCap() {
     return Math.max(1, Math.round(helphurtPickupCap * getSpawnDensityScale()));
}

function getFallingObjectSpeed() {
     const speedScale = getFallSpeedScale();
     const speedMin = roundToFallSpeedStep(fallingObjectSpeedMin * speedScale);
     const speedMax = Math.max(
          speedMin,
          roundToFallSpeedStep(fallingObjectSpeedMax * speedScale)
     );

     return randomNumber(speedMin, speedMax);
}

function getHelphurtSpawnInterval() {
     const spawnInterval = helphurtSpawnIntervalsByDifficulty[hurtLevel];

     if (!Number.isFinite(spawnInterval) || spawnInterval <= 0) {
          return Infinity;
     }

     return Math.round(spawnInterval);
}

// ====================================================================================================
// TRAIL
// ====================================================================================================

export const playerTrail = [];

// ==================================================
// VISUAL HELPERS
// ==================================================

function getRainbowPalette() {
     return starShowerRainbowPalette.filter(Boolean);
}

function getGameParticleSizeMin() {
     return siteTheme?.getStarSettings?.().sizeMin ?? starSizeMinFallback;
}

function getGameParticleSizeMax() {
     return siteTheme?.getStarSettings?.().sizeMax ?? starSizeMaxFallback;
}

// ==================================================
// COLOR ROTATION
// ==================================================

const particleColorEngine = {
     engine: null
};

let pastelParticleColorIndex = 0;
let healthParticleIndex = 0;
let playerTrailColorPointIndex = 0;
let playerTrailMovedThisFrame = false;
const playerGlyphCenterOffsetCache = new Map();
const healthParticleCycleMs = 500;

function ensureParticleColorEngine() {
     if (!particleColorEngine.engine) {
          const createEngine = siteTheme?.createColorEngine;

          particleColorEngine.engine = createEngine
               ? createEngine(getRainbowPalette)
               : {
                    paletteIndex: 0,
                    next() {
                         const palette = getRainbowPalette();

                         if (!palette.length) {
                              return "#ffffff";
                         }

                         const color = palette[this.paletteIndex % palette.length];
                         this.paletteIndex += 1;
                         return color;
                    },
                    reset() {
                         this.paletteIndex = 0;
                    }
               };
     }
}

function getNextParticleColor() {
     ensureParticleColorEngine();
     return particleColorEngine.engine.next() || "#ffffff";
}

function getNextPastelColorIndex() {
     const colorIndex = pastelParticleColorIndex % 12;
     pastelParticleColorIndex += 1;
     return colorIndex;
}

function getNextHealthParticleOffset() {
     const offset = healthParticleIndex % Math.max(1, starShowerHealthParticles.length);
     healthParticleIndex += 1;
     return offset;
}

function getCyclingHealthParticle(offset = 0) {
     if (!starShowerHealthParticles.length) {
          return "❤️";
     }

     const now = typeof performance !== "undefined" ? performance.now() : Date.now();
     const particleIndex = (Math.floor(now / healthParticleCycleMs) + offset) % starShowerHealthParticles.length;

     return starShowerHealthParticles[particleIndex] || "❤️";
}

function getPickupParticle(pickup) {
     if (pickup.type?.name === "health") {
          return getCyclingHealthParticle(pickup.healthParticleOffset || 0);
     }

     return pickup.particle;
}

function getPastelParticleColor(colorIndex = 0) {
     const normalizedIndex = (Math.round(Number(colorIndex) || 0) % 12) + 1;
     const variableName = `--mocha-${String(normalizedIndex).padStart(2, "0")}`;

     return getCssColor(variableName, "#f5c2e7");
}

export function getModeParticleColor(colorRole, fallback = "#ffffff", colorIndex = 0) {
     if (colorRole === "trail") {
          return colorLevel === 2
               ? getCssColor("--color-gray2", "#666")
               : fallback;
     }

     if (colorLevel === 0) {
          if (colorRole === "star") {
               return getCssColor("--color-white", "#fff");
          }

          return fallback;
     }

     if (colorLevel !== 2 && colorRole === "star") {
          return getCssColor("--color-white", "#fff");
     }

     if (colorLevel === 1) {
          return getPastelParticleColor(colorIndex);
     }

     if (colorLevel === 2) {
          if (colorRole === "burst") {
               return getCssColor("--color-gray2", "#666");
          }

          if (colorRole === "star") {
               return getCssColor("--color-gray2", "#666");
          }

          if (colorRole === "strike" || colorRole === "hurt") {
               return getCssColor("--color-black", "#000");
          }

          if (colorRole === "help") {
               return getCssColor("--color-white", "#fff");
          }

     }

     return fallback;
}

export function getParticleFillColor(particle) {
     return getModeParticleColor(particle.colorRole, particle.color, particle.colorIndex);
}

export function getParticleGlowColor() {
     return getCssColor("--color-white", "#ffffff");
}

export function resetEntityColorCycle() {
     if (particleColorEngine.engine?.reset) {
          particleColorEngine.engine.reset();
     }

     pastelParticleColorIndex = 0;
     healthParticleIndex = 0;
     playerTrailColorPointIndex = 0;
     particleColorEngine.engine = null;
}

// ==================================================
// PLAYER HELPERS
// ==================================================

function getPlayerMovementMultiplier() {
     if (isHelphurtActive("freeze")) {
          return 0;
     }

     return 1;
}

function hasKeyboardMovementInput() {
     return Boolean(
          keys.a ||
          keys.A ||
          keys.ArrowLeft ||
          keys.arrowleft ||
          keys.d ||
          keys.D ||
          keys.ArrowRight ||
          keys.arrowright ||
          keys.w ||
          keys.W ||
          keys.ArrowUp ||
          keys.arrowup ||
          keys.s ||
          keys.S ||
          keys.ArrowDown ||
          keys.arrowdown
     );
}

function createPlayerTrail(fromX, fromY, toX, toY) {
     playerTrailMovedThisFrame = true;

     function createTrailPoint(x, y) {
          const palette = getRainbowPalette();
          const colorBandIndex = Math.floor(playerTrailColorPointIndex / playerTrailColorHoldPoints);
          const color = palette[colorBandIndex % Math.max(1, palette.length)] || "#ffffff";
          playerTrailColorPointIndex += 1;

          return {
               x,
               y,
               colorRole: "trail",
               colorIndex: colorBandIndex % 12,
               color,
               life: playerTrailPointLife,
               maxLife: playerTrailPointLife
          };
     }

     if (!playerTrail.length) {
          playerTrail.push(createTrailPoint(fromX, fromY));
     }

     const lastPoint = playerTrail.at(-1);
     const previousPoint = playerTrail.at(-2);

     if (
          previousPoint &&
          Math.hypot(toX - previousPoint.x, toY - previousPoint.y) < playerTrailPointDistance
     ) {
          lastPoint.x = toX;
          lastPoint.y = toY;
          lastPoint.life = playerTrailPointLife;
          return;
     }

     playerTrail.push(createTrailPoint(toX, toY));

     if (playerTrail.length > playerTrailPointCountMax) {
          playerTrail.splice(0, playerTrail.length - playerTrailPointCountMax);
     }
}

export function getPlayerGlyphYOffset() {
     return player.char === playerFaces.smile ? player.size * 0.046875 : 0;
}

function getMeasuredPlayerGlyphCenterOffset() {
     const cacheKey = `${player.char}:${player.size}`;

     if (playerGlyphCenterOffsetCache.has(cacheKey)) {
          return playerGlyphCenterOffsetCache.get(cacheKey);
     }

     let centerOffset = player.size * playerTrailAnchorYRatio;

     if (miniGameCtx) {
          miniGameCtx.save();
          miniGameCtx.font = `${player.size}px Arial, Helvetica, sans-serif`;
          miniGameCtx.textAlign = "center";
          miniGameCtx.textBaseline = "middle";

          const metrics = miniGameCtx.measureText(player.char);
          const ascent = metrics.actualBoundingBoxAscent;
          const descent = metrics.actualBoundingBoxDescent;

          if (Number.isFinite(ascent) && Number.isFinite(descent) && (ascent + descent) > 0) {
               centerOffset = (descent - ascent) / 2;
          }

          miniGameCtx.restore();
     }

     playerGlyphCenterOffsetCache.set(cacheKey, centerOffset);
     return centerOffset;
}

export function getDefaultPlayerFace() {
     if (playerHealth <= 0) {
          return playerFaces.dead;
     }

     if (isHelphurtActive("freeze")) {
          return playerFaces.frozen;
     }

     if (isHelphurtActive("daze")) {
          return playerFaces.dazed;
     }

     if (playerHealth === maxPlayerHealth) {
          return playerFaces.maxHealth;
     }

     if (playerHealth <= 1) {
          return playerFaces.lowHealth;
     }

     if (playerHealth === 2) {
          return playerFaces.healthTwo;
     }

     if (playerHealth === 4) {
          return playerFaces.healthFour;
     }

     return playerFaces.smile;
}

export function refreshPlayerFaceFromHealth() {
     player.char = getDefaultPlayerFace();
}

export function updatePlayerSpeedFromHealth() {
     const diff = playerHealth - playerBaseHealth;
     const healthAdjustedSpeed = playerBaseSpeed + (diff * playerSpeedPerHeart);
     const screenScale = getScreenAreaScale(playerSpeedMinScale, playerSpeedMaxScale);
     const minimumSpeed = playerMinimumSpeed * screenScale;

     player.speed = Math.max(minimumSpeed, healthAdjustedSpeed * screenScale);
}

export function syncPlayerHealthState() {
     updatePlayerSpeedFromHealth();
     refreshPlayerFaceFromHealth();
}

export function applyTemporaryPlayerFace(face, duration) {
     if (
          playerHealth <= 0 ||
          playerHealth === maxPlayerHealth ||
          playerHealth <= 2 ||
          isHelphurtActive("freeze") ||
          isHelphurtActive("daze")
     ) {
          player.starFaceTimer = 0;
          refreshPlayerFaceFromHealth();
          return;
     }

     player.char = face;
     player.starFaceTimer = duration;
}

export function triggerPlayerFacePop(scale = 1.1) {
     player.hitScale = Math.max(player.hitScale, scale);
}

export function syncPlayerSize() {
     player.size = playerBaseSize;
     player.radius = playerBaseRadius;
     updatePlayerSpeedFromHealth();
     clampPlayerToCanvas();
}

export function resetPlayerPosition() {
     player.x = miniGameWidth / 2;
     player.y = miniGameHeight * 0.75;
     player.size = playerBaseSize;
     player.radius = playerBaseRadius;
     player.starFaceTimer = 0;
     player.hitScale = 1;
     player.lowHealthPulseTime = 0;
     playerTrail.length = 0;
     playerTrailColorPointIndex = 0;
     playerTrailMovedThisFrame = false;

     if (particleColorEngine.engine?.reset) {
          particleColorEngine.engine.reset();
     }

     syncPlayerHealthState();
}

export function clampPlayerToCanvas() {
     const edgePadding = 3;

     player.x = Math.max(
          player.radius + edgePadding,
          Math.min(miniGameWidth - player.radius - edgePadding, player.x)
     );

     player.y = Math.max(
          player.radius + edgePadding,
          Math.min(miniGameHeight - player.radius - edgePadding, player.y)
     );
}

function movePlayerTowardPointerTarget() {
     if (movementLevel !== movementOptionIndexes.pointerKeyboard) {
          return false;
     }

     const target = touchControls.touchMoveTarget;

     if (!target?.isActive) {
          return false;
     }

     if (hasKeyboardMovementInput()) {
          return false;
     }

     const dx = target.x - player.x;
     const dy = target.y - player.y;
     const distance = Math.hypot(dx, dy);

     if (distance <= touchArriveDistance) {
          clearTouchMoveTarget(target.pointerId);
          return false;
     }

     const reverseMultiplier = isHelphurtActive("daze") ? -1 : 1;
     const step = Math.min(player.speed * getPlayerMovementMultiplier(), distance);

     player.x += (dx / distance) * step * reverseMultiplier;
     player.y += (dy / distance) * step * reverseMultiplier;

     return true;
}

function movePlayerFromKeyboard() {
     if (movementLevel !== movementOptionIndexes.pointerKeyboard) {
          return false;
     }

     let dx = 0;
     let dy = 0;

     if (keys.a || keys.A || keys.ArrowLeft || keys.arrowleft) {
          dx -= 1;
     }

     if (keys.d || keys.D || keys.ArrowRight || keys.arrowright) {
          dx += 1;
     }

     if (keys.w || keys.W || keys.ArrowUp || keys.arrowup) {
          dy -= 1;
     }

     if (keys.s || keys.S || keys.ArrowDown || keys.arrowdown) {
          dy += 1;
     }

     if (dx === 0 && dy === 0) {
          return;
     }

     const length = Math.hypot(dx, dy);
     const reverseMultiplier = isHelphurtActive("daze") ? -1 : 1;
     const speed = player.speed * getPlayerMovementMultiplier();

     player.x += (dx / length) * speed * reverseMultiplier;
     player.y += (dy / length) * speed * reverseMultiplier;

     return true;
}

function movePlayerFromJoystick() {
     if (movementLevel !== movementOptionIndexes.joystick) {
          return false;
     }

     const joystick = touchControls.joystick;

     if (!joystick?.isActive) {
          return false;
     }

     const length = Math.hypot(joystick.dx, joystick.dy);
     const deadZone = joystick.deadZone || 0;

     if (length <= deadZone) {
          return true;
     }

     const reverseMultiplier = isHelphurtActive("daze") ? -1 : 1;
     const speed = player.speed * getPlayerMovementMultiplier();

     player.x += joystick.dx * speed * reverseMultiplier;
     player.y += joystick.dy * speed * reverseMultiplier;

     return true;
}

export function updatePlayer() {
     // Movement priority pseudocode:
     // 1. Joystick wins when that mode is enabled and active.
     // 2. Pointer movement is next for click/touch movement mode.
     // 3. Keyboard fills in when no pointer-style movement is active.
     // 4. Clamp to the canvas and create a trail only if position changed.
     const previousX = player.x;
     const previousY = player.y;

     if (!movePlayerFromJoystick() && !movePlayerTowardPointerTarget()) {
          movePlayerFromKeyboard();
     }

     clampPlayerToCanvas();

     if (player.x !== previousX || player.y !== previousY) {
          const responsiveTrailAnchorYOffset =
               getPlayerGlyphYOffset() +
               getMeasuredPlayerGlyphCenterOffset();

          createPlayerTrail(
               previousX,
               previousY + responsiveTrailAnchorYOffset,
               player.x,
               player.y + responsiveTrailAnchorYOffset
          );
     }
}

export function updatePlayerFaceState() {
     syncPlayerSize();

     if (gamePaused) {
          player.char = gameWon ? playerFaces.star : playerFaces.neutral;
          player.hitScale = 1;
          return;
     }

     if (player.starFaceTimer > 0) {
          player.starFaceTimer -= 1;
     }

     if (player.starFaceTimer <= 0) {
          refreshPlayerFaceFromHealth();
     }

     if (player.hitScale > 1) {
          player.hitScale += (1 - player.hitScale) * 0.18;

          if (Math.abs(player.hitScale - 1) < 0.01) {
               player.hitScale = 1;
          }
     }

     if (playerHealth <= 2) {
          player.lowHealthPulseTime += 0.14;
     } else {
          player.lowHealthPulseTime = 0;
     }
}

export function updatePlayerTrail() {
     const lifeDecay = playerTrailMovedThisFrame ? 1 : 6;

     for (let i = playerTrail.length - 1; i >= 0; i -= 1) {
          playerTrail[i].life -= lifeDecay;

          if (playerTrail[i].life <= 0) {
               playerTrail.splice(i, 1);
          }
     }

     playerTrailMovedThisFrame = false;
}

// ==================================================
// EFFECT HELPERS
// ==================================================

const timedHelphurtNames = [
     "magnet",
     "double",
     "freeze",
     "daze",
     "fog"
];
const maxTimedHelphurtStack = 2;

export function secondsToFrames(seconds) {
     return Math.round(seconds * framesPerSecond);
}

function getHelphurtDurationFrames(helphurtType) {
     return secondsToFrames(helphurtType.durationSeconds || 0);
}

function getStatusFlashFrames() {
     return secondsToFrames(statusFlashSeconds);
}

function syncScoreMultiplierFromHelphurts() {
     const nextMultiplier = isHelphurtActive("double") ? 2 : 1;

     if (scoreMultiplier !== nextMultiplier) {
          setScoreMultiplier(nextMultiplier);
     }
}

function getActiveTimedHelphurtNames() {
     return timedHelphurtNames.filter((helphurtName) => isHelphurtActive(helphurtName));
}

function setStackedTimedHelphurt(helphurtName, durationFrames) {
     const activeNames = getActiveTimedHelphurtNames();

     if (!isHelphurtActive(helphurtName) && activeNames.length >= maxTimedHelphurtStack) {
          const expiringName = activeNames.reduce((lowestName, currentName) => (
               helphurtTimers[currentName] < helphurtTimers[lowestName] ? currentName : lowestName
          ), activeNames[0]);

          setHelphurtTimer(expiringName, 0);
     }

     setHelphurtTimer(helphurtName, durationFrames);
     syncScoreMultiplierFromHelphurts();
}

function getHighestPriorityActiveHelphurt() {
     const statusPriority = [
          "freeze",
          "fog",
          "daze",
          "double",
          "magnet"
     ];

     for (let i = 0; i < statusPriority.length; i += 1) {
          const helphurtName = statusPriority[i];

          if (isHelphurtActive(helphurtName)) {
               return helphurtName;
          }
     }

     return "";
}

function getHelphurtTypeByName(helphurtName) {
     return (
          getHelpTypes().find((type) => type.name === helphurtName) ||
          getHurtTypes().find((type) => type.name === helphurtName) ||
          null
     );
}

function syncActiveStatusUiFromHelphurts() {
     const activeHelphurtNames = [
          getHighestPriorityActiveHelphurt(),
          ...getActiveTimedHelphurtNames()
     ].filter((helphurtName, index, names) => (
          helphurtName && names.indexOf(helphurtName) === index
     )).slice(0, maxTimedHelphurtStack);

     if (activeHelphurtNames.length === 0) {
          clearActiveStatusUi();
          return;
     }

     const type = getHelphurtTypeByName(activeHelphurtNames[0]);

     if (!type) {
          clearActiveStatusUi();
          return;
     }

     const statusText = activeHelphurtNames.map((helphurtName) => {
          const statusType = getHelphurtTypeByName(helphurtName);
          const secondsLeft = Math.ceil((helphurtTimers[helphurtName] || 0) / framesPerSecond);

          return statusType ? `${statusType.particle} ${secondsLeft}s` : "";
     }).filter(Boolean).join("  ");

     if (type.lastsUntilUsed) {
          setActiveStatusUi(type.label, type.particle, 0, 0, statusText);
          return;
     }

     setActiveStatusUi(
          type.label,
          type.particle,
          helphurtTimers[type.name] || 0,
          getHelphurtDurationFrames(type),
          statusText
     );
}

export function updateHelphurtState() {
     // Active effect pseudocode:
     // 1. Count down all timed help/hurt effects.
     // 2. Recalculate derived effects, like the score multiplier.
     // 3. Mirror the highest-priority active effect into the HUD status slot.
     decrementHelphurtTimers();
     syncScoreMultiplierFromHelphurts();
     syncActiveStatusUiFromHelphurts();
}

function applyHelpPickup(type) {
     if (type.name === "health") {
          if (playerHealth >= maxPlayerHealth) {
               setStarScore(starScore + 1);
               return;
          }

          const healthBeforePickup = playerHealth;
          addPlayerHealth(1);
          syncPlayerHealthState();

          if (playerHealth > healthBeforePickup) {
               triggerHealingFeedback();
          }

          return;
     }

     setStackedTimedHelphurt(type.name, getHelphurtDurationFrames(type));
     syncActiveStatusUiFromHelphurts();
     triggerStatusPulse();
}

function applyHurtPickup(type) {
     addPlayerHealth(-strikeHealthDamage);
     setStackedTimedHelphurt(type.name, getHelphurtDurationFrames(type));
     syncPlayerHealthState();
     syncActiveStatusUiFromHelphurts();
     triggerDamageFeedback();
     triggerStatusPulse();
}

function getObjectFallSpeedMultiplier() {
     return 1;
}

function getHelphurtFallSpeedMultiplier() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);

     return helphurtFallSpeedMultipliersByLevel[levelIndex] ?? helphurtFallSpeedMultipliersByLevel.at(-1) ?? 1;
}

// ==================================================
// STARS + STRIKES
// ==================================================

function getStarCollisionRadiusMultiplier() {
     if (!isHelphurtActive("magnet")) {
          return 1;
     }

     const magnetScale = getScreenAreaScale(magnetRadiusMinScale, magnetRadiusMaxScale);

     return magnetCollisionRadiusMultiplier * magnetScale;
}

function isCollidingWithStarCollectionRadius(star) {
     return isCollidingWithStar(
          {
               ...player,
               radius: player.radius * getStarCollisionRadiusMultiplier()
          },
          star
     );
}

export function createStar() {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     stars.push({
          x,
          baseX: x,
          y: -20,
          speed: getFallingObjectSpeed(),
          size: Math.random() * (getGameParticleSizeMax() - getGameParticleSizeMin()) + getGameParticleSizeMin(),
          particle: starParticles[Math.floor(Math.random() * starParticles.length)],
          colorRole: "star",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });
}

function createStrike() {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     strikes.push({
          x,
          baseX: x,
          y: -20,
          speed: getFallingObjectSpeed(),
          size: randomNumber(getGameParticleSizeMin(), getGameParticleSizeMax()),
          particle: strikeParticles[Math.floor(Math.random() * strikeParticles.length)],
          assetSrc: strikeAssetSrc,
          colorRole: "strike",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });
}

function getNextStrikeSpawnInterval() {
     return Math.floor(randomNumber(strikeSpawnIntervalMin, strikeSpawnIntervalMax + 1));
}

let strikeSpawnsUntilNext = getNextStrikeSpawnInterval();

function createMatchingStrikeFromStarSpawn() {
     if (starSpawnCount <= openingStrikeGraceStarSpawns) {
          strikeSpawnsUntilNext = getNextStrikeSpawnInterval();
          return;
     }

     if (!areStrikesUnlockedForCurrentLevel()) {
          return;
     }

     strikeSpawnsUntilNext -= 1;

     if (strikeSpawnsUntilNext > 0) {
          return;
     }

     if (strikes.length >= getScaledStrikeSpawnCap()) {
          return;
     }

     createStrike();
     strikeSpawnsUntilNext = getNextStrikeSpawnInterval();
}

export function updateStarSpawns() {
     // Spawn pseudocode:
     // 1. Advance the star timer with a little random jitter.
     // 2. Spawn a star if the timer and board cap allow it.
     // 3. Each star spawn can also unlock matching strikes and help/hurt pickups.
     const nextStarSpawnTimer = starSpawnTimer + 1;
     setStarSpawnTimer(nextStarSpawnTimer);

     const starSpawnJitter = Math.random() * 8;

     if (nextStarSpawnTimer >= getScaledStarSpawnDelay() + starSpawnJitter) {
          if (stars.length < getScaledStarSpawnCap()) {
               createStar();
               addStarSpawnCount();
               createMatchingStrikeFromStarSpawn();
               maybeCreateHelphurtPickupsFromStarSpawn();
          }

          setStarSpawnTimer(0);
     }
}

export function updateStars() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = stars.length - 1; i >= 0; i -= 1) {
          const star = stars[i];

          star.y += star.speed * fallSpeedMultiplier;
          star.wobbleOffset += star.wobbleSpeed;
          star.x = star.baseX + Math.sin(star.wobbleOffset) * star.wobbleAmount;

          if (star.y > miniGameHeight + 30) {
               stars.splice(i, 1);
          }
     }
}

export function updateStrikes() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = strikes.length - 1; i >= 0; i -= 1) {
          const strike = strikes[i];

          strike.y += strike.speed * fallSpeedMultiplier;
          strike.wobbleOffset += strike.wobbleSpeed;
          strike.x = strike.baseX + Math.sin(strike.wobbleOffset) * strike.wobbleAmount;

          if (strike.y > miniGameHeight + 30) {
               strikes.splice(i, 1);
          }
     }
}

export function collectStars() {
     // Collection loops walk backward because removing an item shifts later indexes.
     for (let i = stars.length - 1; i >= 0; i -= 1) {
          const star = stars[i];

          if (!isCollidingWithStarCollectionRadius(star)) {
               continue;
          }

          createCollisionBurst(star.x, star.y, star.color, "star");
          stars.splice(i, 1);

          addStarScore(1);
          applyTemporaryPlayerFace(playerFaces.star, 60);
          triggerPlayerFacePop(1.25);
     }
}

export function collectStrikes() {
     for (let i = strikes.length - 1; i >= 0; i -= 1) {
          const strike = strikes[i];

          if (!isCollidingWithStar(player, strike)) {
               continue;
          }

          createCollisionBurst(strike.x, strike.y, strike.color, "hurt");
          strikes.splice(i, 1);

          addPlayerHealth(-strikeHealthDamage);
          syncPlayerHealthState();
          triggerDamageFeedback();
          applyTemporaryPlayerFace(playerFaces.hurt, 30);
          triggerPlayerFacePop(1.25);
     }
}

// ==================================================
// EFFECT PICKUPS
// ==================================================

function createHelphurtPickup(type, category) {
     const x = Math.random() * (miniGameWidth - 20) + 10;
     const healthParticleOffset = type.name === "health" ? getNextHealthParticleOffset() : 0;
     const particle = type.name === "health"
          ? getCyclingHealthParticle(healthParticleOffset)
          : type.particle;

     helphurtPickups.push({
          x,
          baseX: x,
          y: -20,
          speed: getFallingObjectSpeed(),
          size: randomNumber(getGameParticleSizeMin(), getGameParticleSizeMax()),
          particle,
          healthParticleOffset,
          type,
          category,
          colorRole: category === "help" ? "help" : "hurt",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });

     lastSpawnedHelphurtName = type.name || "";
}

function chooseHelphurtType(availableTypes) {
     if (availableTypes.length <= 1) {
          return availableTypes[0] || null;
     }

     const onBoardNames = new Set(helphurtPickups.map((pickup) => pickup.type?.name).filter(Boolean));
     const notOnBoardTypes = availableTypes.filter((type) => !onBoardNames.has(type.name));
     const boardFilteredTypes = notOnBoardTypes.length ? notOnBoardTypes : availableTypes;
     const notLastTypes = boardFilteredTypes.filter((type) => type.name !== lastSpawnedHelphurtName);
     const finalTypes = notLastTypes.length ? notLastTypes : boardFilteredTypes;

     return randomItem(finalTypes);
}

function createHelphurtPickupFromTypes(availableTypes, category) {
     const type = chooseHelphurtType(availableTypes);

     if (!type) {
          return false;
     }

     createHelphurtPickup(type, category);
     return true;
}

export function createHelpPickup() {
     const unlockedHelpNames = getUnlockedHelpNamesForCurrentLevel();
     const availableHelphurtTypes = getHelpTypes().filter((type) => unlockedHelpNames.includes(type.name));

     if (availableHelphurtTypes.length <= 0) {
          return false;
     }

     createHelphurtPickupFromTypes(availableHelphurtTypes, "help");
     return true;
}

export function createHurtPickup() {
     const unlockedHurtNames = getUnlockedHurtNamesForCurrentLevel();
     const availableHelphurtTypes = getHurtTypes().filter((type) => unlockedHurtNames.includes(type.name));

     if (availableHelphurtTypes.length <= 0) {
          return false;
     }

     createHelphurtPickupFromTypes(availableHelphurtTypes, "hurt");
     return true;
}

function createRandomHelphurtPickup() {
     if (Math.random() < 0.5 && createHurtPickup()) {
          return;
     }

     createHelpPickup();
}

export function maybeCreateHelphurtPickupsFromStarSpawn() {
     // Help/hurt spawn pseudocode:
     // 1. Wait through the opening grace period.
     // 2. Respect the on-screen pickup cap.
     // 3. Guarantee an early pickup after grace, then use the selected fixed interval.
     const helphurtSpawnInterval = getHelphurtSpawnInterval();
     const nextHelphurtPickupSpawnTimer = helphurtPickupSpawnTimer + 1;

     if (starSpawnCount < openingHelphurtGraceStarSpawns) {
          setHelphurtPickupSpawnTimer(0);
          return;
     }

     if (helphurtPickups.length >= getScaledHelphurtPickupCap()) {
          return;
     }

     if (!Number.isFinite(helphurtSpawnInterval)) {
          setHelphurtPickupSpawnTimer(0);
          return;
     }

     if (starSpawnCount === openingHelphurtGraceStarSpawns) {
          createRandomHelphurtPickup();
          setHelphurtPickupSpawnTimer(0);
          return;
     }

     setHelphurtPickupSpawnTimer(nextHelphurtPickupSpawnTimer);

     if (nextHelphurtPickupSpawnTimer >= helphurtSpawnInterval) {
          createRandomHelphurtPickup();
          setHelphurtPickupSpawnTimer(0);
          return;
     }

}

export function updateHelphurtPickups() {
     const fallSpeedMultiplier = getHelphurtFallSpeedMultiplier();

     for (let i = helphurtPickups.length - 1; i >= 0; i -= 1) {
          const pickup = helphurtPickups[i];

          pickup.y += pickup.speed * fallSpeedMultiplier;
          pickup.wobbleOffset += pickup.wobbleSpeed;
          pickup.x = pickup.baseX + Math.sin(pickup.wobbleOffset) * pickup.wobbleAmount;

          if (pickup.y > miniGameHeight + 30) {
               helphurtPickups.splice(i, 1);
          }
     }
}

function collectHelpPickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "star", "help");
     helphurtPickups.splice(index, 1);

     applyHelpPickup(pickup.type);
     showGameplayPopup(`${getPickupParticle(pickup) || "⭐"} ${pickup.type?.label || "HELP"}`);
     applyTemporaryPlayerFace(playerFaces.star, 45);
     triggerPlayerFacePop(1.2);
}

function collectHurtPickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "hurt", "hurt");
     helphurtPickups.splice(index, 1);

     applyHurtPickup(pickup.type);
     showGameplayPopup(`${pickup.type?.particle || "😵"} ${pickup.type?.label || "HURT"}`);
     applyTemporaryPlayerFace(playerFaces.hurt, 30);
     triggerPlayerFacePop(1.25);
}

export function collectHelphurtPickups() {
     for (let i = helphurtPickups.length - 1; i >= 0; i -= 1) {
          const pickup = helphurtPickups[i];

          if (!isCollidingWithStar(player, pickup)) {
               continue;
          }

          if (pickup.category === "help") {
               collectHelpPickup(pickup, i);
          } else {
               collectHurtPickup(pickup, i);
          }
     }
}

// ==================================================
// COLLISION BURSTS
// ==================================================

export function createCollisionBurst(x, y, color, burstType, colorRole = null) {
     const rainbowPalette = getRainbowPalette();
     const isCollectedStar = burstType === "star" && colorRole === null;
     const particleCount = isCollectedStar
          ? Math.round(collisionBurstParticleCount * 1.35)
          : collisionBurstParticleCount;

     for (let i = 0; i < particleCount; i += 1) {
          const angle = randomNumber(0, Math.PI * 2);
          const speed = burstType === "hurt"
               ? randomNumber(1.1, 2.6)
               : isCollectedStar
                    ? randomNumber(1, 2.8)
                    : randomNumber(0.7, 2.1);
          const life = isCollectedStar
               ? randomNumber(42, 60)
               : randomNumber(25, 50);

          collisionBursts.push({
               x,
               y,
               dx: Math.cos(angle) * speed,
               dy: Math.sin(angle) * speed,
               life,
               maxLife: isCollectedStar ? life : 50,
               size: isCollectedStar ? randomNumber(24, 36) : randomNumber(20, 30),
               particle: randomItem(burstChars),
               colorRole: "burst",
               colorIndex: Math.floor(randomNumber(0, 12)),
               color: randomItem(rainbowPalette) || color
          });
     }
}

export function updateCollisionBursts() {
     for (let i = collisionBursts.length - 1; i >= 0; i -= 1) {
          const burst = collisionBursts[i];

          burst.x += burst.dx;
          burst.y += burst.dy;
          burst.dy += 0.015;
          burst.life -= 1;

          if (burst.life <= 0) {
               collisionBursts.splice(i, 1);
          }
     }
}

// ==================================================
// ENTITY DRAW
// ==================================================

function getGameGlowBlur() {
     return siteTheme?.getGlowSettings?.().gameParticleBlur ?? particleGlowBlurFallback;
}

export function drawStars() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = stars.length - 1; i >= 0; i -= 1) {
          const star = stars[i];
          const fillColor = getParticleFillColor(star);

          miniGameCtx.save();
          miniGameCtx.font = `${Math.max(16, star.size)}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.globalAlpha = 0.95;
          miniGameCtx.fillText(star.particle, star.x, star.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.fillText(star.particle, star.x, star.y);

          miniGameCtx.restore();
     }
}

export function drawStrikes() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     function drawTintedStrikeAsset(strike, image, size, fillColor) {
          const assetX = strike.x - (size / 2);
          const assetY = strike.y - (size / 2);
          const tintCanvas = document.createElement("canvas");
          const tintCtx = tintCanvas.getContext("2d");

          tintCanvas.width = Math.ceil(size);
          tintCanvas.height = Math.ceil(size);

          tintCtx.drawImage(image, 0, 0, tintCanvas.width, tintCanvas.height);
          tintCtx.globalCompositeOperation = "source-in";
          tintCtx.fillStyle = fillColor;
          tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);

          miniGameCtx.save();
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);
          miniGameCtx.restore();
     }

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = strikes.length - 1; i >= 0; i -= 1) {
          const strike = strikes[i];
          const fillColor = getParticleFillColor(strike);
          const strikeSize = Math.max(16, strike.size);
          const assetImage = getPickupAssetImage(strike.assetSrc);

          if (assetImage?.complete && assetImage.naturalWidth > 0) {
               drawTintedStrikeAsset(strike, assetImage, strikeSize, fillColor);
               continue;
          }

          miniGameCtx.save();
          miniGameCtx.font = `${strikeSize}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.fillText(strike.particle, strike.x, strike.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.fillText(strike.particle, strike.x, strike.y);

          miniGameCtx.restore();
     }
}

export function drawHelphurtPickups() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     function drawTintedPickupAsset(pickup, image, size, fillColor) {
          const assetX = pickup.x - (size / 2);
          const assetY = pickup.y - (size / 2);
          const tintCanvas = document.createElement("canvas");
          const tintCtx = tintCanvas.getContext("2d");

          tintCanvas.width = Math.ceil(size);
          tintCanvas.height = Math.ceil(size);

          tintCtx.drawImage(image, 0, 0, tintCanvas.width, tintCanvas.height);
          tintCtx.globalCompositeOperation = "source-in";
          tintCtx.fillStyle = fillColor;
          tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);

          miniGameCtx.save();
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;
          miniGameCtx.globalAlpha = pickup.category === "help" ? 1 : 0.95;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);
          miniGameCtx.restore();
     }

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = helphurtPickups.length - 1; i >= 0; i -= 1) {
          const pickup = helphurtPickups[i];
          const fillColor = getParticleFillColor(pickup);
          const particle = getPickupParticle(pickup);

          const pickupFontSize = Math.max(20, pickup.size);
          const assetImage = getPickupAssetImage(pickup.type?.assetSrc);

          if (assetImage?.complete && assetImage.naturalWidth > 0) {
               drawTintedPickupAsset(pickup, assetImage, pickupFontSize, fillColor);
               continue;
          }

          miniGameCtx.save();
          miniGameCtx.font = `${pickupFontSize}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.globalAlpha = pickup.category === "help" ? 1 : 0.95;
          miniGameCtx.fillText(particle, pickup.x, pickup.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.fillText(particle, pickup.x, pickup.y);

          miniGameCtx.restore();
     }
}

export function drawCollisionBursts() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = collisionBursts.length - 1; i >= 0; i -= 1) {
          const burst = collisionBursts[i];
          const lifeRatio = burst.life / burst.maxLife;
          const sizeMultiplier = 0.7 + ((1 - lifeRatio) * 0.6);
          const burstSize = burst.size * sizeMultiplier;
          const fillColor = getParticleFillColor(burst);

          miniGameCtx.save();
          miniGameCtx.font = `${burstSize}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.95);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.8);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.restore();
     }
}
