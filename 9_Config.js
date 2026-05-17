// NOTE: 9_Config
// Canvas theme assembly, CSS readers, and canvas-only config knobs for Star Shower.
//
// Owned here:
// - CSS variable readers
// - canvas theme creation
// - small canvas presentation config values
// - frequently adjusted Star Shower page/game presentation values
//
// NOT owned here:
// - runtime mutable state
// - gameplay logic
// - rendering implementation
//
// Newbie note:
// - This file should answer "what theme/config values does canvas UI use?"
// - If code draws, updates entities, or mutates game state, it belongs elsewhere.

export const starShowerRainbowCycleMs = 240;

export const starShowerRainbowPalette = [
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





export const starShowerBoostBaneIcons = {

     // NOTE: BOOSTS

     iconHealth: {
          category: "boost",
          name: "health",
          label: "HEALTH",
          particle: "\u2795\uFE0E",
          assetSrc: "./images/icons/health.svg",
          ability: "increaseHealth",
          lastsUntilUsed: true,
          durationSeconds: 0,
          xOffset: 0
     },

     iconMagnet: {
          category: "boost",
          name: "magnet",
          label: "MAGNET",
          particle: "\u2316\uFE0E",
          assetSrc: "./images/icons/magnet.svg",
          ability: "expandStarPickupRange",
          lastsUntilUsed: false,
          durationSeconds: 5,
          xOffset: -3
     },

     iconDouble: {
          category: "boost",
          name: "double",
          label: "DOUBLE",
          particle: "\u2605\uFE0E",
          assetSrc: "./images/icons/double.svg",
          ability: "doubleStarScore",
          lastsUntilUsed: false,
          durationSeconds: 8,
          xOffset: -1
     },

     // NOTE: BANES

     iconFreeze: {
          category: "bane",
          name: "freeze",
          label: "FREEZE",
          particle: "\u2744\uFE0E",
          assetSrc: "./images/icons/freeze.svg",
          ability: "freezePlayerMovement",
          lastsUntilUsed: false,
          durationSeconds: 5,
          xOffset: 1
     },

     iconDaze: {
          category: "bane",
          name: "daze",
          label: "DAZE",
          particle: "\u2300\uFE0E",
          assetSrc: "./images/icons/daze.svg",
          ability: "reversePlayerMovement",
          lastsUntilUsed: false,
          durationSeconds: 5,
          xOffset: 0
     },

     iconFog: {
          category: "bane",
          name: "fog",
          label: "FOG",
          particle: "\u224B\uFE0E",
          assetSrc: "./images/icons/fog.svg",
          ability: "limitVisionAroundPlayer",
          lastsUntilUsed: false,
          durationSeconds: 8,
          xOffset: 0
     }
};

export const starShowerGuideIcons = {
     iconStar: {
          name: "star",
          label: "STAR",
          particle: "\u2726\uFE0E",
          xOffset: 0
     },

     iconStrike: {
          name: "strike",
          label: "STRIKE",
          particle: "\u2715\uFE0E",
          assetSrc: "./images/icons/strike.svg",
          xOffset: 0
     }
};

function getSiteTheme() {
     return window.SiteTheme;
}





// ====================================================================================================
// NOTE: ⭐️ GET CANVAS THEME
// ====================================================================================================

export function getCanvasTheme() {
     const fontColor = getCssColor("--game-color-text", getCssColor("--color-white", "#ffffff"));
     const bodyColor = getCssColor("--game-color-body", getCssColor("--color-gray3", "#999999"));
     const titleColor = getCssColor("--game-color-title", getCssColor("--color-gray3", "#999999"));
     const uiFontLg = getCssPixelSize("--font-size-lg", 20);
     const uiFontMd = getCssPixelSize("--font-size-md", 15);
     const uiFontSm = getCssPixelSize("--font-size-sm", 10);

     const menuOverlayFill = "rgba(0, 0, 0, 0.85)";
     const controlFillFallback = getCssColor("--game-control-fill", getCssColor("--white-25", "rgba(255, 255, 255, 0.25)"));
     const outlineFallback = getCssColor("--game-outline-strong", getCssColor("--color-gray3", "#999999"));

     const text = {
          canvasSpacing: {
               uiPadding: uiFontSm,
               uiRowGap: uiFontSm,
               circleTitleGap: uiFontSm,
               menuPadding: uiFontMd,
               betweenButtons: uiFontSm,
               bodyLineHeight: uiFontSm * 1.5,
               guideIconGutter: uiFontLg
          },

          marquee: {
               font: "marquee",
               fontSize: uiFontLg,
               minSize: uiFontMd,
               shrinkStep: 2,
               sidePadding: uiFontSm,
               letterSpacing: 0.25,
               stackGap: 10,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          welcomeTitle: {
               font: "marquee",
               fontSize: uiFontLg,
               minSize: uiFontMd,
               shrinkStep: 2,
               sidePadding: uiFontSm,
               letterSpacing: 0.25,
               stackGap: 10,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          title: {
               font: "marquee",
               fontSize: uiFontMd,
               letterSpacing: 0.25,
               color: titleColor,
               rainbow: true,
               glow: false
          },

          levelStatus: {
               font: "marquee",
               fontSize: uiFontSm * 1.5,
               letterSpacing: 0.25,
               color: "#fff",
               rainbow: true,
               glow: false
          },

          circleMeters: {
<<<<<<< HEAD
               fontSize: uiFontSm * 1.5,
               emptyAssetSrc: "./images/icons/meter-empty.svg",
               halfAssetSrc: "./images/icons/meter-half.svg",
               fullAssetSrc: "./images/icons/meter-full.svg",
               assetScale: 1,
               advanceScale: 0.75,
               letterSpacing: 0.25
=======
               font: "circleMeter",
               fontSize: uiFontSm * 1.5,
               emptyChar: "\u25CB\uFE0E",
               halfChar: "\u25D2\uFE0E",
               fullChar: "\u25CF\uFE0E",
               advanceScale: 0.75,
               letterSpacing: 0.25,
               color: bodyColor,
               rainbow: false,
               glow: false
>>>>>>> a6db9e70be504b7e99ec7343eef5cb505fe86f63
          },

          scoreReady: {
               font: "body",
               fontSize: uiFontSm * 1.5,
               letterSpacing: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          scoreIcon: {
               font: "symbol",
               fontSize: uiFontSm * 1.5,
               particle: "\u2726\uFE0E",
               gap: uiFontSm * 0.5,
               xOffset: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          statusIcon: {
               font: "body",
               fontSize: uiFontSm * 1.5,
               gap: uiFontSm * 0.5,
               xOffset: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          buttonsOptions: {
               font: "body",
               fontSize: uiFontSm,
               arrowScale: 3,
               letterSpacing: 0,
               buttonPadding: uiFontSm * 0.5,
               backButtonBottomOffset: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          pauseButton: {
               font: "body",
               fontSize: uiFontSm * 2,
               buttonSize: Math.max(44, uiFontSm * 3.6),
               iconScale: 0.62,
               letterSpacing: 0,
               color: bodyColor,
               rainbow: false,
               glow: false
          },

          joystick: {
               baseRadius: uiFontLg * 2.5,
               knobRadius: uiFontMd * 1.6,
               edgeGap: uiFontSm * 0.15,
               deadZone: 0.12,
               fill: "rgba(0, 0, 0, 0)",
               stroke: outlineFallback,
               knobFill: bodyColor,
               glow: true
          },

          guideIcons: {
               ...starShowerGuideIcons,
               ...starShowerBoostBaneIcons
          }
     };

     const base = {
          uiFontLg,
          uiFontMd,
          uiFontSm,
          controlRadius: getCssNumber("--border-radius", 30),
          borderWidth: getCssNumber("--border-sm", 1),
          borderWidthFocus: getCssNumber("--border-md", 2),
          panelBorderWidth: getCssNumber("--border-lg", 3),
          touchBorderWidth: getCssNumber("--border-lg", 3)
     };

     return {
          fonts: {
               marquee: getCssString("--font-display", "\"Bungee Shade\", cursive"),
               body: getCssString("--font-body", "\"Noto Sans Mono\", monospace"),
               symbol: "\"Segoe UI Symbol\", \"Apple Color Emoji\", \"Noto Color Emoji\", sans-serif"
          },

          colors: {
               fontColor,
               bodyText: bodyColor,
               titleText: titleColor,
               titleRainbow: starShowerRainbowPalette,
               controlText: bodyColor,
               controlGlow: fontColor,
               overlayGlow: fontColor,
               statusText: bodyColor,
               statusTextGlow: fontColor,
               meterFull: bodyColor,
               meterGlow: bodyColor,

               controlFill: controlFillFallback,
               outlineStrong: outlineFallback,
               frameInset: getCssColor("--color-black", "#000000"),

               touchFill: getCssColor("--game-touch-fill", getCssColor("--ui-touch-fill", controlFillFallback)),
               touchStroke: getCssColor("--game-touch-border-color", getCssColor("--ui-touch-border-color", outlineFallback)),
               touchGlow: getCssColor("--game-touch-glow", getCssColor("--ui-touch-glow", fontColor)),
               touchText: getCssColor("--game-touch-text-color", getCssColor("--ui-touch-text-color", bodyColor)),

               menuScreenFill: getCssColor("--color-black", "#000000"),
               menuPanelFill: menuOverlayFill
          },

          sizes: {
               ...base
          },

          text,

          screens: {
               welcome: {
                    textStyle: "welcomeTitle"
               },

               paused: {
                    textStyle: "marquee",
                    overlayFill: menuOverlayFill
               },

               result: {
                    textStyle: "marquee",
                    overlayFill: menuOverlayFill
               }
          },

          glow: {
               uiSoftGlow: getCssNumber("--glow-particle-bg-blur", 10),
               uiMediumGlow: getCssNumber("--glow-particle-game-blur", 16),
               uiStrongGlow: getCssNumber("--glow-particle-game-blur", 16) * 1.35,
               uiTitleGlow1: getCssNumber("--glow-particle-bg-blur", 10) * 0.75,
               uiTitleGlow2: getCssNumber("--glow-particle-game-blur", 16),
               uiTitleGlow3: getCssNumber("--glow-particle-game-blur", 16) * 1.6
          },

          animation: {
               titleRainbowCycleMs: starShowerRainbowCycleMs
          }
     };
}





// ==================================================
// CSS / THEME HELPERS
// ==================================================

export function getCssColor(variableName, fallback = "#ffffff") {
     const siteColor = getSiteTheme()?.getCssColor?.(variableName, "");
     const localColor = getCssString(variableName, "");
     return resolveCssColorValue(siteColor || localColor, fallback);
}

export function getCssNumber(variableName, fallback = 0) {
     return getSiteTheme()?.getCssNumber?.(variableName, fallback) ?? fallback;
}

export function getCssString(variableName, fallback = "") {
     if (!document?.documentElement) {
          return fallback;
     }

     const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
     return value || fallback;
}

export function getCssBoolean(variableName, fallback = false) {
     const value = getCssString(variableName, String(fallback)).toLowerCase();

     return value === "true" || value === "1" || value === "yes" || value === "on";
}

function resolveCssColorValue(value, fallback = "#ffffff") {
     if (!value || !document?.documentElement) {
          return fallback;
     }

     const variablePattern = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/g;
     let resolvedValue = value;
     let safety = 0;

     while (resolvedValue.includes("var(") && safety < 12) {
          safety += 1;
          resolvedValue = resolvedValue.replace(variablePattern, (_match, variableName, variableFallback = "") => {
               const nextValue = getCssString(variableName, "");
               return nextValue || variableFallback.trim() || fallback;
          });
     }

     return resolvedValue || fallback;
}

export function getCssPixelSize(variableName, fallback = 10) {
     if (!document?.body) {
          return fallback;
     }

     const probe = document.createElement("span");
     probe.style.position = "absolute";
     probe.style.visibility = "hidden";
     probe.style.pointerEvents = "none";
     probe.style.fontSize = `var(${variableName})`;
     probe.textContent = "M";

     document.body.appendChild(probe);
     const resolved = parseFloat(getComputedStyle(probe).fontSize);
     document.body.removeChild(probe);

     return Number.isFinite(resolved) ? resolved : fallback;
}
