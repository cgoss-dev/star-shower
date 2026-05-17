// NOTE: STAR SHOWER PAGE HELPERS

const starShowerRainbowPalette = [
     "#f00",
     "#f80",
     "#ff0",
     "#bf0",
     "#0f0",
     "#0fb",
     "#0ff",
     "#0bf",
     "#00f",
     "#80f",
     "#f0f",
     "#f08"
];

function getCssValue(variableName) {
     return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

function resolveCssValue(value, fallback = "") {
     if (!value) {
          return fallback;
     }

     const variablePattern = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/g;
     let resolvedValue = value;
     let safety = 0;

     while (resolvedValue.includes("var(") && safety < 12) {
          safety += 1;
          resolvedValue = resolvedValue.replace(variablePattern, (_match, variableName, variableFallback = "") => {
               const nextValue = getCssValue(variableName);
               return nextValue || variableFallback.trim() || fallback;
          });
     }

     return resolvedValue || fallback;
}

function getCssNumber(variableName, fallback = 0) {
     const rawValue = getCssValue(variableName);
     const value = parseFloat(rawValue);
     return Number.isNaN(value) ? fallback : value;
}

function getCssColor(variableName, fallback = "#ffffff") {
     return resolveCssValue(getCssValue(variableName), fallback);
}

function getTextSettings() {
     return {
          rainbowCycleSpeed: getCssNumber("--text-rainbow-cycle-speed", 900),
          glowCore: getCssValue("--glow-core") || "0 0 0.05rem",
          glowSoft: getCssValue("--glow-soft") || "0 0 0.25rem",
          glowWide: getCssValue("--glow-wide") || "0 0 0.75rem"
     };
}

function getGlowSettings() {
     return {
          bgParticleBlur: getCssNumber("--glow-particle-bg-blur", 12),
          gameParticleBlur: getCssNumber("--glow-particle-game-blur", 16)
     };
}

function getStarSettings() {
     return {
          countMax: getCssNumber("--star-count-max", 100),
          sizeMin: getCssNumber("--star-size-min", 16),
          sizeMax: getCssNumber("--star-size-max", 26),
          speedMin: getCssNumber("--star-speed-min", 0.25),
          speedMax: getCssNumber("--star-speed-max", 0.75),
          density: getCssNumber("--star-density", 0.00015),
          wobbleSpeedMin: getCssNumber("--star-wobble-speed-min", 0.005),
          wobbleSpeedMax: getCssNumber("--star-wobble-speed-max", 0.02),
          wobbleAmountMin: getCssNumber("--star-wobble-amount-min", 5),
          wobbleAmountMax: getCssNumber("--star-wobble-amount-max", 15),
          opacityMin: getCssNumber("--star-opacity-min", 0.2),
          opacityMax: getCssNumber("--star-opacity-max", 1),
          respawnOffsetTop: getCssNumber("--star-respawn-offset-top", -20),
          respawnOffsetBottom: getCssNumber("--star-respawn-offset-bottom", 24)
     };
}

function getRainbowPalette() {
     return starShowerRainbowPalette.filter(Boolean);
}

function randomNumber(min, max) {
     return Math.random() * (max - min) + min;
}

function randomWholeNumber(min, max) {
     return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(array) {
     return array[randomWholeNumber(0, array.length - 1)];
}

function randomItemExcept(array, previousItem) {
     if (!array.length) {
          return undefined;
     }

     if (array.length === 1) {
          return array[0];
     }

     let nextItem = randomItem(array);

     while (nextItem === previousItem) {
          nextItem = randomItem(array);
     }

     return nextItem;
}

function shuffleArray(array) {
     const shuffled = [...array];

     for (let i = shuffled.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
     }

     return shuffled;
}

function createColorEngine(colorsOrFactory) {
     let previousColor = null;

     function resolvePalette() {
          const rawPalette = typeof colorsOrFactory === "function"
               ? colorsOrFactory()
               : colorsOrFactory;

          return Array.isArray(rawPalette) ? rawPalette.filter(Boolean) : [];
     }

     return {
          next() {
               const palette = resolvePalette();

               if (!palette.length) {
                    return undefined;
               }

               const nextColor = palette.length === 1
                    ? palette[0]
                    : randomItemExcept(palette, previousColor);

               previousColor = nextColor;
               return nextColor;
          },

          nextCycle(count) {
               const palette = resolvePalette();

               if (!palette.length || count <= 0) {
                    return [];
               }

               const nextColors = [];
               let availableColors = shuffleArray(palette);
               let colorIndex = 0;

               for (let i = 0; i < count; i += 1) {
                    if (colorIndex >= availableColors.length) {
                         availableColors = shuffleArray(palette);
                         colorIndex = 0;
                    }

                    nextColors.push(availableColors[colorIndex]);
                    colorIndex += 1;
               }

               return nextColors;
          }
     };
}

window.SiteTheme = {
     getCssValue,
     getCssNumber,
     getCssColor,
     getTextSettings,
     getGlowSettings,
     getStarSettings,
     getRainbowPalette,
     createColorEngine,
     randomNumber,
     randomWholeNumber,
     randomItem,
     randomItemExcept,
     shuffleArray
};

const siteBgCanvas = document.getElementById("siteBgCanvas");
const siteBgCtx = siteBgCanvas ? siteBgCanvas.getContext("2d") : null;
const bgParticles = [];
let bgWidth = 0;
let bgHeight = 0;
let bgParticleCount = 0;
let starColorEngine = null;

function resizeBgCanvasFromCss(canvas) {
     if (!canvas) {
          return;
     }

     const rect = canvas.getBoundingClientRect();
     const dpr = window.devicePixelRatio || 1;

     canvas.width = Math.round(rect.width * dpr);
     canvas.height = Math.round(rect.height * dpr);

     if (siteBgCtx) {
          siteBgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
     }

     bgWidth = rect.width;
     bgHeight = rect.height;
}

function setBgParticleCount() {
     const starSettings = getStarSettings();
     const screenArea = bgWidth * bgHeight;

     bgParticleCount = Math.min(
          starSettings.countMax,
          Math.floor(screenArea * starSettings.density)
     );
}

function createBgParticle(startAboveScreen = false) {
     const starSettings = getStarSettings();
     const x = Math.random() * bgWidth;

     if (!starColorEngine) {
          starColorEngine = createColorEngine(["#ffffff"]);
     }

     return {
          x,
          baseX: x,
          y: startAboveScreen ? starSettings.respawnOffsetTop : Math.random() * bgHeight,
          char: Math.random() < 0.5 ? "\u2726" : "\u2727",
          color: starColorEngine.next() || "#ffffff",
          size: randomNumber(starSettings.sizeMin, starSettings.sizeMax),
          speed: randomNumber(starSettings.speedMin, starSettings.speedMax),
          wobbleOffset: randomNumber(0, Math.PI * 2),
          wobbleSpeed: randomNumber(starSettings.wobbleSpeedMin, starSettings.wobbleSpeedMax),
          wobbleAmount: randomNumber(starSettings.wobbleAmountMin, starSettings.wobbleAmountMax),
          opacity: randomNumber(starSettings.opacityMin, starSettings.opacityMax)
     };
}

function initBgParticles(count) {
     bgParticles.length = 0;

     for (let i = 0; i < count; i += 1) {
          bgParticles.push(createBgParticle());
     }
}

function setupStarRain() {
     if (!siteBgCanvas || !siteBgCtx) {
          return;
     }

     starColorEngine = createColorEngine(["#ffffff"]);
     resizeBgCanvasFromCss(siteBgCanvas);
     setBgParticleCount();
     initBgParticles(bgParticleCount);
}

function updateBgParticles() {
     const starSettings = getStarSettings();

     for (let i = 0; i < bgParticles.length; i += 1) {
          const p = bgParticles[i];

          p.y += p.speed;
          p.wobbleOffset += p.wobbleSpeed;
          p.x = p.baseX + Math.sin(p.wobbleOffset) * p.wobbleAmount;

          if (p.y > bgHeight + starSettings.respawnOffsetBottom) {
               bgParticles[i] = createBgParticle(true);
          }
     }
}

function drawBgParticles() {
     if (!siteBgCtx) {
          return;
     }

     const glowSettings = getGlowSettings();

     siteBgCtx.clearRect(0, 0, bgWidth, bgHeight);

     for (let i = 0; i < bgParticles.length; i += 1) {
          const p = bgParticles[i];

          siteBgCtx.save();
          siteBgCtx.globalAlpha = p.opacity;
          siteBgCtx.font = `${p.size}px Arial, Helvetica, sans-serif`;
          siteBgCtx.textAlign = "center";
          siteBgCtx.textBaseline = "middle";
          siteBgCtx.fillStyle = p.color;
          siteBgCtx.shadowBlur = glowSettings.bgParticleBlur;
          siteBgCtx.shadowColor = p.color;
          siteBgCtx.fillText(p.char, p.x, p.y);
          siteBgCtx.restore();
     }
}

function drawStarRain() {
     if (!siteBgCanvas || !siteBgCtx) {
          return;
     }

     updateBgParticles();
     drawBgParticles();
     window.requestAnimationFrame(drawStarRain);
}

setupStarRain();
drawStarRain();

window.addEventListener("resize", setupStarRain);
