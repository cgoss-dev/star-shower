import {
     gameplayStartingHealth
} from "../options.js?v=20260711-6";

export const playerBaseHealth = gameplayStartingHealth;
export const playerBaseSpeed = 3;
export const playerSpeedPerHeart = 1;
export const playerSpeedMinScale = 1;
export const playerSpeedMaxScale = 2;
export const playerBaseSize = 64;
export const playerBaseRadius = 30;

export const framesPerSecond = 60;

export const starSpawnDelay = 25;
export const starSpawnCap = 50;
export const strikeSpawnRatio = 0.35;
export const openingStrikeGraceStarSpawns = 15;
export const openingHelphurtGraceStarSpawns = 50;
export const helphurtPickupCap = 12;
export const collisionBurstParticleCount = 15;
export const fallingObjectSpeedMin = 0.25;
export const fallingObjectSpeedMax = 0.75;

export const spawnDensityBaselineArea = 960 * 640;
export const spawnDensityMinScale = 0.45;
export const spawnDensityMaxScale = 1;
export const fallSpeedMinScale = 0.7;
export const fallSpeedMaxScale = 1;
export const fallingObjectSpeedStep = 0.25;

export const helphurtBaseSpawnStarsByLevel = [
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

export const helphurtDifficultyMultipliers = [
     0,
     1,
     3
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
export const playerTrailAnchorYOffset = -4;

export const starParticles = ["⭐️"];
export const strikeParticles = ["❌"];
export const strikeAssetSrc = "";

export const burstChars = ["✦", "✧", "·", "•"];
