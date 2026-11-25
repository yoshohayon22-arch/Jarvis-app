// Rivière : ruban qui suit le lit, shader d'eau (reflets du ciel, vagues qui suivent le courant,
// transparence selon la profondeur, mousse aux berges et dans les rapides, plancton lumineux la nuit).
import * as THREE from 'three';
import { U, SKY_GLSL } from './atmosphere';
import { Terrain, SIZE } from './terrain';

export class River extends THREE.Mesh {
  constructor(t: Terrain) {
    const S = t.riverSamples, across = 10;
    const pos: number[] = [], uv: number[] = [], flow: number[] = [], ind: number[] = [];
    for (let i = 0; i < S.length; i++) {
      const a = S[Math.max(0, i - 1)].p, b = S[Math.min(S.length - 1, i + 1)].p;
      const dir = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
      const nrm = new THREE.Vector2(-dir.y, dir.x);
      const w = S[i].width / 2 + 2.5;
      // pente locale → vitesse du courant (rapides)
      const dl = S[Math.max(0, i - 2)].level - S[Math.min(S.length - 1, i + 2)].level;
      for (let j = 0; j <= across; j++) {
        const s = j / across * 2 - 1;
        pos.push(S[i].p.x + nrm.x * s * w, S[i].level, S[i].p.y + nrm.y * s * w);
        uv.push(s, S[i].t); flow.push(dir.x, dir.y, Math.min(1, dl * 2.5));
      }
    }
    for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < across; j++) { const a = i * (across + 1) + j, b = a + across + 1; ind.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
    g.setIndex(ind);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, ...U, tData: { value: t.dataTex }, uSize: { value: SIZE }, uAmb: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute vec3 aFlow; varying vec3 vW; varying vec2 vUv; varying vec3 vFlow;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vFlow = aFlow; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tData; uniform float uSize, uNight; uniform vec3 uAmb;
        varying vec3 vW; varying vec2 vUv; varying vec3 vFlow;
        #include <fog_pars_fragment>
        ${SKY_GLSL.replace('uniform vec3 uSunDir, uSunCol,', 'uniform vec3 uSunCol,').replace('uniform float uDay, uDusk, uAurora, uTime;', 'uniform float uDay, uDusk, uAurora;')}
        float wh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(wh(i), wh(i+vec2(1,0)), f.x), mix(wh(i+vec2(0,1)), wh(i+vec2(1,1)), f.x), f.y); }
        float waves(vec2 p, vec2 fl, float sp){
          vec2 q = p - fl * uTime * (1.2 + sp * 4.0);
          return wn(q * 0.9) * 0.5 + wn(q * 2.3 + 7.0) * 0.3 + wn(q * 5.7 - uTime * 0.3) * 0.2;
        }
        void main(){
          vec2 fl = normalize(vFlow.xy + 1e-4); float sp = vFlow.z;
          float e = 0.06;
          float h0 = waves(vW.xz, fl, sp), hx = waves(vW.xz + vec2(e, 0.0), fl, sp), hz = waves(vW.xz + vec2(0.0, e), fl, sp);
          vec3 n = normalize(vec3((h0 - hx) / e * (0.12 + sp * 0.3), 1.0, (h0 - hz) / e * (0.12 + sp * 0.3)));
          vec3 v = normalize(vW - cameraPosition);
          vec3 r = reflect(v, n); r.y = abs(r.y);
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
          vec3 refl = skyColor(r, true);
          float spec = pow(max(dot(r, uSunDir), 0.0), 220.0) * 6.0 * smoothstep(-0.05, 0.05, uSunDir.y);
          // profondeur : niveau de l'eau - fond
          vec2 tuv = (vW.xz + uSize * 0.5) / uSize;
          float depth = max(vW.y - texture2D(tData, tuv).r, 0.0);
          vec3 shallow = vec3(0.06, 0.16, 0.15), deep = vec3(0.005, 0.03, 0.045);
          vec3 body = mix(shallow, deep, smoothstep(0.0, 1.6, depth)) * (uAmb * 1.5 + uSunCol * max(uSunDir.y, 0.0) * 0.6);
          vec3 col = mix(body, refl, fres) + uSunCol * spec;
          // mousse : berges et rapides
          float foamN = wn(vW.xz * 3.0 - fl * uTime * 2.0) * wn(vW.xz * 7.0 + uTime);
          float foam = smoothstep(0.35, 0.0, depth) * smoothstep(0.25, 0.6, foamN + 0.2) + sp * smoothstep(0.35, 0.7, foamN + sp * 0.3);
          col = mix(col, vec3(0.85, 0.9, 0.92) * (uAmb * 1.5 + uSunCol * 0.7), clamp(foam, 0.0, 0.85));
          // plancton bioluminescent
          float pl = step(0.985, wh(floor(vW.xz * 2.5 + fl * uTime * 0.6))) * (0.5 + 0.5 * sin(uTime * 3.0 + vW.x));
          col += vec3(0.2, 1.0, 0.9) * pl * uNight * 1.4;
          float alpha = clamp(mix(0.35, 0.96, smoothstep(0.0, 1.2, depth)) + fres * 0.5 + foam, 0.0, 1.0);
          alpha *= smoothstep(1.0, 0.86, abs(vUv.x));
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    super(g, mat);
    this.renderOrder = 2;
    this.name = 'river';
  }
}
