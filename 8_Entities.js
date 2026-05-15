// NOTE: 8_Entities
// Player behavior, sparkles, effect pickups, collision bursts, and effect state for Sparkle Seeker.
//
// Owned here:
// - player reset / clamping / movement / face-state sync / trail-state updates
// - sparkle spawning / updates / collection
// - helpful and harmful pickup definitions
// - active effect timers and status sync
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
     sparkleScore,
     scoreMultiplier,
     sparkles,
     healthHazards,
     effectPickups,
     collisionBursts,
     sparkleSpawnTimer,
     harmfulLevel,
     movementLevel,
     colorLevel,
     effectTimers,
     setSparkleSpawnTimer,
     addSparkleScore,
     setScoreMultiplier,
     addPlayerHealth,
     setPlayerHealth,
     setEffectTimer,
     isEffectActive,
     decrementEffectTimers,
     setActiveStatusUi,
     clearActiveStatusUi,
     randomItem,
     randomNumber,
     isCollidingWithSparkle
} from "./3_State.js";

import {
     maxPlayerHealth,
     particleGlowBlurFallback,
     sparkleSizeMinFallback,
     sparkleSizeMaxFallback,
     sparkleHealthGain,
     harmfulHealthDamage,
     magnetCollisionRadiusMultiplier,
     statusFlashSeconds,
     gameplayStartingHealth,
     touchArriveDistance,
     movementOptionIndexes
} from "./4_Options.js";

import {
     areHealthHazardsUnlockedForCurrentLevel,
     getCurrentLevelNumber,
     getUnlockedHarmfulEffectNamesForCurrentLevel
} from "./5_GameRules.js";

import {
     sparkleSeekerEffectIcons,
     sparkleSeekerRainbowPalette,
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
     sparkle: "😁",
     harmful: "😫",
     maxHealth: "🤩",
     lowHealth: "😰",
     dead: "☠️",
     frozen: "🥶",
     dazed: "😵‍💫"
};

export const playerBaseHealth = gameplayStartingHealth;
export const playerBaseSpeed = 3;
export const playerSpeedPerHeart = 0.25;
export const playerBaseSize = 64;
export const playerBaseRadius = 30;

// ====================================================================================================
// NOTE: BALANCE
// ====================================================================================================

export const framesPerSecond = 60;

export const sparkleSpawnDelay = 25;
export const sparkleSpawnCap = 50;
export const hazardSpawnRatio = 0.5;
export const effectPickupCap = 60;
export const collisionBurstParticleCount = 15;

// Effects are spawned as a ratio of successful sparkle spawns:
export const effectSpawnRatios = [
     0,
     0,
     1 / 24,
     1 / 16,
     1 / 8
];

const effectTypes = Object.values(sparkleSeekerEffectIcons);

export const helpfulEffectTypes = effectTypes.filter((type) => type.category === "helpful");
export const harmfulEffectTypes = effectTypes.filter((type) => type.category === "harmful");

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
     return sparkleSeekerRainbowPalette.filter(Boolean);
}

function getGameParticleSizeMin() {
     return siteTheme?.getSparkleSettings?.().sizeMin ?? sparkleSizeMinFallback;
}

function getGameParticleSizeMax() {
     return siteTheme?.getSparkleSettings?.().sizeMax ?? sparkleSizeMaxFallback;
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

function getHighContrastEnemyColor(colorIndex = 0) {
     const colors = ["#0ff", "#f0f", "#ff0"];
     const normalizedIndex = Math.abs(Math.round(Number(colorIndex) || 0)) % colors.length;

     return colors[normalizedIndex];
}

export function getModeParticleColor(colorRole, fallback = "#ffffff", colorIndex = 0) {
     if (colorLevel !== 3 && colorRole === "sparkle") {
          return getCssColor("--color-white", "#fff");
     }

     if (colorLevel === 0) {
          if (colorRole === "hazard") {
               return getHighContrastEnemyColor(colorIndex);
          }

          if (colorRole === "effect") {
               return getHighContrastEnemyColor(colorIndex);
          }

          if (colorRole === "trail") {
               return getCssColor("--color-white", "#fff");
          }
     }

     if (colorLevel === 2) {
          return getPastelParticleColor(colorIndex);
     }

     if (colorLevel === 3) {
          if (colorRole === "sparkle") {
               return getCssColor("--color-gray2", "#666");
          }

          if (colorRole === "hazard") {
               return getCssColor("--color-black", "#000");
          }

          if (colorRole === "effect") {
               return getCssColor("--color-white", "#fff");
          }

          if (colorRole === "trail") {
               return getCssColor("--color-gray2", "#666");
          }
     }

     return fallback;
}

export function getParticleFillColor(particle) {
     return getModeParticleColor(particle.colorRole, particle.color, particle.colorIndex);
}

export function getParticleGlowColor(fillColor) {
     return colorLevel === 3
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
     if (isEffectActive("freeze")) {
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

     if (isEffectActive("freeze")) {
          return playerFaces.frozen;
     }

     if (isEffectActive("daze")) {
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
          isEffectActive("freeze") ||
          isEffectActive("daze")
     ) {
          player.sparkleFaceTimer = 0;
          refreshPlayerFaceFromHealth();
          return;
     }

     player.char = face;
     player.sparkleFaceTimer = duration;
}

export function triggerPlayerFacePop(scale = 1.1) {
     player.hitScale = Math.max(player.hitScale, scale);
}

export function getPlayerLevelScale() {
     return getCurrentLevelNumber() >= 5 ? 1.1 : 1;
}

export function applyPlayerLevelScale() {
     const levelScale = getPlayerLevelScale();

     player.size = playerBaseSize * levelScale;
     player.radius = playerBaseRadius * levelScale;
     clampPlayerToCanvas();
}

export function resetPlayerPosition() {
     player.x = miniGameWidth / 2;
     player.y = miniGameHeight * 0.75;
     player.size = playerBaseSize;
     player.radius = playerBaseRadius;
     player.sparkleFaceTimer = 0;
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

     const reverseMultiplier = isEffectActive("daze") ? -1 : 1;
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
     const reverseMultiplier = isEffectActive("daze") ? -1 : 1;
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

     const reverseMultiplier = isEffectActive("daze") ? -1 : 1;
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
     applyPlayerLevelScale();

     if (gamePaused) {
          player.char = gameWon ? playerFaces.sparkle : playerFaces.neutral;
          player.hitScale = 1;
          return;
     }

     if (player.sparkleFaceTimer > 0) {
          player.sparkleFaceTimer -= 1;
     }

     if (player.sparkleFaceTimer <= 0) {
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

const timedEffectNames = [
     "luck",
     "magnet",
     "slowmo",
     "freeze",
     "daze",
     "fog"
];

export function secondsToFrames(seconds) {
     return Math.round(seconds * framesPerSecond);
}

function getEffectDurationFrames(effectType) {
     return secondsToFrames(effectType.durationSeconds || 0);
}

function getStatusFlashFrames() {
     return secondsToFrames(statusFlashSeconds);
}

function clearTimedEffects() {
     timedEffectNames.forEach((effectName) => {
          setEffectTimer(effectName, 0);
     });
}

function syncScoreMultiplierFromEffects() {
     const nextMultiplier = isEffectActive("luck") ? 2 : 1;

     if (scoreMultiplier !== nextMultiplier) {
          setScoreMultiplier(nextMultiplier);
     }
}

function setSingleTimedEffect(effectName, durationFrames) {
     clearTimedEffects();
     setEffectTimer(effectName, durationFrames);
     syncScoreMultiplierFromEffects();
}

function getHighestPriorityActiveEffect() {
     const statusPriority = [
          "freeze",
          "fog",
          "daze",
          "slowmo",
          "magnet",
          "luck"
     ];

     for (let i = 0; i < statusPriority.length; i += 1) {
          const effectName = statusPriority[i];

          if (isEffectActive(effectName)) {
               return effectName;
          }
     }

     return "";
}

function getEffectTypeByName(effectName) {
     return (
          helpfulEffectTypes.find((type) => type.name === effectName) ||
          harmfulEffectTypes.find((type) => type.name === effectName) ||
          null
     );
}

function syncActiveStatusUiFromEffects() {
     const activeEffectName = getHighestPriorityActiveEffect();

     if (!activeEffectName) {
          clearActiveStatusUi();
          return;
     }

     const type = getEffectTypeByName(activeEffectName);

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
          effectTimers[type.name] || 0,
          getEffectDurationFrames(type)
     );
}

export function updateEffectState() {
     decrementEffectTimers();
     syncScoreMultiplierFromEffects();
     syncActiveStatusUiFromEffects();
}

function applyHelpfulEffect(type) {
     setSingleTimedEffect(type.name, getEffectDurationFrames(type));
     syncActiveStatusUiFromEffects();
}

function applyHarmfulEffect(type) {
     setSingleTimedEffect(type.name, getEffectDurationFrames(type));
     syncActiveStatusUiFromEffects();
}

function getObjectFallSpeedMultiplier() {
     if (isEffectActive("slowmo")) {
          return 0.25;
     }

     return 1;
}

// ==================================================
// SPARKLES
// ==================================================

export const sparkleParticles = ["✦", "✧"];
export const hazardParticles = ["\u2716\uFE0E", "\u2715\uFE0E"];

function getSparkleCollisionRadiusMultiplier() {
     if (!isEffectActive("magnet")) {
          return 1;
     }

     return magnetCollisionRadiusMultiplier;
}

function isCollidingWithSparkleCollectionRadius(sparkle) {
     return isCollidingWithSparkle(
          {
               ...player,
               radius: player.radius * getSparkleCollisionRadiusMultiplier()
          },
          sparkle
     );
}

export function createSparkle() {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     sparkles.push({
          x,
          baseX: x,
          y: -20,
          speed: 0.25 + Math.random() * 0.5,
          size: Math.random() * (getGameParticleSizeMax() - getGameParticleSizeMin()) + getGameParticleSizeMin(),
          particle: sparkleParticles[Math.floor(Math.random() * sparkleParticles.length)],
          colorRole: "sparkle",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });
}

function createHealthHazard() {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     healthHazards.push({
          x,
          baseX: x,
          y: -20,
          speed: 0.3 + Math.random() * 0.6,
          size: randomNumber(getGameParticleSizeMin() * 1.1, getGameParticleSizeMax() * 1.15),
          particle: hazardParticles[Math.floor(Math.random() * hazardParticles.length)],
          colorRole: "hazard",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });
}

function createMatchingHealthHazardFromSparkleSpawn() {
     if (harmfulLevel <= 0) {
          return;
     }

     if (!areHealthHazardsUnlockedForCurrentLevel()) {
          return;
     }

     if (Math.random() > hazardSpawnRatio) {
          return;
     }

     if (healthHazards.length >= sparkleSpawnCap * hazardSpawnRatio) {
          return;
     }

     createHealthHazard();
}

export function updateSparkleSpawns() {
     const nextSparkleSpawnTimer = sparkleSpawnTimer + 1;
     setSparkleSpawnTimer(nextSparkleSpawnTimer);

     const sparkleSpawnJitter = Math.random() * 8;

     if (nextSparkleSpawnTimer >= sparkleSpawnDelay + sparkleSpawnJitter) {
          if (sparkles.length < sparkleSpawnCap) {
               createSparkle();
               createMatchingHealthHazardFromSparkleSpawn();
               maybeCreateEffectPickupsFromSparkleSpawn();
          }

          setSparkleSpawnTimer(0);
     }
}

export function updateSparkles() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = sparkles.length - 1; i >= 0; i -= 1) {
          const sparkle = sparkles[i];

          sparkle.y += sparkle.speed * fallSpeedMultiplier;
          sparkle.wobbleOffset += sparkle.wobbleSpeed;
          sparkle.x = sparkle.baseX + Math.sin(sparkle.wobbleOffset) * sparkle.wobbleAmount;

          if (sparkle.y > miniGameHeight + 30) {
               sparkles.splice(i, 1);
          }
     }
}

export function updateHealthHazards() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = healthHazards.length - 1; i >= 0; i -= 1) {
          const hazard = healthHazards[i];

          hazard.y += hazard.speed * fallSpeedMultiplier;
          hazard.wobbleOffset += hazard.wobbleSpeed;
          hazard.x = hazard.baseX + Math.sin(hazard.wobbleOffset) * hazard.wobbleAmount;

          if (hazard.y > miniGameHeight + 30) {
               healthHazards.splice(i, 1);
          }
     }
}

export function collectSparkles() {
     for (let i = sparkles.length - 1; i >= 0; i -= 1) {
          const sparkle = sparkles[i];

          if (!isCollidingWithSparkleCollectionRadius(sparkle)) {
               continue;
          }

          createCollisionBurst(sparkle.x, sparkle.y, sparkle.color, "sparkle");
          sparkles.splice(i, 1);

          addSparkleScore(1);
          addPlayerHealth(sparkleHealthGain);
          syncPlayerHealthState();
          applyTemporaryPlayerFace(playerFaces.sparkle, 60);
          triggerPlayerFacePop(1.25);
          playSoundEffect("sparkle");
     }
}

export function collectHealthHazards() {
     for (let i = healthHazards.length - 1; i >= 0; i -= 1) {
          const hazard = healthHazards[i];

          if (!isCollidingWithSparkle(player, hazard)) {
               continue;
          }

          createCollisionBurst(hazard.x, hazard.y, hazard.color, "harmful");
          healthHazards.splice(i, 1);

          addPlayerHealth(-harmfulHealthDamage);
          syncPlayerHealthState();
          applyTemporaryPlayerFace(playerFaces.harmful, 30);
          triggerPlayerFacePop(1.25);
          playSoundEffect("hazard");
     }
}

// ==================================================
// EFFECT PICKUPS
// ==================================================

function createEffectPickup(type, category) {
     const x = Math.random() * (miniGameWidth - 20) + 10;

     effectPickups.push({
          x,
          baseX: x,
          y: -20,
          speed: category === "helpful"
               ? 0.35 + Math.random() * 0.55
               : 0.5 + Math.random() * 0.7,
          size: category === "helpful"
               ? randomNumber(getGameParticleSizeMin() * 1.25, getGameParticleSizeMax() * 1.15)
               : randomNumber(getGameParticleSizeMin() * 1.5, getGameParticleSizeMax() * 1.25),
          particle: type.particle,
          type,
          category,
          colorRole: "effect",
          colorIndex: getNextPastelColorIndex(),
          color: getNextParticleColor(),
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03,
          wobbleAmount: 5 + Math.random() * 10
     });
}

export function createHelpfulEffect() {
     createEffectPickup(randomItem(helpfulEffectTypes), "helpful");
}

export function createHarmfulEffect() {
     const unlockedEffectNames = getUnlockedHarmfulEffectNamesForCurrentLevel();
     const availableEffectTypes = harmfulEffectTypes.filter((type) => unlockedEffectNames.includes(type.name));

     if (availableEffectTypes.length <= 0) {
          return;
     }

     createEffectPickup(randomItem(availableEffectTypes), "harmful");
}

export function maybeCreateEffectPickupsFromSparkleSpawn() {
     const effectSpawnChance = effectSpawnRatios[harmfulLevel] ?? 0;

     if (effectPickups.length >= effectPickupCap) {
          return;
     }

     if (effectSpawnChance > 0 && Math.random() <= effectSpawnChance) {
          createHelpfulEffect();
     }

     if (effectPickups.length >= effectPickupCap) {
          return;
     }

     if (effectSpawnChance > 0 && Math.random() <= effectSpawnChance) {
          createHarmfulEffect();
     }
}

export function updateEffectPickups() {
     const fallSpeedMultiplier = getObjectFallSpeedMultiplier();

     for (let i = effectPickups.length - 1; i >= 0; i -= 1) {
          const pickup = effectPickups[i];

          pickup.y += pickup.speed * fallSpeedMultiplier;
          pickup.wobbleOffset += pickup.wobbleSpeed;
          pickup.x = pickup.baseX + Math.sin(pickup.wobbleOffset) * pickup.wobbleAmount;

          if (pickup.y > miniGameHeight + 30) {
               effectPickups.splice(i, 1);
          }
     }
}

function collectHelpfulEffect(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "sparkle", "effect");
     effectPickups.splice(index, 1);

     applyHelpfulEffect(pickup.type);
     applyTemporaryPlayerFace(playerFaces.sparkle, 45);
     triggerPlayerFacePop(1.2);
     playSoundEffect("helpfulEffect");
}

function collectHarmfulEffect(pickup, index) {
     createCollisionBurst(pickup.x, pickup.y, pickup.color, "harmful", "effect");
     effectPickups.splice(index, 1);

     applyHarmfulEffect(pickup.type);
     syncPlayerHealthState();
     applyTemporaryPlayerFace(playerFaces.harmful, 30);
     triggerPlayerFacePop(1.25);
     playSoundEffect("harmfulEffect");
}

export function collectEffectPickups() {
     for (let i = effectPickups.length - 1; i >= 0; i -= 1) {
          const pickup = effectPickups[i];

          if (!isCollidingWithSparkle(player, pickup)) {
               continue;
          }

          if (pickup.category === "helpful") {
               collectHelpfulEffect(pickup, i);
          } else {
               collectHarmfulEffect(pickup, i);
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
          const speed = burstType === "harmful"
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
               colorRole: colorRole || (burstType === "harmful" ? "hazard" : "sparkle"),
               colorIndex: getNextPastelColorIndex(),
               color,
               glowBoost: burstType === "harmful" ? 1.25 : 1
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

export function drawSparkles() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = sparkles.length - 1; i >= 0; i -= 1) {
          const sparkle = sparkles[i];
          const fillColor = getParticleFillColor(sparkle);

          miniGameCtx.save();
          miniGameCtx.font = `${Math.max(16, sparkle.size)}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.globalAlpha = 0.95;
          miniGameCtx.fillText(sparkle.particle, sparkle.x, sparkle.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.globalAlpha = 1;
          miniGameCtx.fillText(sparkle.particle, sparkle.x, sparkle.y);

          miniGameCtx.restore();
     }
}

export function drawHealthHazards() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = healthHazards.length - 1; i >= 0; i -= 1) {
          const hazard = healthHazards[i];
          const fillColor = getParticleFillColor(hazard);

          miniGameCtx.save();
          miniGameCtx.font = `${Math.max(16, hazard.size)}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.fillText(hazard.particle, hazard.x, hazard.y);

          miniGameCtx.shadowBlur = 0;
          miniGameCtx.fillText(hazard.particle, hazard.x, hazard.y);

          miniGameCtx.restore();
     }
}

export function drawEffectPickups() {
     if (!miniGameCtx) {
          return;
     }

     const glowBlur = getGameGlowBlur();

     miniGameCtx.textAlign = "center";
     miniGameCtx.textBaseline = "middle";

     for (let i = effectPickups.length - 1; i >= 0; i -= 1) {
          const pickup = effectPickups[i];
          const fillColor = getParticleFillColor(pickup);

          const pickupSizeBoost =
               pickup.type?.name === "luck" ? 1.25 :
               pickup.type?.name === "fog" ? 1.25 :
               pickup.type?.name === "magnet" ? 1.25 :
               1;

          const pickupFontSize = Math.max(20, pickup.size * pickupSizeBoost);

          miniGameCtx.save();
          miniGameCtx.font = `${pickupFontSize}px Arial, Helvetica, sans-serif`;
          miniGameCtx.fillStyle = fillColor;
          miniGameCtx.shadowColor = getParticleGlowColor(fillColor);
          miniGameCtx.shadowBlur = glowBlur;

          miniGameCtx.globalAlpha = pickup.category === "helpful" ? 1 : 0.95;
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
