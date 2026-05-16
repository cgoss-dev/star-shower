// NOTE: 8_Entities
// Player behavior, stars, boost/bane pickups, collision bursts, and boost/bane state for Star Shower.
//
// Owned here:
// - player reset / clamping / movement / face-state sync / trail-state updates
// - star spawning / updates / collection
// - boost and bane pickup definitions
// - active boost/bane timers and status sync
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
// - If code only draws the final frame, it belongs in `7_Draw.js`.
// - If code stores shared arrays or flags, it belongs in `3_State.js`.

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
     boostBanePickups,
     collisionBursts,
     starSpawnTimer,
     boostBanePickupSpawnTimer,
     baneLevel,
     movementLevel,
     colorLevel,
     boostBaneTimers,
     setStarSpawnTimer,
     setBoostBanePickupSpawnTimer,
     addStarScore,
     setScoreMultiplier,
     addPlayerHealth,
     setPlayerHealth,
     setBoostBaneTimer,
     isBoostBaneActive,
     decrementBoostBaneTimers,
     setActiveStatusUi,
     clearActiveStatusUi,
     randomItem,
     randomNumber,
     isCollidingWithStar
} from "./3_State.js";

import {
     maxPlayerHealth,
     particleGlowBlurFallback,
     starSizeMinFallback,
     starSizeMaxFallback,
     strikeHealthDamage,
     magnetCollisionRadiusMultiplier,
     statusFlashSeconds,
     gameplayStartingHealth,
     touchArriveDistance,
     movementOptionIndexes
} from "./4_Options.js";

import {
     areStrikesUnlockedForCurrentLevel,
     progressUnitsPerCircle,
     getCurrentLevelNumber,
     getUnlockedBaneNamesForCurrentLevel
} from "./5_GameRules.js";

import {
     starShowerBoostBaneIcons,
     starShowerRainbowPalette,
     getCssColor
} from "./9_Config.js";

import {
     playSoundEffect
} from "./10_Audio.js";

const siteTheme = window.SiteTheme;

// ====================================================================================================
// NOTE: PLAYER
// ====================================================================================================

export const playerFaces = {
     neutral: "😐",
     smile: "🙂",
     star: "😁",
     bane: "😫",
     maxHealth: "🤩",
     lowHealth: "😰",
     dead: "☠️",
     frozen: "🥶",
     dazed: "😵‍💫"
};

export const playerBaseHealth = gameplayStartingHealth;
export const playerBaseSpeed = 1.5;
export const playerSpeedPerHeart = 0.25;
export const playerBaseSize = 64;
export const playerBaseRadius = 30;

// ====================================================================================================
// NOTE: BALANCE
// ====================================================================================================

export const framesPerSecond = 60;

export const starSpawnDelay = 25;
export const starSpawnCap = 50;
export const strikeSpawnRatio = 0.5;
export const boostBanePickupCap = 60;
export const collisionBurstParticleCount = 15;
export const fallingObjectSpeedMin = 0.25;
export const fallingObjectSpeedMax = 0.75;

const spawnDensityBaselineArea = 960 * 640;
const spawnDensityMinScale = 0.45;
const spawnDensityMaxScale = 1;
const fallSpeedMinScale = 0.7;
const fallSpeedMaxScale = 1;
const fallingObjectSpeedStep = 0.25;

export const boostBaneBaseSpawnStarsByLevel = [
     8,
     10,
     9,
     8,
     7,
     6,
     5,
     4,
     3,
     2
];

export const boostBaneDifficultyMultipliers = [
     0,
     0.25,
     1,
     2,
     4
];

const boostBaneTypes = Object.values(starShowerBoostBaneIcons);
const pickupAssetImages = {};
const introducedBoostBaneNames = new Set();
let boostBaneIntroCallback = null;

export const boostTypes = boostBaneTypes.filter((type) => type.category === "boost");
export const baneTypes = boostBaneTypes.filter((type) => type.category === "bane");

export function setBoostBaneIntroCallback(callback) {
     boostBaneIntroCallback = typeof callback === "function" ? callback : null;
}

export function resetBoostBaneIntroState() {
     introducedBoostBaneNames.clear();
}

function announceNewBoostBaneEntity(type) {
     if (!type?.name || !boostBaneIntroCallback || introducedBoostBaneNames.has(type.name)) {
          return;
     }

     introducedBoostBaneNames.add(type.name);
     boostBaneIntroCallback(type);
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

function getScaledBoostBanePickupCap() {
     return Math.max(1, Math.round(boostBanePickupCap * getSpawnDensityScale()));
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

function getBoostBaneSpawnChance() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerBoostBane = boostBaneBaseSpawnStarsByLevel[levelIndex] ?? boostBaneBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = boostBaneDifficultyMultipliers[baneLevel] ?? 0;

     if (!Number.isFinite(starsPerBoostBane) || starsPerBoostBane <= 0 || difficultyMultiplier <= 0) {
          return 0;
     }

     return difficultyMultiplier / starsPerBoostBane;
}

function getBoostBaneSpawnInterval() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerBoostBane = boostBaneBaseSpawnStarsByLevel[levelIndex] ?? boostBaneBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = boostBaneDifficultyMultipliers[baneLevel] ?? 0;

     if (!Number.isFinite(starsPerBoostBane) || starsPerBoostBane <= 0 || difficultyMultiplier <= 0) {
          return Infinity;
     }

     return Math.max(2, Math.round(starsPerBoostBane / difficultyMultiplier));
}

// ====================================================================================================
// TRAIL
// ====================================================================================================

export const playerTrailCountMax = 2;
export const playerTrailCountMin = 0;

export const playerTrailLifeMax = 64;
export const playerTrailLifeMin = 12;

export const playerTrailWidthMax = 10;
export const playerTrailWidthMin = 2;

export const playerTrailOffsetMax = 25;
export const playerTrailOffsetMin = -25;

export const playerTrailLengthMax = 32;
export const playerTrailLengthMin = 2;

// Negative raises the ribbon anchor above the player center; positive lowers it.
export const playerTrailAnchorYOffset = -4;

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
          if (colorRole === "star") {
               return getCssColor("--color-gray2", "#666");
          }

          if (colorRole === "strike" || colorRole === "bane") {
               return getCssColor("--color-black", "#000");
          }

          if (colorRole === "boost") {
               return getCssColor("--color-white", "#fff");
          }

     }

     return fallback;
}

export function getParticleFillColor(particle) {
     return getModeParticleColor(particle.colorRole, particle.color, particle.colorIndex);
}

export function getParticleGlowColor(fillColor) {
     return colorLevel === 2
          ? getCssColor("--color-white", "#ffffff")
          : fillColor;
}

export function resetEntityColorCycle() {
     if (particleColorEngine.engine?.reset) {
          particleColorEngine.engine.reset();
     }

     pastelParticleColorIndex = 0;
     particleColorEngine.engine = null;
}

// ==================================================
// PLAYER HELPERS
// ==================================================

function getPlayerMovementMultiplier() {
     if (isBoostBaneActive("freeze")) {
          return 0;
     }

     return 1;
}

function createPlayerTrail(fromX, fromY, toX, toY) {
     const dx = toX - fromX;
     const dy = toY - fromY;
     const distance = Math.hypot(dx, dy);

     if (distance < 0.5) {
          return;
     }

     const directionX = dx / distance;
     const directionY = dy / distance;
     const normalX = -directionY;
     const normalY = directionX;
     const trailCount =
          Math.floor(Math.random() * (playerTrailCountMax - playerTrailCountMin + 1)) +
          playerTrailCountMin;

     for (let i = 0; i < trailCount; i += 1) {
          const life = Math.random() * (playerTrailLifeMax - playerTrailLifeMin) + playerTrailLifeMin;
          const width = Math.random() * (playerTrailWidthMax - playerTrailWidthMin) + playerTrailWidthMin;
          const offset = Math.random() * (playerTrailOffsetMax - playerTrailOffsetMin) + playerTrailOffsetMin;
          const length = Math.random() * (playerTrailLengthMax - playerTrailLengthMin) + playerTrailLengthMin;

          const trailFromX = toX - (directionX * length);
          const trailFromY = toY - (directionY * length);

          playerTrail.push({
               fromX: trailFromX + (normalX * offset),
               fromY: trailFromY + (normalY * offset),
               toX: toX + (normalX * offset),
               toY: toY + (normalY * offset),
               colorRole: "trail",
               colorIndex: getNextPastelColorIndex(),
               color: getNextParticleColor(),
               life,
               maxLife: life,
               width
          });
     }
}

export function getDefaultPlayerFace() {
     if (playerHealth <= 0) {
          return playerFaces.dead;
     }

     if (isBoostBaneActive("freeze")) {
          return playerFaces.frozen;
     }

     if (isBoostBaneActive("daze")) {
          return playerFaces.dazed;
     }

     if (playerHealth === maxPlayerHealth) {
          return playerFaces.maxHealth;
     }

     if (playerHealth <= 2) {
          return playerFaces.lowHealth;
     }

     return playerFaces.smile;
}

export function refreshPlayerFaceFromHealth() {
     player.char = getDefaultPlayerFace();
}

export function updatePlayerSpeedFromHealth() {
     const diff = playerHealth - playerBaseHealth;
     player.speed = Math.max(0, playerBaseSpeed + (diff * playerSpeedPerHeart));
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
          isBoostBaneActive("freeze") ||
          isBoostBaneActive("daze")
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

     const dx = target.x - player.x;
     const dy = target.y - player.y;
     const distance = Math.hypot(dx, dy);

     if (distance <= touchArriveDistance) {
          return true;
     }

     const reverseMultiplier = isBoostBaneActive("daze") ? -1 : 1;
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
     const reverseMultiplier = isBoostBaneActive("daze") ? -1 : 1;
     const speed = player.speed * getPlayerMovementMultiplier();

     player.x += (dx / length) * speed * reverseMultiplier;
     player.y += (dy / length) * speed * reverseMultiplier;

     return true;
}

function movePlayerFromJoystick() {
     if (
          movementLevel !== movementOptionIndexes.joystickLeft &&
          movementLevel !== movementOptionIndexes.joystickRight
     ) {
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

     const reverseMultiplier = isBoostBaneActive("daze") ? -1 : 1;
     const speed = player.speed * getPlayerMovementMultiplier();

     player.x += joystick.dx * speed * reverseMultiplier;
     player.y += joystick.dy * speed * reverseMultiplier;

     return true;
}

export function updatePlayer() {
     const previousX = player.x;
     const previousY = player.y;

     if (!movePlayerFromJoystick() && !movePlayerTowardPointerTarget()) {
          movePlayerFromKeyboard();
     }

     clampPlayerToCanvas();

     if (player.x !== previousX || player.y !== previousY) {
          createPlayerTrail(
               previousX,
               previousY + playerTrailAnchorYOffset,
               player.x,
               player.y + playerTrailAnchorYOffset
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
     for (let i = playerTrail.length - 1; i >= 0; i -= 1) {
          const trail = playerTrail[i];

          trail.life -= 1;

          if (trail.life <= 0) {
               playerTrail.splice(i, 1);
          }
     }
}

// ==================================================
// EFFECT HELPERS
// ==================================================

const timedBoostBaneNames = [
     "magnet",
     "double",
     "freeze",
     "daze",
     "fog"
];

export function secondsToFrames(seconds) {
     return Math.round(seconds * framesPerSecond);
}

function getBoostBaneDurationFrames(boostBaneType) {
     return secondsToFrames(boostBaneType.durationSeconds || 0);
}

function getStatusFlashFrames() {
     return secondsToFrames(statusFlashSeconds);
}

function clearTimedBoostBanes() {
     timedBoostBaneNames.forEach((boostBaneName) => {
          setBoostBaneTimer(boostBaneName, 0);
     });
}

function syncScoreMultiplierFromBoostBanes() {
     const nextMultiplier = isBoostBaneActive("double") ? 2 : 1;

     if (scoreMultiplier !== nextMultiplier) {
          setScoreMultiplier(nextMultiplier);
     }
}

function setSingleTimedBoostBane(boostBaneName, durationFrames) {
     clearTimedBoostBanes();
     setBoostBaneTimer(boostBaneName, durationFrames);
     syncScoreMultiplierFromBoostBanes();
}

function getHighestPriorityActiveBoostBane() {
     const statusPriority = [
          "freeze",
          "fog",
          "daze",
          "double",
          "magnet"
     ];

     for (let i = 0; i < statusPriority.length; i += 1) {
          const boostBaneName = statusPriority[i];

          if (isBoostBaneActive(boostBaneName)) {
               return boostBaneName;
          }
     }

     return "";
}

function getBoostBaneTypeByName(boostBaneName) {
     return (
          boostTypes.find((type) => type.name === boostBaneName) ||
          baneTypes.find((type) => type.name === boostBaneName) ||
          null
     );
}

function syncActiveStatusUiFromBoostBanes() {
     const activeBoostBaneName = getHighestPriorityActiveBoostBane();

     if (!activeBoostBaneName) {
          clearActiveStatusUi();
          return;
     }

     const type = getBoostBaneTypeByName(activeBoostBaneName);

     if (!type) {
          clearActiveStatusUi();
          return;
     }

     if (type.lastsUntilUsed) {
          setActiveStatusUi(type.label, type.particle, 0, 0);
          return;
     }

     setActiveStatusUi(
          type.label,
          type.particle,
          boostBaneTimers[type.name] || 0,
          getBoostBaneDurationFrames(type)
     );
}

export function updateBoostBaneState() {
     decrementBoostBaneTimers();
     syncScoreMultiplierFromBoostBanes();
     syncActiveStatusUiFromBoostBanes();
}

function applyBoostPickup(type) {
     if (type.name === "health") {
          addPlayerHealth(progressUnitsPerCircle);
          syncPlayerHealthState();
          return;
     }

     setSingleTimedBoostBane(type.name, getBoostBaneDurationFrames(type));
     syncActiveStatusUiFromBoostBanes();
}

function applyBanePickup(type) {
     setSingleTimedBoostBane(type.name, getBoostBaneDurationFrames(type));
     syncActiveStatusUiFromBoostBanes();
}

function getObjectFallSpeedMultiplier() {
     return 1;
}

// ==================================================
// STARS + STRIKES
// ==================================================

export const starParticles = ["✦", "✧"];
export const strikeParticles = ["\u2716\uFE0E", "\u2715\uFE0E"];
export const strikeAssetSrc = "./images/icons/strike.svg";

function getStarCollisionRadiusMultiplier() {
     if (!isBoostBaneActive("magnet")) {
          return 1;
     }

     return magnetCollisionRadiusMultiplier;
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
          size: randomNumber(getGameParticleSizeMin() * 1.1, getGameParticleSizeMax() * 1.15),
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

function createMatchingStrikeFromStarSpawn() {
     if (!areStrikesUnlockedForCurrentLevel()) {
          return;
     }

     if (Math.random() > strikeSpawnRatio) {
          return;
     }

     if (strikes.length >= getScaledStrikeSpawnCap()) {
          return;
     }

     createStrike();
}

export function updateStarSpawns() {
     const nextStarSpawnTimer = starSpawnTimer + 1;
     setStarSpawnTimer(nextStarSpawnTimer);

     const starSpawnJitter = Math.random() * 8;

     if (nextStarSpawnTimer >= getScaledStarSpawnDelay() + starSpawnJitter) {
          if (stars.length < getScaledStarSpawnCap()) {
               createStar();
               createMatchingStrikeFromStarSpawn();
               maybeCreateBoostBanePickupsFromStarSpawn();
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
          playSoundEffect("star");
     }
}

export function collectStrikes() {
     for (let i = strikes.length - 1; i >= 0; i -= 1) {
          const strike = strikes[i];

          if (!isCollidingWithStar(player, strike)) {
               continue;
          }

          createCollisionBurst(strike.x, strike.y, strike.color, "bane");
          strikes.splice(i, 1);

          addPlayerHealth(-strikeHealthDamage);
          syncPlayerHealthState();
          applyTemporaryPlayerFace(playerFaces.bane, 30);
          triggerPlayerFacePop(1.25);
          playSoundEffect("strike");
     }
}

// ==================================================
// EFFECT PICKUPS
// ==================================================

function createBoostBanePickup(type, category) {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     boostBanePickups.push({
          x,
          baseX: x,
          y: -20,
          speed: getFallingObjectSpeed(),
          size: category === "boost"
               ? randomNumber(getGameParticleSizeMin() * 1.25, getGameParticleSizeMax() * 1.15)
               : randomNumber(getGameParticleSizeMin() * 1.5, getGameParticleSizeMax() * 1.25),
          particle: type.particle,
          type,
          category,
          colorRole: category === "boost" ? "boost" : "bane",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });

     announceNewBoostBaneEntity(type);
}

export function createBoostPickup() {
     createBoostBanePickup(randomItem(boostTypes), "boost");
     return true;
}

export function createBanePickup() {
     const unlockedBaneNames = getUnlockedBaneNamesForCurrentLevel();
     const availableBoostBaneTypes = baneTypes.filter((type) => unlockedBaneNames.includes(type.name));

     if (availableBoostBaneTypes.length <= 0) {
          return false;
     }

     createBoostBanePickup(randomItem(availableBoostBaneTypes), "bane");
     return true;
}

function createRandomBoostBanePickup() {
     if (Math.random() < 0.5 && createBanePickup()) {
          return;
     }

     createBoostPickup();
}

export function maybeCreateBoostBanePickupsFromStarSpawn() {
     const boostBaneSpawnChance = getBoostBaneSpawnChance();
     const boostBaneSpawnInterval = getBoostBaneSpawnInterval();
     const nextBoostBanePickupSpawnTimer = boostBanePickupSpawnTimer + 1;

     if (boostBanePickups.length >= getScaledBoostBanePickupCap()) {
          return;
     }

     if (!Number.isFinite(boostBaneSpawnInterval)) {
          setBoostBanePickupSpawnTimer(0);
          return;
     }

     setBoostBanePickupSpawnTimer(nextBoostBanePickupSpawnTimer);

     if (nextBoostBanePickupSpawnTimer >= boostBaneSpawnInterval) {
          createRandomBoostBanePickup();
          setBoostBanePickupSpawnTimer(0);
          return;
     }

     if (boostBaneSpawnChance > 0 && Math.random() <= boostBaneSpawnChance) {
          createBoostPickup();
          setBoostBanePickupSpawnTimer(0);
     }

     if (boostBanePickups.length >= getScaledBoostBanePickupCap()) {
          return;
     }

     if (boostBaneSpawnChance > 0 && Math.random() <= boostBaneSpawnChance) {
          createBanePickup();
          setBoostBanePickupSpawnTimer(0);
     }
}

export function updateBoostBanePickups() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = boostBanePickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostBanePickups[i];

          pickup.y += pickup.speed * fallSpeedMultiplier;
          pickup.wobbleOffset += pickup.wobbleSpeed;
          pickup.x = pickup.baseX + Math.sin(pickup.wobbleOffset) * pickup.wobbleAmount;

          if (pickup.y > miniGameHeight + 30) {
               boostBanePickups.splice(i, 1);
          }
     }
}

function collectBoostPickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "star", "boost");
     boostBanePickups.splice(index, 1);

     applyBoostPickup(pickup.type);
     applyTemporaryPlayerFace(playerFaces.star, 45);
     triggerPlayerFacePop(1.2);
     playSoundEffect("boost");
}

function collectBanePickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "bane", "bane");
     boostBanePickups.splice(index, 1);

     applyBanePickup(pickup.type);
     syncPlayerHealthState();
     applyTemporaryPlayerFace(playerFaces.bane, 30);
     triggerPlayerFacePop(1.25);
     playSoundEffect("bane");
}

export function collectBoostBanePickups() {
     for (let i = boostBanePickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostBanePickups[i];

          if (!isCollidingWithStar(player, pickup)) {
               continue;
          }

          if (pickup.category === "boost") {
               collectBoostPickup(pickup, i);
          } else {
               collectBanePickup(pickup, i);
          }
     }
}

// ==================================================
// COLLISION BURSTS
// ==================================================

export const burstChars = ["✦", "✧", "·", "•"];

export function createCollisionBurst(x, y, color, burstType, colorRole = null) {
     for (let i = 0; i < collisionBurstParticleCount; i += 1) {
          const angle = randomNumber(0, Math.PI * 2);
          const speed = burstType === "bane"
               ? randomNumber(1.1, 2.6)
               : randomNumber(0.7, 2.1);

          collisionBursts.push({
               x,
               y,
               dx: Math.cos(angle) * speed,
               dy: Math.sin(angle) * speed,
               life: randomNumber(25, 50),
               maxLife: 50,
               size: randomNumber(20, 30),
               particle: randomItem(burstChars),
               colorRole: colorRole || (burstType === "bane" ? "strike" : "star"),
               colorIndex: getNextPastelColorIndex(),
               color,
               glowBoost: burstType === "bane" ? 1.25 : 1
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

export function drawBoostBanePickups() {
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
          miniGameCtx.globalAlpha = pickup.category === "boost" ? 1 : 0.95;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.drawImage(tintCanvas, assetX, assetY, size, size);
          miniGameCtx.restore();
     }

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = boostBanePickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostBanePickups[i];
          const fillColor = getParticleFillColor(pickup);

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

          miniGameCtx.globalAlpha = pickup.category === "boost" ? 1 : 0.95;
          miniGameCtx.fillText(pickup.particle, pickup.x, pickup.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.fillText(pickup.particle, pickup.x, pickup.y);

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
          miniGameCtx.shadowBlur = glowBlur * burst.glowBoost * lifeRatio;

          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.95);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.8);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.restore();
     }
}
