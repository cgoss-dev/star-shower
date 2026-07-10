// NOTE: entities/index
// Player behavior, stars, boost/blight pickups, collision bursts, and boost/blight state for Star Shower.
//
// Owned here:
// - player reset / clamping / movement / face-state sync / trail-state updates
// - star spawning / updates / collection
// - boost and blight pickup definitions
// - active boost/blight timers and status sync
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
     boostblightPickups,
     collisionBursts,
     starSpawnTimer,
     starSpawnCount,
     boostblightPickupSpawnTimer,
     blightLevel,
     movementLevel,
     colorLevel,
     boostblightTimers,
     setStarSpawnTimer,
     addStarSpawnCount,
     setBoostblightPickupSpawnTimer,
     addStarScore,
     setScoreMultiplier,
     addPlayerHealth,
     setPlayerHealth,
     setBoostblightTimer,
     isBoostblightActive,
     decrementBoostblightTimers,
     setActiveStatusUi,
     clearActiveStatusUi,
     randomItem,
     randomNumber,
     isCollidingWithStar
} from "../state.js";

import {
     maxPlayerHealth,
     particleGlowBlurFallback,
     starSizeMinFallback,
     starSizeMaxFallback,
     strikeHealthDamage,
     magnetCollisionRadiusMultiplier,
     statusFlashSeconds,
     touchArriveDistance,
     movementOptionIndexes
} from "../options.js";

import {
     areStrikesUnlockedForCurrentLevel,
     progressUnitsPerCircle,
     getCurrentLevelNumber,
     getUnlockedBoostNamesForCurrentLevel,
     getUnlockedblightNamesForCurrentLevel,
     starShowerBoostblightIcons,
     starShowerGuideIcons,
     starShowerRainbowPalette,
     getCssColor,
     playSoundEffect
} from "../game.js";

import {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
     openingStrikeGraceStarSpawns,
     openingBoostblightGraceStarSpawns,
     boostblightPickupCap,
     collisionBurstParticleCount,
     fallingObjectSpeedMin,
     fallingObjectSpeedMax,
     spawnDensityBaselineArea,
     spawnDensityMinScale,
     spawnDensityMaxScale,
     fallSpeedMinScale,
     fallSpeedMaxScale,
     fallingObjectSpeedStep,
     boostblightBaseSpawnStarsByLevel,
     boostblightDifficultyMultipliers,
     playerTrailCountMax,
     playerTrailCountMin,
     playerTrailLifeMax,
     playerTrailLifeMin,
     playerTrailWidthMax,
     playerTrailWidthMin,
     playerTrailOffsetMax,
     playerTrailOffsetMin,
     playerTrailLengthMax,
     playerTrailLengthMin,
     playerTrailAnchorYOffset,
     starParticles,
     strikeParticles,
     strikeAssetSrc,
     burstChars
} from "./constants.js";

export {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
     openingStrikeGraceStarSpawns,
     openingBoostblightGraceStarSpawns,
     boostblightPickupCap,
     collisionBurstParticleCount,
     fallingObjectSpeedMin,
     fallingObjectSpeedMax,
     boostblightBaseSpawnStarsByLevel,
     boostblightDifficultyMultipliers,
     playerTrailCountMax,
     playerTrailCountMin,
     playerTrailLifeMax,
     playerTrailLifeMin,
     playerTrailWidthMax,
     playerTrailWidthMin,
     playerTrailOffsetMax,
     playerTrailOffsetMin,
     playerTrailLengthMax,
     playerTrailLengthMin,
     playerTrailAnchorYOffset,
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
     star: "😁",
     blight: "😫",
     maxHealth: "🤩",
     lowHealth: "😰",
     dead: "☠️",
     frozen: "🥶",
     dazed: "😵‍💫"
};

const pickupAssetImages = {};
let lastSpawnedBoostblightName = "";

function getBoostTypes() {
     return Object.values(starShowerBoostblightIcons).filter((type) => type.category === "boost");
}

function getblightTypes() {
     return Object.values(starShowerBoostblightIcons).filter((type) => type.category === "blight");
}

export function resetBoostblightIntroState() {
     lastSpawnedBoostblightName = "";
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

function getScaledBoostblightPickupCap() {
     return Math.max(1, Math.round(boostblightPickupCap * getSpawnDensityScale()));
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

function getBoostblightSpawnChance() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerBoostblight = boostblightBaseSpawnStarsByLevel[levelIndex] ?? boostblightBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = boostblightDifficultyMultipliers[blightLevel] ?? 0;

     if (!Number.isFinite(starsPerBoostblight) || starsPerBoostblight <= 0 || difficultyMultiplier <= 0) {
          return 0;
     }

     return difficultyMultiplier / starsPerBoostblight;
}

function getBoostblightSpawnInterval() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerBoostblight = boostblightBaseSpawnStarsByLevel[levelIndex] ?? boostblightBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = boostblightDifficultyMultipliers[blightLevel] ?? 0;

     if (!Number.isFinite(starsPerBoostblight) || starsPerBoostblight <= 0 || difficultyMultiplier <= 0) {
          return Infinity;
     }

     return Math.max(2, Math.round(starsPerBoostblight / difficultyMultiplier));
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

          if (colorRole === "strike" || colorRole === "blight") {
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

export function getParticleGlowColor() {
     return getCssColor("--color-white", "#ffffff");
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
     if (isBoostblightActive("freeze")) {
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

     if (isBoostblightActive("freeze")) {
          return playerFaces.frozen;
     }

     if (isBoostblightActive("daze")) {
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
          isBoostblightActive("freeze") ||
          isBoostblightActive("daze")
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

     const reverseMultiplier = isBoostblightActive("daze") ? -1 : 1;
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
     const reverseMultiplier = isBoostblightActive("daze") ? -1 : 1;
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

     const reverseMultiplier = isBoostblightActive("daze") ? -1 : 1;
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

const timedBoostblightNames = [
     "magnet",
     "double",
     "freeze",
     "daze",
     "fog"
];

export function secondsToFrames(seconds) {
     return Math.round(seconds * framesPerSecond);
}

function getBoostblightDurationFrames(boostblightType) {
     return secondsToFrames(boostblightType.durationSeconds || 0);
}

function getStatusFlashFrames() {
     return secondsToFrames(statusFlashSeconds);
}

function clearTimedBoostblights() {
     timedBoostblightNames.forEach((boostblightName) => {
          setBoostblightTimer(boostblightName, 0);
     });
}

function syncScoreMultiplierFromBoostblights() {
     const nextMultiplier = isBoostblightActive("double") ? 2 : 1;

     if (scoreMultiplier !== nextMultiplier) {
          setScoreMultiplier(nextMultiplier);
     }
}

function setSingleTimedBoostblight(boostblightName, durationFrames) {
     clearTimedBoostblights();
     setBoostblightTimer(boostblightName, durationFrames);
     syncScoreMultiplierFromBoostblights();
}

function getHighestPriorityActiveBoostblight() {
     const statusPriority = [
          "freeze",
          "fog",
          "daze",
          "double",
          "magnet"
     ];

     for (let i = 0; i < statusPriority.length; i += 1) {
          const boostblightName = statusPriority[i];

          if (isBoostblightActive(boostblightName)) {
               return boostblightName;
          }
     }

     return "";
}

function getBoostblightTypeByName(boostblightName) {
     return (
          getBoostTypes().find((type) => type.name === boostblightName) ||
          getblightTypes().find((type) => type.name === boostblightName) ||
          null
     );
}

function syncActiveStatusUiFromBoostblights() {
     const activeBoostblightName = getHighestPriorityActiveBoostblight();

     if (!activeBoostblightName) {
          clearActiveStatusUi();
          return;
     }

     const type = getBoostblightTypeByName(activeBoostblightName);

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
          boostblightTimers[type.name] || 0,
          getBoostblightDurationFrames(type)
     );
}

export function updateBoostblightState() {
     // Active effect pseudocode:
     // 1. Count down all timed boost/blight effects.
     // 2. Recalculate derived effects, like the score multiplier.
     // 3. Mirror the highest-priority active effect into the HUD status slot.
     decrementBoostblightTimers();
     syncScoreMultiplierFromBoostblights();
     syncActiveStatusUiFromBoostblights();
}

function applyBoostPickup(type) {
     if (type.name === "health") {
          addPlayerHealth(progressUnitsPerCircle);
          syncPlayerHealthState();
          return;
     }

     setSingleTimedBoostblight(type.name, getBoostblightDurationFrames(type));
     syncActiveStatusUiFromBoostblights();
}

function applyblightPickup(type) {
     setSingleTimedBoostblight(type.name, getBoostblightDurationFrames(type));
     syncActiveStatusUiFromBoostblights();
}

function getObjectFallSpeedMultiplier() {
     return 1;
}

// ==================================================
// STARS + STRIKES
// ==================================================

function getStarCollisionRadiusMultiplier() {
     if (!isBoostblightActive("magnet")) {
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
     if (starSpawnCount <= openingStrikeGraceStarSpawns) {
          return;
     }

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
     // Spawn pseudocode:
     // 1. Advance the star timer with a little random jitter.
     // 2. Spawn a star if the timer and board cap allow it.
     // 3. Each star spawn can also unlock matching strikes and boost/blight pickups.
     const nextStarSpawnTimer = starSpawnTimer + 1;
     setStarSpawnTimer(nextStarSpawnTimer);

     const starSpawnJitter = Math.random() * 8;

     if (nextStarSpawnTimer >= getScaledStarSpawnDelay() + starSpawnJitter) {
          if (stars.length < getScaledStarSpawnCap()) {
               createStar();
               addStarSpawnCount();
               createMatchingStrikeFromStarSpawn();
               maybeCreateBoostblightPickupsFromStarSpawn();
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
          playSoundEffect("star");
     }
}

export function collectStrikes() {
     for (let i = strikes.length - 1; i >= 0; i -= 1) {
          const strike = strikes[i];

          if (!isCollidingWithStar(player, strike)) {
               continue;
          }

          createCollisionBurst(strike.x, strike.y, strike.color, "blight");
          strikes.splice(i, 1);

          addPlayerHealth(-strikeHealthDamage);
          syncPlayerHealthState();
          applyTemporaryPlayerFace(playerFaces.blight, 30);
          triggerPlayerFacePop(1.25);
          playSoundEffect("strike");
     }
}

// ==================================================
// EFFECT PICKUPS
// ==================================================

function createBoostblightPickup(type, category) {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     boostblightPickups.push({
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
          colorRole: category === "boost" ? "boost" : "blight",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });

     lastSpawnedBoostblightName = type.name || "";
}

function chooseBoostblightType(availableTypes) {
     if (availableTypes.length <= 1) {
          return availableTypes[0] || null;
     }

     const onBoardNames = new Set(boostblightPickups.map((pickup) => pickup.type?.name).filter(Boolean));
     const notOnBoardTypes = availableTypes.filter((type) => !onBoardNames.has(type.name));
     const boardFilteredTypes = notOnBoardTypes.length ? notOnBoardTypes : availableTypes;
     const notLastTypes = boardFilteredTypes.filter((type) => type.name !== lastSpawnedBoostblightName);
     const finalTypes = notLastTypes.length ? notLastTypes : boardFilteredTypes;

     return randomItem(finalTypes);
}

function createBoostblightPickupFromTypes(availableTypes, category) {
     const type = chooseBoostblightType(availableTypes);

     if (!type) {
          return false;
     }

     createBoostblightPickup(type, category);
     return true;
}

export function createBoostPickup() {
     const unlockedBoostNames = getUnlockedBoostNamesForCurrentLevel();
     const availableBoostblightTypes = getBoostTypes().filter((type) => unlockedBoostNames.includes(type.name));

     if (availableBoostblightTypes.length <= 0) {
          return false;
     }

     createBoostblightPickupFromTypes(availableBoostblightTypes, "boost");
     return true;
}

export function createblightPickup() {
     const unlockedblightNames = getUnlockedblightNamesForCurrentLevel();
     const availableBoostblightTypes = getblightTypes().filter((type) => unlockedblightNames.includes(type.name));

     if (availableBoostblightTypes.length <= 0) {
          return false;
     }

     createBoostblightPickupFromTypes(availableBoostblightTypes, "blight");
     return true;
}

function createRandomBoostblightPickup() {
     if (Math.random() < 0.5 && createblightPickup()) {
          return;
     }

     createBoostPickup();
}

export function maybeCreateBoostblightPickupsFromStarSpawn() {
     // Boost/blight spawn pseudocode:
     // 1. Wait through the opening grace period.
     // 2. Respect the on-screen pickup cap and disabled difficulty states.
     // 3. Guarantee an early pickup after grace, then use interval/chance checks.
     const boostblightSpawnChance = getBoostblightSpawnChance();
     const boostblightSpawnInterval = getBoostblightSpawnInterval();
     const nextBoostblightPickupSpawnTimer = boostblightPickupSpawnTimer + 1;

     if (starSpawnCount < openingBoostblightGraceStarSpawns) {
          setBoostblightPickupSpawnTimer(0);
          return;
     }

     if (boostblightPickups.length >= getScaledBoostblightPickupCap()) {
          return;
     }

     if (!Number.isFinite(boostblightSpawnInterval)) {
          setBoostblightPickupSpawnTimer(0);
          return;
     }

     if (starSpawnCount === openingBoostblightGraceStarSpawns) {
          createRandomBoostblightPickup();
          setBoostblightPickupSpawnTimer(0);
          return;
     }

     setBoostblightPickupSpawnTimer(nextBoostblightPickupSpawnTimer);

     if (nextBoostblightPickupSpawnTimer >= boostblightSpawnInterval) {
          createRandomBoostblightPickup();
          setBoostblightPickupSpawnTimer(0);
          return;
     }

     if (boostblightSpawnChance > 0 && Math.random() <= boostblightSpawnChance) {
          createBoostPickup();
          setBoostblightPickupSpawnTimer(0);
     }

     if (boostblightPickups.length >= getScaledBoostblightPickupCap()) {
          return;
     }

     if (boostblightSpawnChance > 0 && Math.random() <= boostblightSpawnChance) {
          createblightPickup();
          setBoostblightPickupSpawnTimer(0);
     }
}

export function updateBoostblightPickups() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = boostblightPickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostblightPickups[i];

          pickup.y += pickup.speed * fallSpeedMultiplier;
          pickup.wobbleOffset += pickup.wobbleSpeed;
          pickup.x = pickup.baseX + Math.sin(pickup.wobbleOffset) * pickup.wobbleAmount;

          if (pickup.y > miniGameHeight + 30) {
               boostblightPickups.splice(i, 1);
          }
     }
}

function collectBoostPickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "star", "boost");
     boostblightPickups.splice(index, 1);

     applyBoostPickup(pickup.type);
     applyTemporaryPlayerFace(playerFaces.star, 45);
     triggerPlayerFacePop(1.2);
     playSoundEffect("boost");
}

function collectblightPickup(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "blight", "blight");
     boostblightPickups.splice(index, 1);

     applyblightPickup(pickup.type);
     syncPlayerHealthState();
     applyTemporaryPlayerFace(playerFaces.blight, 30);
     triggerPlayerFacePop(1.25);
     playSoundEffect("blight");
}

export function collectBoostblightPickups() {
     for (let i = boostblightPickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostblightPickups[i];

          if (!isCollidingWithStar(player, pickup)) {
               continue;
          }

          if (pickup.category === "boost") {
               collectBoostPickup(pickup, i);
          } else {
               collectblightPickup(pickup, i);
          }
     }
}

// ==================================================
// COLLISION BURSTS
// ==================================================

export function createCollisionBurst(x, y, color, burstType, colorRole = null) {
     for (let i = 0; i < collisionBurstParticleCount; i += 1) {
          const angle = randomNumber(0, Math.PI * 2);
          const speed = burstType === "blight"
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
               colorRole: colorRole || (burstType === "blight" ? "strike" : "star"),
               colorIndex: getNextPastelColorIndex(),
               color,
               glowBoost: burstType === "blight" ? 1.25 : 1
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

export function drawBoostblightPickups() {
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

     for (let i = boostblightPickups.length - 1; i >= 0; i -= 1) {
          const pickup = boostblightPickups[i];
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
