// NOTE: 10_Audio
// Audio loading/playback for Star Shower.
//
// Drop audio files into `games/star-shower/audio/` using the filenames below.
// Missing files fail quietly so the game stays playable while assets are in progress.

import {
     musicLevel,
     soundEffectsLevel
} from "./3_State.js";

import {
     optionLevelValues
} from "./4_Options.js";

export const starShowerAudioFiles = {
     music: "./audio/music-loop.mp3",

     soundEffects: {
          star: "./audio/star.wav",
          strike: "./audio/strike.wav",
          boost: "./audio/boost-effect.wav",
          bane: "./audio/bane-effect.wav",
          win: "./audio/win.wav",
          lose: "./audio/lose.wav",
          pause: "./audio/pause.wav",
          resume: "./audio/resume.wav"
     }
};

let musicAudio = null;
const soundEffectAudio = {};

function canUseAudio() {
     return typeof Audio !== "undefined";
}

function getOptionVolume(levelIndex) {
     return optionLevelValues[levelIndex] ?? optionLevelValues[0] ?? 0;
}

function getMusicVolume() {
     return getOptionVolume(musicLevel);
}

function getSoundEffectsVolume() {
     return getOptionVolume(soundEffectsLevel);
}

function getMusicAudio() {
     if (!canUseAudio()) {
          return null;
     }

     if (!musicAudio) {
          musicAudio = new Audio(starShowerAudioFiles.music);
          musicAudio.loop = true;
          musicAudio.preload = "auto";
     }

     return musicAudio;
}

function getSoundEffectAudio(name) {
     if (!canUseAudio()) {
          return null;
     }

     const src = starShowerAudioFiles.soundEffects[name];

     if (!src) {
          return null;
     }

     if (!soundEffectAudio[name]) {
          soundEffectAudio[name] = new Audio(src);
          soundEffectAudio[name].preload = "auto";
     }

     return soundEffectAudio[name];
}

export function syncBackgroundMusic(shouldPlay) {
     const audio = getMusicAudio();

     if (!audio) {
          return;
     }

     const volume = getMusicVolume();
     audio.volume = volume;

     if (!shouldPlay || volume <= 0) {
          audio.pause();
          return;
     }

     if (!audio.paused) {
          return;
     }

     audio.play().catch(() => {});
}

export function pauseBackgroundMusic() {
     const audio = getMusicAudio();

     if (audio) {
          audio.pause();
     }
}

export function playSoundEffect(name) {
     const volume = getSoundEffectsVolume();

     if (volume <= 0) {
          return;
     }

     const audio = getSoundEffectAudio(name);

     if (!audio) {
          return;
     }

     const sound = audio.cloneNode();
     sound.volume = volume;
     sound.play().catch(() => {});
}
