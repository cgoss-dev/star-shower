import {
     gameplayStartingHealth
} from "../options.js?v=20260711-50";

export const playerBaseHealth = gameplayStartingHealth;
export const playerBaseSpeed = 3;
export const playerSpeedPerHeart = 0.5;
export const playerMinimumSpeed = 1;
export const playerSpeedMinScale = 1;
export const playerSpeedMaxScale = 2;
export const playerBaseSize = 64;
export const playerBaseRadius = 30;

export const framesPerSecond = 60;

export const starSpawnDelay = 35;
export const starSpawnCap = 50;
export const strikeSpawnRatio = 0.25;
export const strikeSpawnIntervalMin = 3;
export const strikeSpawnIntervalMax = 5;
export const openingStrikeGraceStarSpawns = 10;
export const openingHelphurtGraceStarSpawns = 0;
export const helphurtPickupCap = 12;
export const collisionBurstParticleCount = 15;
export const fallingObjectSpeedMin = 0.75;
export const fallingObjectSpeedMax = 1.25;

export const spawnDensityBaselineArea = 960 * 640;
export const spawnDensityMinScale = 0.45;
export const spawnDensityMaxScale = 1;
export const fallSpeedMinScale = 0.7;
export const fallSpeedMaxScale = 1;
export const fallingObjectSpeedStep = 0.25;

export const helphurtSpawnIntervalsByDifficulty = [
     0,
     15,
     10,
     5
];

export const helphurtFallSpeedMultipliersByLevel = [
     1,
     1,
     1,
     1,
     1,
     1.5,
     1.5,
     2,
     2,
     2
];

export const playerTrailCountMax = 1;
export const playerTrailCountMin = 0;
export const playerTrailActiveCountMax = 4;
export const playerTrailLifeMax = 96;
export const playerTrailLifeMin = 12;
export const playerTrailWidthMax = 50;
export const playerTrailWidthMin = 38;
export const playerTrailOffsetMax = 25;
export const playerTrailOffsetMin = -25;
export const playerTrailLengthMax = 32;
export const playerTrailLengthMin = 2;
export const playerTrailPointCountMax = 36;
export const playerTrailPointDistance = 6;
export const playerTrailPointLife = 216;
export const playerTrailColorHoldPoints = 6;
export const playerTrailAnchorYRatio = -0.25;

export const starParticles = ["⭐️"];
export const strikeParticles = ["❌"];
export const strikeAssetSrc = "";

export const burstChars = ["\u2605\uFE0E", "\u2606\uFE0E", "·", "•"];
