// Surface d'eau unique qui suit le joueur : reflets doux, scintillements pixelisés.

import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';

export class Water {
  constructor(scene) {
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(0x6ab4cc) },
        uSky: { value: new THREE.Color(0xd8edf6) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color(1, 1, 1) },
        uTime: { value: 0 },
        uNight: { value: 0 },
      },
    ]);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 uColor, uSky, uSunDir, uSunCol;
        uniform float uTime, uNight;
        varying vec3 vWorld;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 V = normalize(cameraPosition - vWorld);
          vec2 q = floor(vWorld.xz * 2.0) / 2.0;
          // ondulations douces quantifiées
          float w1 = sin(q.x * 0.55 + uTime * 0.9) * sin(q.y * 0.47 - uTime * 0.7);
          float w2 = sin((q.x + q.y) * 0.31 - uTime * 0.5);
          vec3 N = normalize(vec3(w1 * 0.06, 1.0, w2 * 0.06));
          float fres = pow(1.0 - max(V.y, 0.0), 3.0);
          vec3 col = mix(uColor, uSky, 0.25 + fres * 0.6);
          float band = step(0.82, w1 * 0.5 + w2 * 0.5 + 0.35);
          col += uSky * band * 0.07;
          vec3 R = reflect(-V, N);
          float spec = pow(max(dot(R, uSunDir), 0.0), 120.0);
          col += uSunCol * floor(spec * 4.0) / 4.0 * 0.8;
          // scintillements
          float sp = h21(q + floor(uTime * 1.5));
          float glint = step(0.992, sp) * smoothstep(0.55, 0.95, dot(R, uSunDir));
          col += uSunCol * glint * 0.6;
          float alpha = mix(0.72, 0.9, fres);
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const geo = new THREE.PlaneGeometry(520, 520, 1, 1).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(center, time, sky) {
    this.mesh.position.x = Math.round(center.x / 16) * 16;
    this.mesh.position.z = Math.round(center.z / 16) * 16;
    const u = this.uniforms;
    u.uTime.value = time;
    u.uColor.value.copy(sky.water);
    u.uSky.value.copy(sky.hor);
    u.uSunDir.value.copy(sky.sunDir);
    u.uSunCol.value.copy(sky.lightCol);
    u.uNight.value = sky.night;
  }
}
