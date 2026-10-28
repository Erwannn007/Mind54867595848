// Matériaux partagés : un seul jeu de matériaux pour tout le monde (moins de shaders, moins de draw calls).

import * as THREE from 'three';
import { makeGrainTexture, makeLeafTexture, makeSpriteAtlas } from './textures.js';

export const shared = {
  uTime: { value: 0 },
  uNight: { value: 0 },  // 0 = plein jour, 1 = nuit noire
  uWind: { value: 1 },
  uPx: { value: 500 },   // échelle des points (pixels par unité à 1 m)
};

// Ajoute le vent (aSway) et la lueur nocturne (aGlow) à un MeshLambertMaterial.
function addSwayGlow(material, key, upNormal = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uNight = shared.uNight;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSway;
        attribute float aGlow;
        varying float vGlow;
        uniform float uTime;
        uniform float uWind;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGlow = aGlow;
        {
          vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
          float ph = uTime * 1.5 + wp0.x * 0.31 + wp0.z * 0.23;
          float sw = aSway * uWind;
          transformed.x += (sin(ph) * 0.10 + sin(ph * 2.3) * 0.03) * sw;
          transformed.z += cos(ph * 0.8) * 0.08 * sw;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vGlow;
        uniform float uNight;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.12 + uNight * 0.95);`
      );
    if (upNormal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        normal = normalize(vNormal);`
      );
    }
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function createMaterials() {
  const grain = makeGrainTexture();
  const leaf = makeLeafTexture();
  const atlas = makeSpriteAtlas();

  const terrain = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: grain,
    flatShading: true,
  });

  const veg = addSwayGlow(
    new THREE.MeshLambertMaterial({ vertexColors: true, map: leaf, flatShading: true }),
    'everlune-veg'
  );

  const detail = addSwayGlow(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      map: atlas,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    'everlune-detail',
    true
  );

  const halo = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uNight: shared.uNight, uPx: shared.uPx },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aFlicker;
      uniform float uTime;
      uniform float uNight;
      uniform float uPx;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float fl = 1.0 + aFlicker * (0.12 * sin(uTime * 9.0 + position.x * 3.1) + 0.07 * sin(uTime * 15.0 + position.z * 1.7));
        gl_PointSize = clamp(aSize * fl * uPx / -mv.z, 0.0, 96.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vA = 0.18 + 0.82 * uNight;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = max(1.0 - d, 0.0);
        a = floor(a * a * 5.0) / 5.0;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vColor, a * vA * 0.75);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // fumée des cheminées : volutes pixelisées qui montent et dérivent avec le vent
  const smoke = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uNight: shared.uNight, uPx: shared.uPx, uWind: shared.uWind, ...THREE.UniformsLib.fog },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uPx, uWind;
      varying float vA;
      #include <fog_pars_vertex>
      void main() {
        float t = fract(uTime * 0.06 + aSeed);
        vec3 p = position;
        p.y += t * 7.0;
        p.x += t * t * 4.0 * uWind + sin(uTime * 0.7 + aSeed * 20.0) * 0.35 * t;
        p.z += t * 1.5 + cos(uTime * 0.5 + aSeed * 13.0) * 0.3 * t;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((0.5 + t * 2.4) * uPx / -mvPosition.z, 0.0, 120.0);
        gl_Position = projectionMatrix * mvPosition;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - t);
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vA;
      #include <fog_pars_fragment>
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = floor(max(1.0 - d * d, 0.0) * 3.0) / 3.0 * vA * 0.42;
        if (a <= 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.86, 0.84, 0.9), vec3(0.42, 0.44, 0.58), uNight), a);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });

  return { terrain, veg, detail, halo, smoke };
}
