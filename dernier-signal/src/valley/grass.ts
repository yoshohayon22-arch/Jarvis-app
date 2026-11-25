// Herbe dense autour de R-12 : brins instanciés qui suivent le joueur (pavage torique),
// ondulent au vent, s'écartent sous ses pas et brillent doucement la nuit.
import * as THREE from 'three';
import { U } from './atmosphere';
import { SIZE } from './terrain';

export class Grass extends THREE.Mesh {
  constructor(dataTex: THREE.DataTexture, count: number, patch: number) {
    // brin : 4 segments, effilé
    const segs = 4, pos: number[] = [], uv: number[] = [], ind: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const v = i / segs, w = 0.032 * (1 - v * 0.8);
      if (i < segs) { pos.push(-w, v, 0, w, v, 0); uv.push(0, v, 1, v); }
      else { pos.push(0, v, 0); uv.push(0.5, 1); }
    }
    for (let i = 0; i < segs - 1; i++) { const a = i * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const t = (segs - 1) * 2; ind.push(t, t + 1, t + 2);
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    base.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    base.setIndex(ind);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) off.set([Math.random() * patch, Math.random() * patch, Math.random(), Math.random()], i * 4);
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    g.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, ...U, tData: { value: dataTex }, uPatch: { value: patch }, uSize: { value: SIZE }, uAmb: { value: new THREE.Color() }, uSunI: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aOff;
        uniform sampler2D tData; uniform float uPatch, uSize, uTime; uniform vec3 uPlayer; uniform vec2 uWind;
        varying vec2 vUv; varying float vShade; varying vec3 vW; varying float vTip; varying float vHue;
        #include <fog_pars_vertex>
        float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
        void main(){
          vec2 c = uPlayer.xz - uPatch * 0.5;
          vec2 wxz = c + mod(aOff.xy - c, uPatch);
          vec2 tuv = (wxz + uSize * 0.5) / uSize;
          vec4 d = texture2D(tData, tuv);
          float dens = d.g;
          float edge = 1.0 - smoothstep(uPatch * 0.32, uPatch * 0.5, length(wxz - uPlayer.xz));
          float keep = step(aOff.z, dens) * edge * step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
          float clump = 0.5 + 0.5 * sin(wxz.x * 0.9) * sin(wxz.y * 0.7);
          float hgt = (0.18 + 0.5 * aOff.w * aOff.w) * (0.45 + 0.8 * dens) * (0.7 + 0.6 * clump) * keep;
          float ang = hh(aOff.xy) * 6.2831;
          vec3 p = position; p.x *= (0.7 + aOff.w * 0.8);
          float lean = (hh(aOff.xy + 1.7) - 0.5) * 0.5;
          vec3 lp = vec3(cos(ang) * p.x, p.y * hgt, sin(ang) * p.x);
          // vent
          float gust = sin(wxz.x * 0.08 + uTime * 1.3) * 0.5 + sin(wxz.y * 0.11 - uTime * 0.9) * 0.3 + sin((wxz.x + wxz.y) * 0.5 + uTime * 2.7) * 0.12;
          vec2 bend = (uWind * (0.18 + 0.25 * gust) + vec2(cos(ang + 1.3), sin(ang + 1.3)) * lean) * p.y * p.y;
          // le robot écarte les brins
          vec2 away = wxz - uPlayer.xz; float dd = length(away);
          float push = smoothstep(1.1, 0.2, dd) * step(abs(uPlayer.y - d.r), 1.5);
          bend += (dd > 0.001 ? away / dd : vec2(0.0)) * push * 0.9 * p.y;
          lp.xz += bend * hgt; lp.y *= 1.0 - 0.35 * length(bend) * p.y;
          vec3 wp = vec3(wxz.x, d.r - 0.03, wxz.y) + lp;
          vW = wp; vUv = uv; vTip = p.y; vHue = hh(aOff.xy + 3.1);
          vShade = mix(0.25, 1.0, p.y) * (1.0 - d.b * 0.5);
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunCol; uniform vec3 uAmb; uniform float uSunI, uNight, uDay;
        varying vec2 vUv; varying float vShade; varying vec3 vW; varying float vTip; varying float vHue;
        #include <fog_pars_fragment>
        void main(){
          vec3 base = mix(vec3(0.012, 0.03, 0.022), vec3(0.075, 0.16, 0.09), pow(vTip, 0.8));
          base = mix(base, vec3(0.13, 0.16, 0.06), vHue * vTip * 0.6);
          base = mix(base, vec3(0.05, 0.12, 0.14) * (0.5 + vTip), step(0.82, vHue) * 0.7);
          // lumière du soleil traversant les brins + ambiance du ciel
          float trans = pow(max(dot(normalize(cameraPosition - vW), -uSunDir), 0.0), 3.0) * vTip;
          vec3 lit = base * (uAmb * 1.2 + uSunCol * uSunI * (0.55 + 0.45 * uSunDir.y) * vShade) + base * uSunCol * uSunI * trans * 1.5;
          // pointes bioluminescentes la nuit
          lit += vec3(0.1, 0.9, 0.7) * pow(vTip, 6.0) * uNight * step(0.7, vHue) * 0.9;
          gl_FragColor = vec4(lit, 1.0);
          #include <fog_fragment>
        }`,
      side: THREE.DoubleSide, fog: true,
    });
    super(g, mat);
    this.frustumCulled = false;
    this.name = 'grass';
  }
}
