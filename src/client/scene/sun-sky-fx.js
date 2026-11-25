/**
 * scene/sun-sky-fx.js — physical dynamic sky curtain & solar optical effects
 * for the sun timeline.
 *
 * Cesium's built-in LensFlare post-process stage is hardcoded to space
 * altitudes (> 6500 km), and default SkyAtmosphere uses static camera-radial
 * lighting unless DynamicAtmosphereLightingType.SUNLIGHT is enabled. This module:
 *   1. Enables Cesium's per-fragment sun-driven SkyAtmosphere & ground lighting;
 *   2. Adds a single depth-aware WebGL2 PostProcessStage (`czm_dsh_sun_sky_fx`)
 *      rendering a dynamic dawn/day/sunset/twilight/night sky curtain on sky
 *      pixels, aspect-correct solar disc + corona + 6-ray starburst + subtle
 *      lens flare ghosts occluded by 3D Tiles / terrain, and golden-hour to
 *      night scene tone grading floored cleanly above black.
 *
 * Pure profile math is exported separately so `node:test` can verify every
 * solar-altitude keyframe without WebGL.
 */

export const SUN_SKY_STAGE_NAME = 'czm_dsh_sun_sky_fx'

// Keyframes ordered ascending by solar altitude (degrees).
const BACKDROP_KEYFRAMES = [
  {
    altitude: -18,
    zenith: [0.014, 0.022, 0.052],
    horizon: [0.032, 0.052, 0.108],
    sunsetGlow: [0.04, 0.06, 0.12],
    sunCore: [0.85, 0.48, 0.25],
    sunGlow: [0.75, 0.36, 0.18],
    sceneTint: [0.80, 0.88, 1.06],
    curtainStrength: 0.72,
    glowStrength: 0.05,
    sunIntensity: 0.0,
    starAmount: 1.0,
    sunGlowFactor: 1.0,
    atmoLightIntensity: 24,
    atmoMieScale: 1.0,
    atmoSaturation: -0.1,
    skyBoxVisible: true,
  },
  {
    altitude: -6,
    zenith: [0.036, 0.072, 0.195],
    horizon: [0.23, 0.22, 0.39],
    sunsetGlow: [0.78, 0.33, 0.28],
    sunCore: [1.0, 0.52, 0.22],
    sunGlow: [0.98, 0.38, 0.16],
    sceneTint: [0.88, 0.90, 1.02],
    curtainStrength: 0.84,
    glowStrength: 0.72,
    sunIntensity: 0.18,
    starAmount: 0.42,
    sunGlowFactor: 1.8,
    atmoLightIntensity: 36,
    atmoMieScale: 1.5,
    atmoSaturation: 0.08,
    skyBoxVisible: true,
  },
  {
    altitude: 0,
    zenith: [0.105, 0.235, 0.52],
    horizon: [0.90, 0.48, 0.24],
    sunsetGlow: [1.0, 0.45, 0.16],
    sunCore: [1.0, 0.64, 0.26],
    sunGlow: [1.0, 0.44, 0.15],
    sceneTint: [1.08, 0.92, 0.79],
    curtainStrength: 0.82,
    glowStrength: 1.0,
    sunIntensity: 0.92,
    starAmount: 0.02,
    sunGlowFactor: 2.8,
    atmoLightIntensity: 48,
    atmoMieScale: 2.1,
    atmoSaturation: 0.18,
    skyBoxVisible: true,
  },
  {
    altitude: 8,
    zenith: [0.15, 0.41, 0.77],
    horizon: [0.77, 0.74, 0.78],
    sunsetGlow: [1.0, 0.68, 0.36],
    sunCore: [1.0, 0.86, 0.62],
    sunGlow: [1.0, 0.70, 0.38],
    sceneTint: [1.05, 0.97, 0.89],
    curtainStrength: 0.74,
    glowStrength: 0.78,
    sunIntensity: 1.05,
    starAmount: 0.0,
    sunGlowFactor: 2.6,
    atmoLightIntensity: 52,
    atmoMieScale: 1.45,
    atmoSaturation: 0.08,
    skyBoxVisible: false,
  },
  {
    altitude: 24,
    zenith: [0.13, 0.43, 0.85],
    horizon: [0.65, 0.81, 0.96],
    sunsetGlow: [0.94, 0.91, 0.82],
    sunCore: [1.0, 0.97, 0.88],
    sunGlow: [1.0, 0.90, 0.72],
    sceneTint: [1.01, 1.0, 0.98],
    curtainStrength: 0.64,
    glowStrength: 0.45,
    sunIntensity: 1.0,
    starAmount: 0.0,
    sunGlowFactor: 2.3,
    atmoLightIntensity: 50,
    atmoMieScale: 1.05,
    atmoSaturation: 0.02,
    skyBoxVisible: false,
  },
  {
    altitude: 60,
    zenith: [0.10, 0.38, 0.83],
    horizon: [0.62, 0.80, 0.96],
    sunsetGlow: [0.97, 0.98, 1.0],
    sunCore: [1.0, 0.99, 0.94],
    sunGlow: [1.0, 0.95, 0.84],
    sceneTint: [1.0, 1.0, 1.0],
    curtainStrength: 0.58,
    glowStrength: 0.35,
    sunIntensity: 1.0,
    starAmount: 0.0,
    sunGlowFactor: 2.1,
    atmoLightIntensity: 50,
    atmoMieScale: 1.0,
    atmoSaturation: 0.0,
    skyBoxVisible: false,
  },
]

const lerp = (a, b, t) => a + (b - a) * t
const lerpVec3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const smoothstep01 = (t) => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/**
 * Smoothly interpolate atmospheric sky-curtain & sun-effect parameters for any
 * solar altitude in degrees. Pure function — safe for unit testing.
 */
export function computeSunBackdropProfile(altitudeDeg) {
  const alt = Number.isFinite(altitudeDeg) ? altitudeDeg : 30
  if (alt <= BACKDROP_KEYFRAMES[0].altitude) return { ...BACKDROP_KEYFRAMES[0] }
  const last = BACKDROP_KEYFRAMES[BACKDROP_KEYFRAMES.length - 1]
  if (alt >= last.altitude) return { ...last }
  for (let i = 0; i < BACKDROP_KEYFRAMES.length - 1; i += 1) {
    const a = BACKDROP_KEYFRAMES[i]
    const b = BACKDROP_KEYFRAMES[i + 1]
    if (alt >= a.altitude && alt <= b.altitude) {
      const t = smoothstep01((alt - a.altitude) / (b.altitude - a.altitude))
      return {
        altitude: alt,
        zenith: lerpVec3(a.zenith, b.zenith, t),
        horizon: lerpVec3(a.horizon, b.horizon, t),
        sunsetGlow: lerpVec3(a.sunsetGlow, b.sunsetGlow, t),
        sunCore: lerpVec3(a.sunCore, b.sunCore, t),
        sunGlow: lerpVec3(a.sunGlow, b.sunGlow, t),
        sceneTint: lerpVec3(a.sceneTint, b.sceneTint, t),
        curtainStrength: lerp(a.curtainStrength, b.curtainStrength, t),
        glowStrength: lerp(a.glowStrength, b.glowStrength, t),
        sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
        starAmount: lerp(a.starAmount, b.starAmount, t),
        sunGlowFactor: lerp(a.sunGlowFactor, b.sunGlowFactor, t),
        atmoLightIntensity: lerp(a.atmoLightIntensity, b.atmoLightIntensity, t),
        atmoMieScale: lerp(a.atmoMieScale, b.atmoMieScale, t),
        atmoSaturation: lerp(a.atmoSaturation, b.atmoSaturation, t),
        skyBoxVisible: alt <= 3.5,
      }
    }
  }
  return { ...last }
}

/**
 * Fragment shader for `czm_dsh_sun_sky_fx`:
 *  - Reconstructs world view ray to paint a smooth directional sky curtain on
 *    far-plane pixels (fading cleanly back to space at orbital height);
 *  - Renders subtle procedural stars in clear night sky above the horizon;
 *  - Projects `czm_sunDirectionEC` to screen UV, samples a 9-tap depth mask so
 *    3D buildings/terrain cleanly occlude solar disc, corona, 6-ray starburst,
 *    and subtle chromatic lens-flare ghosts;
 *  - Applies golden-hour warm / twilight cool scene grading + `u_brightness`.
 */
export function buildSunSkyFragmentShader() {
  return `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float u_brightness;
uniform float u_fxEnabled;
uniform float u_curtainStrength;
uniform float u_glowStrength;
uniform float u_sunIntensity;
uniform float u_starAmount;
uniform vec3 u_skyZenithColor;
uniform vec3 u_skyHorizonColor;
uniform vec3 u_sunsetGlowColor;
uniform vec3 u_sunCoreColor;
uniform vec3 u_sunGlowColor;
uniform vec3 u_sceneTint;

in vec2 v_textureCoordinates;

float hash31(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

float starLayer(vec3 dir, float scale, float threshold) {
  vec3 grid = dir * scale;
  vec3 id = floor(grid);
  vec3 f = fract(grid) - 0.5;
  float h = hash31(id);
  if (h < threshold) return 0.0;
  vec3 jitter = vec3(hash31(id + 1.3), hash31(id + 2.7), hash31(id + 4.1)) - 0.5;
  float d = length(f - jitter * 0.45);
  float twinkle = 0.65 + 0.35 * sin(h * 62.8318);
  return smoothstep(0.18, 0.02, d) * twinkle * smoothstep(threshold, 1.0, h);
}

float sampleSunVisibility(vec2 sunUV) {
  if (sunUV.x < -0.15 || sunUV.x > 1.15 || sunUV.y < -0.15 || sunUV.y > 1.15) {
    return 0.0;
  }
  vec2 aspectInv = vec2(czm_viewport.w / max(czm_viewport.z, 1.0), 1.0);
  float r = 0.0065;
  float hits = 0.0;
  float total = 0.0;
  vec2 offsets[9];
  offsets[0] = vec2(0.0, 0.0);
  offsets[1] = vec2(r, 0.0);
  offsets[2] = vec2(-r, 0.0);
  offsets[3] = vec2(0.0, r);
  offsets[4] = vec2(0.0, -r);
  offsets[5] = vec2(r * 0.7, r * 0.7);
  offsets[6] = vec2(-r * 0.7, r * 0.7);
  offsets[7] = vec2(r * 0.7, -r * 0.7);
  offsets[8] = vec2(-r * 0.7, -r * 0.7);
  for (int i = 0; i < 9; ++i) {
    vec2 sUV = sunUV + offsets[i] * aspectInv;
    if (sUV.x >= 0.001 && sUV.x <= 0.999 && sUV.y >= 0.001 && sUV.y <= 0.999) {
      float d = texture(depthTexture, sUV).r;
      hits += step(0.99992, d);
      total += 1.0;
    }
  }
  return total > 0.0 ? (hits / total) : 0.0;
}

void main(void) {
  vec4 baseColor = texture(colorTexture, v_textureCoordinates);
  vec3 rgb = baseColor.rgb;

  if (u_fxEnabled > 0.5 && czm_morphTime > 0.99) {
    float rawDepth = texture(depthTexture, v_textureCoordinates).r;
    float isSky = step(0.99992, rawDepth);

    vec2 ndc = v_textureCoordinates * 2.0 - 1.0;
    vec4 eyeFar = czm_inverseProjection * vec4(ndc, 1.0, 1.0);
    vec3 rayEC = normalize(eyeFar.xyz / max(eyeFar.w, 1e-6));
    vec3 rayWC = normalize(czm_inverseViewRotation * rayEC);
    vec3 upWC = normalize(czm_viewerPositionWC);
    vec3 sunDirWC = normalize(czm_sunDirectionWC);

    float viewerDist = length(czm_viewerPositionWC);
    float earthR = 6371000.0;
    float camHeight = max(viewerDist - earthR, 0.0);
    float spaceFade = smoothstep(6600000.0, 6420000.0, viewerDist);

    // 1. Dynamic sky curtain on far-plane sky pixels
    if (isSky > 0.5 && spaceFade > 0.001) {
      float horizonDip = -sqrt(clamp(2.0 * camHeight / max(viewerDist, earthR), 0.0, 0.95));
      float relElev = clamp((dot(rayWC, upWC) - horizonDip) / max(1.0 - horizonDip, 0.05), 0.0, 1.0);
      float grad = pow(relElev, 0.52);

      vec3 curtain = mix(u_skyHorizonColor, u_skyZenithColor, grad);
      // Warm/hazy horizon belt
      float horizonBelt = exp(-relElev * 7.5) * 0.25;
      curtain = mix(curtain, u_skyHorizonColor * 1.08, horizonBelt);

      // Directional sunset / sunrise afterglow facing solar azimuth
      vec3 rayHoriz = rayWC - upWC * dot(rayWC, upWC);
      vec3 sunHoriz = sunDirWC - upWC * dot(sunDirWC, upWC);
      float rLen = length(rayHoriz);
      float sLen = length(sunHoriz);
      float horizAlign = (rLen > 1e-4 && sLen > 1e-4)
        ? max(dot(rayHoriz / rLen, sunHoriz / sLen), 0.0)
        : 0.0;
      float sunCos = max(dot(rayWC, sunDirWC), 0.0);
      float horizonBloom = pow(horizAlign, 2.0) * exp(-relElev * 4.8);
      float forwardMie = pow(sunCos, 6.0) * 0.42 + pow(sunCos, 22.0) * 0.55;
      curtain += u_sunsetGlowColor * (horizonBloom * 0.85 + forwardMie * 0.50) * u_glowStrength;

      // Subtle night starfield above horizon
      if (u_starAmount > 0.01) {
        float starMask = smoothstep(0.03, 0.32, relElev) * (1.0 - horizonBloom * 0.7) * u_starAmount;
        float stars = starLayer(rayWC, 150.0, 0.992) * 0.95 + starLayer(rayWC, 260.0, 0.994) * 0.55;
        curtain += vec3(0.86, 0.91, 1.0) * stars * starMask;
      }

      rgb = mix(rgb, curtain, u_curtainStrength * spaceFade);
    }

    // 2. Solar disc + corona + 6-ray starburst + chromatic lens-flare ghosts
    vec3 sunDirEC = normalize(czm_sunDirectionEC);
    if (sunDirEC.z < -0.01 && u_sunIntensity > 0.005) {
      vec4 sunClip = czm_projection * vec4(sunDirEC, 0.0);
      vec2 sunUV = (sunClip.xy / sunClip.w) * 0.5 + 0.5;

      float sunVis = sampleSunVisibility(sunUV) * u_sunIntensity * spaceFade;
      float edgeFade =
        smoothstep(-0.30, 0.02, sunUV.x) * smoothstep(1.30, 0.98, sunUV.x) *
        smoothstep(-0.30, 0.02, sunUV.y) * smoothstep(1.30, 0.98, sunUV.y);

      vec2 aspect = vec2(czm_viewport.z / max(czm_viewport.w, 1.0), 1.0);
      vec2 dVec = (v_textureCoordinates - sunUV) * aspect;
      float d = length(dVec);

      // Sharp glowing solar disc (strictly behind foreground geometry)
      float disc = smoothstep(0.015, 0.0065, d) * isSky * u_sunIntensity * spaceFade * edgeFade;
      rgb += u_sunCoreColor * disc * 1.9;

      // Multi-layer solar corona + diffraction spikes (depth-occluded by buildings/terrain)
      if (sunVis > 0.005 && edgeFade > 0.005) {
        float corona = exp(-d * 46.0) * 1.05 + exp(-d * 13.0) * 0.40 + exp(-d * 3.6) * 0.14;
        float ang = atan(dVec.y, dVec.x);
        float spikes = pow(abs(cos(ang * 3.0 + 0.35)), 26.0) * exp(-d * 9.0) * 0.52
          + pow(abs(cos(ang * 6.0 - 0.15)), 44.0) * exp(-d * 15.0) * 0.25;
        spikes *= smoothstep(0.002, 0.015, d);

        float fgWeight = mix(0.22, 1.0, isSky);
        rgb += u_sunGlowColor * (corona + spikes) * sunVis * edgeFade * fgWeight;

        // Subtle chromatic lens-flare ghosts mirrored through screen center
        if (sunUV.x > -0.05 && sunUV.x < 1.05 && sunUV.y > -0.05 && sunUV.y < 1.05) {
          vec2 flareAxis = vec2(0.5) - sunUV;
          vec2 uvA = sunUV + flareAxis * 0.55;
          vec2 uvB = sunUV + flareAxis * 1.12;
          vec2 uvC = sunUV + flareAxis * 1.62;

          float g1 = smoothstep(0.048, 0.008, length((v_textureCoordinates - uvA) * aspect));
          float dB = length((v_textureCoordinates - uvB) * aspect);
          float g2 = smoothstep(0.085, 0.058, dB) * smoothstep(0.032, 0.062, dB);
          float g3 = smoothstep(0.034, 0.006, length((v_textureCoordinates - uvC) * aspect));

          vec3 ghosts = u_sunGlowColor * (g1 * 0.11)
            + mix(u_sunGlowColor, vec3(0.45, 0.78, 1.0), 0.45) * (g2 * 0.12)
            + vec3(0.55, 0.85, 1.0) * (g3 * 0.08);
          rgb += ghosts * sunVis * edgeFade;
        }
      }
    }

    // 3. Golden-hour / twilight scene tone tint
    rgb *= u_sceneTint;
  }

  // 4. Whole-frame night dimming floored at SUN_NIGHT_MIN_BRIGHTNESS
  rgb = mix(vec3(0.0), clamp(rgb, 0.0, 1.0), u_brightness);
  out_FragColor = vec4(rgb, baseColor.a);
}
`
}

/** Snapshot extra sky/atmosphere properties touched when effects are active. */
export function snapshotAtmosphereFx(scene) {
  return {
    atmosphereDynamicLighting: scene?.atmosphere ? scene.atmosphere.dynamicLighting : undefined,
    skyAtmospherePerFragment: scene?.skyAtmosphere ? scene.skyAtmosphere.perFragmentAtmosphere : undefined,
    skyAtmosphereLightIntensity: scene?.skyAtmosphere ? scene.skyAtmosphere.atmosphereLightIntensity : undefined,
    skyAtmosphereMieCoeff: scene?.skyAtmosphere?.atmosphereMieCoefficient
      ? { ...scene.skyAtmosphere.atmosphereMieCoefficient }
      : undefined,
    skyAtmosphereSaturation: scene?.skyAtmosphere ? scene.skyAtmosphere.saturationShift : undefined,
    globeDynamicAtmo: scene?.globe ? scene.globe.dynamicAtmosphereLighting : undefined,
    globeDynamicAtmoFromSun: scene?.globe ? scene.globe.dynamicAtmosphereLightingFromSun : undefined,
    sunGlowFactor: scene?.sun ? scene.sun.glowFactor : undefined,
  }
}

/** Restore extra sky/atmosphere properties from a snapshot taken by snapshotAtmosphereFx. */
export function restoreAtmosphereFx(Cesium, scene, fx) {
  if (!scene || !fx) return
  if (fx.atmosphereDynamicLighting !== undefined && scene.atmosphere) {
    scene.atmosphere.dynamicLighting = fx.atmosphereDynamicLighting
  }
  if (fx.skyAtmospherePerFragment !== undefined && scene.skyAtmosphere) {
    scene.skyAtmosphere.perFragmentAtmosphere = fx.skyAtmospherePerFragment
  }
  if (fx.skyAtmosphereLightIntensity !== undefined && scene.skyAtmosphere) {
    scene.skyAtmosphere.atmosphereLightIntensity = fx.skyAtmosphereLightIntensity
  }
  if (fx.skyAtmosphereMieCoeff && scene.skyAtmosphere?.atmosphereMieCoefficient && typeof Cesium?.Cartesian3 === 'function') {
    scene.skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(
      fx.skyAtmosphereMieCoeff.x,
      fx.skyAtmosphereMieCoeff.y,
      fx.skyAtmosphereMieCoeff.z,
    )
  }
  if (fx.skyAtmosphereSaturation !== undefined && scene.skyAtmosphere) {
    scene.skyAtmosphere.saturationShift = fx.skyAtmosphereSaturation
  }
  if (fx.globeDynamicAtmo !== undefined && scene.globe) {
    scene.globe.dynamicAtmosphereLighting = fx.globeDynamicAtmo
  }
  if (fx.globeDynamicAtmoFromSun !== undefined && scene.globe) {
    scene.globe.dynamicAtmosphereLightingFromSun = fx.globeDynamicAtmoFromSun
  }
  if (fx.sunGlowFactor !== undefined && scene.sun) {
    scene.sun.glowFactor = fx.sunGlowFactor
  }
}

const toCartesian3 = (Cesium, [x, y, z]) => new Cesium.Cartesian3(x, y, z)

/**
 * Create the unified PostProcessStage when full Cesium `PostProcessStage` +
 * `Cartesian3` + `depthTexture` are available. Returns null on minimal mocks
 * so callers can fall back to `PostProcessStageLibrary.createBrightnessStage()`.
 */
export function createSunSkyPostProcessStage(Cesium, scene) {
  if (typeof Cesium?.PostProcessStage !== 'function' || typeof Cesium?.Cartesian3 !== 'function') {
    return null
  }
  if (scene?.context?.depthTexture === false) return null
  const initial = computeSunBackdropProfile(30)
  return new Cesium.PostProcessStage({
    name: SUN_SKY_STAGE_NAME,
    fragmentShader: buildSunSkyFragmentShader(),
    uniforms: {
      u_brightness: 1.0,
      u_fxEnabled: 1.0,
      u_curtainStrength: initial.curtainStrength,
      u_glowStrength: initial.glowStrength,
      u_sunIntensity: initial.sunIntensity,
      u_starAmount: initial.starAmount,
      u_skyZenithColor: toCartesian3(Cesium, initial.zenith),
      u_skyHorizonColor: toCartesian3(Cesium, initial.horizon),
      u_sunsetGlowColor: toCartesian3(Cesium, initial.sunsetGlow),
      u_sunCoreColor: toCartesian3(Cesium, initial.sunCore),
      u_sunGlowColor: toCartesian3(Cesium, initial.sunGlow),
      u_sceneTint: toCartesian3(Cesium, initial.sceneTint),
    },
  })
}

/** Apply computed sky-curtain & atmosphere scattering parameters for one instant. */
export function applySunSkyFx(Cesium, scene, stage, { altitude, brightness, effects = true, fxSnapshot = null }) {
  const profile = computeSunBackdropProfile(altitude)

  if (effects) {
    const sunlight = Cesium?.DynamicAtmosphereLightingType?.SUNLIGHT
    if (scene.atmosphere && sunlight !== undefined) {
      scene.atmosphere.dynamicLighting = sunlight
    }
    if (scene.skyAtmosphere) {
      if (scene.skyAtmosphere.perFragmentAtmosphere !== undefined) {
        scene.skyAtmosphere.perFragmentAtmosphere = true
      }
      if (scene.skyAtmosphere.atmosphereLightIntensity !== undefined) {
        scene.skyAtmosphere.atmosphereLightIntensity = profile.atmoLightIntensity
      }
      if (scene.skyAtmosphere.atmosphereMieCoefficient !== undefined && typeof Cesium?.Cartesian3 === 'function') {
        const baseMie = 21e-6 * profile.atmoMieScale
        scene.skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(baseMie, baseMie, baseMie)
      }
      if (scene.skyAtmosphere.saturationShift !== undefined) {
        scene.skyAtmosphere.saturationShift = profile.atmoSaturation
      }
    }
    if (scene.globe) {
      if (scene.globe.dynamicAtmosphereLighting !== undefined) scene.globe.dynamicAtmosphereLighting = true
      if (scene.globe.dynamicAtmosphereLightingFromSun !== undefined) scene.globe.dynamicAtmosphereLightingFromSun = true
    }
    if (scene.sun && scene.sun.glowFactor !== undefined) {
      scene.sun.glowFactor = profile.sunGlowFactor
    }
    if (stage?.name === SUN_SKY_STAGE_NAME && scene.skyBox && scene.skyAtmosphere) {
      scene.skyBox.show = profile.skyBoxVisible
    }
  } else if (fxSnapshot) {
    restoreAtmosphereFx(Cesium, scene, fxSnapshot)
    if (scene.skyBox) scene.skyBox.show = true
  }

  if (!stage) return profile
  if (stage.name === SUN_SKY_STAGE_NAME && stage.uniforms) {
    const is3d = Cesium?.SceneMode?.SCENE3D === undefined || scene.mode === undefined || scene.mode === Cesium.SceneMode.SCENE3D
    const activeFx = Boolean(effects && is3d)
    stage.uniforms.u_brightness = brightness
    stage.uniforms.u_fxEnabled = activeFx ? 1.0 : 0.0
    stage.uniforms.u_curtainStrength = profile.curtainStrength
    stage.uniforms.u_glowStrength = profile.glowStrength
    stage.uniforms.u_sunIntensity = profile.sunIntensity
    stage.uniforms.u_starAmount = profile.starAmount
    stage.uniforms.u_skyZenithColor = toCartesian3(Cesium, profile.zenith)
    stage.uniforms.u_skyHorizonColor = toCartesian3(Cesium, profile.horizon)
    stage.uniforms.u_sunsetGlowColor = toCartesian3(Cesium, profile.sunsetGlow)
    stage.uniforms.u_sunCoreColor = toCartesian3(Cesium, profile.sunCore)
    stage.uniforms.u_sunGlowColor = toCartesian3(Cesium, profile.sunGlow)
    stage.uniforms.u_sceneTint = toCartesian3(Cesium, profile.sceneTint)
    stage.enabled = activeFx || brightness < 0.999
  } else {
    if (stage.uniforms) stage.uniforms.brightness = brightness
    stage.enabled = brightness < 0.999
  }
  return profile
}
