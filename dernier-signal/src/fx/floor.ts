import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { pbr } from '../core/textures';

// Sol réfléchissant : béton poli sombre (PBR, reçoit les ombres) + reflet planaire
// flouté selon la rugosité, déformé par la carte de normales, ajouté par-dessus.

const reflShader = {
  name: 'BlurredReflector',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uArm: { value: null }, uNor: { value: null }, uRepeat: { value: 4 }, uStrength: { value: 0.75 },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) }, uRadius: { value: 9 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D uArm; uniform sampler2D uNor;
    uniform float uRepeat; uniform float uStrength; uniform vec2 uTexel; uniform float uRadius;
    varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    const vec2 P[8] = vec2[8](vec2(-0.613,0.617), vec2(0.17,-0.04), vec2(-0.299,-0.791), vec2(0.645,0.493),
                              vec2(-0.651,0.717), vec2(0.421,0.027), vec2(-0.817,-0.271), vec2(0.977,-0.108));
    void main(){
      #include <logdepthbuf_fragment>
      vec2 tuv = vLocal / uRepeat;
      float rough = texture2D(uArm, tuv).g;
      vec3 n = texture2D(uNor, tuv).xyz * 2.0 - 1.0;
      vec2 uv = vUv.xy / vUv.w + n.xy * 0.012;
      float lod = mix(0.6, 4.2, smoothstep(0.2, 0.9, rough));
      float blur = mix(1.0, 3.0, smoothstep(0.25, 0.85, rough)) * exp2(lod);
      vec3 acc = textureLod(tDiffuse, uv, lod).rgb * 2.0;
      for (int i = 0; i < 8; i++) acc += textureLod(tDiffuse, uv + P[i] * uTexel * blur, lod).rgb;
      acc /= 10.0;
      vec3 V = normalize(cameraPosition - vWorld);
      float F = 0.05 + 0.95 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
      float fade = 1.0 - smoothstep(uRadius * 0.55, uRadius, length(vWorld.xz));
      float gloss = 1.0 - smoothstep(0.3, 0.95, rough) * 0.75;
      gl_FragColor = vec4(acc * color * mix(0.22, 1.0, F) * uStrength * gloss * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function createFloor(size: number, res: '1k' | '2k', reflection: { enabled: boolean; width: number; height: number }) {
  const group = new THREE.Group();
  const s = pbr('smooth_concrete_floor', res, size / 4);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x141518, roughnessMap: s.arm, aoMap: s.arm, roughness: 1.0, metalness: 0.0,
    normalMap: s.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.2,
  });
  const geo = new THREE.PlaneGeometry(size, size);
  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  let reflector: Reflector | null = null;
  if (reflection.enabled) {
    reflector = new Reflector(new THREE.PlaneGeometry(size, size), {
      textureWidth: reflection.width, textureHeight: reflection.height, clipBias: 0.002,
      shader: reflShader, color: 0xb8c4d0, multisample: 0,
    });
    const rt = reflector.getRenderTarget();
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    const m = reflector.material as THREE.ShaderMaterial;
    m.uniforms.uArm.value = s.arm.clone(); m.uniforms.uArm.value.repeat.set(1, 1);
    m.uniforms.uNor.value = s.normalMap;
    m.uniforms.uRepeat.value = 4;
    m.uniforms.uTexel.value.set(1 / reflection.width, 1 / reflection.height);
    m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false;
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0.0015;
    reflector.renderOrder = 1;
    group.add(reflector);
  }
  return { group, floor, reflector, material: mat };
}

export function resizeReflector(r: Reflector | null, w: number, h: number) {
  if (!r) return;
  r.getRenderTarget().setSize(w, h);
  (r.material as THREE.ShaderMaterial).uniforms.uTexel.value.set(1 / w, 1 / h);
}
