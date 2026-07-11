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
     setScoreMultiplier,
     addPlayerHealth,
     setPlayerHealth,
     setHelphurtTimer,
     isHelphurtActive,
     decrementHelphurtTimers,
     setActiveStatusUi,
     clearActiveStatusUi,
     randomItem,
     randomNumber,
     isCollidingWithStar
} from "../state.js?v=20260711-41";

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
} from "../options.js?v=20260711-41";

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
} from "../game.js?v=20260711-41";

import {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerSpeedMinScale,
     playerSpeedMaxScale,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
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
     helphurtBaseSpawnStarsByLevel,
     helphurtDifficultyMultipliers,
     helphurtFallSpeedMultipliersByLevel,
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
} from "./constants.js?v=20260711-41";

export {
     playerBaseHealth,
     playerBaseSpeed,
     playerSpeedPerHeart,
     playerSpeedMinScale,
     playerSpeedMaxScale,
     playerBaseSize,
     playerBaseRadius,
     framesPerSecond,
     starSpawnDelay,
     starSpawnCap,
     strikeSpawnRatio,
     openingStrikeGraceStarSpawns,
     openingHelphurtGraceStarSpawns,
     helphurtPickupCap,
     collisionBurstParticleCount,
     fallingObjectSpeedMin,
     fallingObjectSpeedMax,
     helphurtBaseSpawnStarsByLevel,
     helphurtDifficultyMultipliers,
     helphurtFallSpeedMultipliersByLevel,
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

function getHelphurtSpawnChance() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerHelphurt = helphurtBaseSpawnStarsByLevel[levelIndex] ?? helphurtBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = helphurtDifficultyMultipliers[hurtLevel] ?? 0;

     if (!Number.isFinite(starsPerHelphurt) || starsPerHelphurt <= 0 || difficultyMultiplier <= 0) {
          return 0;
     }

     return difficultyMultiplier / starsPerHelphurt;
}

function getHelphurtSpawnInterval() {
     const levelIndex = Math.max(0, getCurrentLevelNumber() - 1);
     const starsPerHelphurt = helphurtBaseSpawnStarsByLevel[levelIndex] ?? helphurtBaseSpawnStarsByLevel.at(-1);
     const difficultyMultiplier = helphurtDifficultyMultipliers[hurtLevel] ?? 0;

     if (!Number.isFinite(starsPerHelphurt) || starsPerHelphurt <= 0 || difficultyMultiplier <= 0) {
          return Infinity;
     }

     return Math.max(2, Math.round(starsPerHelphurt / difficultyMultiplier));
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

function getNextHealthParticle() {
     const particle = starShowerHealthParticles[healthParticleIndex % starShowerHealthParticles.length] || "❤️";
     healthParticleIndex += 1;
     return particle;
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

     if (isHelphurtActive("freeze")) {
          return playerFaces.frozen;
     }

     if (isHelphurtActive("daze")) {
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
     const healthAdjustedSpeed = playerBaseSpeed + (diff * playerSpeedPerHeart);
     const screenScale = getScreenAreaScale(playerSpeedMinScale, playerSpeedMaxScale);

     player.speed = Math.max(0, healthAdjustedSpeed * screenScale);
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
          addPlayerHealth(1);
          syncPlayerHealthState();
          return;
     }

     setStackedTimedHelphurt(type.name, getHelphurtDurationFrames(type));
     syncActiveStatusUiFromHelphurts();
}

function applyHurtPickup(type) {
     addPlayerHealth(-strikeHealthDamage);
     setStackedTimedHelphurt(type.name, getHelphurtDurationFrames(type));
     syncPlayerHealthState();
     syncActiveStatusUiFromHelphurts();
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
          applyTemporaryPlayerFace(playerFaces.hurt, 30);
          triggerPlayerFacePop(1.25);
     }
}

// ==================================================
// EFFECT PICKUPS
// ==================================================

function createHelphurtPickup(type, category) {
     const x = Math.random() * (miniGameWidth - 20) + 10;
     const particle = type.name === "health"
          ? getNextHealthParticle()
          : type.particle;

     helphurtPickups.push({
          x,
          baseX: x,
          y: -20,
          speed: getFallingObjectSpeed(),
          size: randomNumber(getGameParticleSizeMin(), getGameParticleSizeMax()),
          particle,
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
     // 2. Respect the on-screen pickup cap and disabled difficulty states.
     // 3. Guarantee an early pickup after grace, then use interval/chance checks.
     const helphurtSpawnChance = getHelphurtSpawnChance();
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

     if (helphurtSpawnChance > 0 && Math.random() <= helphurtSpawnChance) {
          createHelpPickup();
          setHelphurtPickupSpawnTimer(0);
     }

     if (helphurtPickups.length >= getScaledHelphurtPickupCap()) {
          return;
     }

     if (helphurtSpawnChance > 0 && Math.random() <= helphurtSpawnChance) {
          createHurtPickup();
          setHelphurtPickupSpawnTimer(0);
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
     showGameplayPopup(`${pickup.type?.particle || "⭐"} ${pickup.type?.label || "HELP"}`);
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
     for (let i = 0; i < collisionBurstParticleCount; i += 1) {
          const angle = randomNumber(0, Math.PI * 2);
          const speed = burstType === "hurt"
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
               colorRole: colorRole || (burstType === "hurt" ? "strike" : "star"),
               colorIndex: getNextPastelColorIndex(),
               color,
               glowHelp: burstType === "hurt" ? 1.25 : 1
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
          miniGameCtx.shadowBlur = glowBlur * burst.glowHelp * lifeRatio;

          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.95);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = Math.max(0, lifeRatio * 0.8);
          miniGameCtx.fillText(burst.particle, burst.x, burst.y);

          miniGameCtx.restore();
     }
}
