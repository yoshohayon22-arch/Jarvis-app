// Ciel physique simplifié (jour, coucher, nuit étoilée, voie lactée, deux lunes, aurores)
// et brouillard de hauteur qui remplace le brouillard uniforme de three.js.
import * as THREE from 'three';

/** Uniformes partagés par tous les matériaux de la vallée. */
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.2).normalize() },
  uSunCol: { value: new THREE.Color(1, 0.9, 0.8) },
  uMoonDir: { value: new THREE.Vector3(-0.4, 0.5, -0.6).normalize() },
  uMoon2Dir: { value: new THREE.Vector3(0.5, 0.35, -0.7).normalize() },
  uDay: { value: 1 },          // 0 nuit … 1 jour
  uNight: { value: 0 },        // intensité de la bioluminescence
  uDusk: { value: 0 },         // lever/coucher
  uAurora: { value: 0 },
  uFogH: { value: new THREE.Vector4(2, 0.12, 0.012, 0.0016) }, // hauteur de base, décroissance, densité de hauteur, densité de distance
  uFogCol: { value: new THREE.Color(0.5, 0.6, 0.7) },
  uFogSunCol: { value: new THREE.Color(1, 0.8, 0.6) },
  uMist: { value: 0 },          // brume basse (matin, rivière)
  uWind: { value: new THREE.Vector2(1, 0.3) },
  uPlayer: { value: new THREE.Vector3() },
  uWet: { value: 0 },
};

/** Brouillard de hauteur : remplace les morceaux de shader « fog » de three.js. */
export function installHeightFog() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vFogWorld;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n vFogWorld = (inverse(viewMatrix) * mvPosition).xyz;\n#endif';
  C.fog_pars_fragment = `#ifdef USE_FOG
 uniform vec3 fogColor; varying vec3 vFogWorld;
 uniform vec4 uFogH; uniform vec3 uFogCol; uniform vec3 uFogSunCol; uniform vec3 uSunDir; uniform float uMist; uniform float uTime;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
 vec4 heightFog(vec3 wp) {
   vec3 rd = wp - cameraPosition; float dist = length(rd); vec3 dir = rd / max(dist, 1e-3);
   float b = max(uFogH.y, 1e-3);
   float c0 = uFogH.z * exp(-b * (cameraPosition.y - uFogH.x));
   float hInt = abs(rd.y) > 0.01 ? c0 * (1.0 - exp(-b * rd.y)) / (b * rd.y) : c0;
   // brume basse : épaisse près du sol, variable selon l'endroit
   float mist = uMist * exp(-max(wp.y - uFogH.x + 1.0, 0.0) * 0.6) * (0.6 + 0.4 * sin(wp.x * 0.03 + uTime * 0.05) * sin(wp.z * 0.027 - uTime * 0.04));
   float amt = 1.0 - exp(-dist * (uFogH.w + hInt + mist * 0.02));
   float sunAmt = pow(max(dot(dir, uSunDir), 0.0), 6.0);
   vec3 col = mix(uFogCol, uFogSunCol, sunAmt * 0.75);
   return vec4(col, clamp(amt, 0.0, 1.0));
 }
#endif`;
  C.fog_fragment = '#ifdef USE_FOG\n vec4 hf = heightFog(vFogWorld);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, hf.rgb, hf.a);\n#endif';
}

/** Injecte les uniformes de l'atmosphère dans un matériau standard (en gardant ses autres modifications). */
export function withAtmosphere(m: THREE.Material) {
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => { prev(sh, r); for (const [k, v] of Object.entries(U)) if (!(k in sh.uniforms)) sh.uniforms[k] = v; };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|atm';
  return m;
}

const skyFn = /* glsl */ `
uniform vec3 uSunDir, uSunCol, uMoonDir, uMoon2Dir; uniform float uDay, uDusk, uAurora, uTime;
float h1(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h1(i), h1(i+vec3(1,0,0)), f.x), mix(h1(i+vec3(0,1,0)), h1(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h1(i+vec3(0,0,1)), h1(i+vec3(1,0,1)), f.x), mix(h1(i+vec3(0,1,1)), h1(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.07; a *= 0.5; } return s; }
vec3 skyColor(vec3 d, bool stars) {
  float y = d.y;
  float sunE = uSunDir.y;
  // diffusion : zénith teinté, horizon clair, absorption au coucher
  vec3 zen = mix(vec3(0.006, 0.01, 0.028), vec3(0.09, 0.27, 0.62), smoothstep(-0.1, 0.35, sunE));
  vec3 hor = mix(vec3(0.02, 0.03, 0.06), vec3(0.55, 0.7, 0.86), smoothstep(-0.12, 0.3, sunE));
  vec3 dusk = vec3(1.0, 0.42, 0.18) * uDusk;
  float sd = max(dot(d, uSunDir), 0.0);
  hor = mix(hor, hor * 0.5 + dusk * (0.6 + 0.8 * pow(sd, 3.0)), uDusk * 0.9);
  float t = pow(1.0 - max(y, 0.0), 4.0);
  vec3 col = mix(zen, hor, t);
  col += vec3(0.9, 0.35, 0.5) * uDusk * 0.25 * pow(1.0 - abs(y), 6.0) * (1.0 - sd); // ceinture rose à l'opposé
  // soleil et halo (Mie)
  col += uSunCol * (pow(sd, 600.0) * 40.0 + pow(sd, 12.0) * 0.35 * (0.3 + uDusk)) * smoothstep(-0.05, 0.02, sunE);
  float night = 1.0 - uDay;
  if (stars && night > 0.01) {
    vec3 sp = d * 280.0; vec3 cell = floor(sp); float r = h1(cell);
    float st = step(0.985, r) * pow(max(0.0, 1.0 - length(fract(sp) - 0.5) * 2.6), 6.0) * (0.6 + 0.4 * sin(uTime * (1.0 + r * 4.0) + r * 40.0));
    vec3 sp2 = d * 90.0; float r2 = h1(floor(sp2)); st += step(0.992, r2) * pow(max(0.0, 1.0 - length(fract(sp2) - 0.5) * 2.2), 8.0) * 2.0;
    // voie lactée : bande inclinée avec poussières sombres
    vec3 gal = normalize(vec3(0.35, 0.25, 0.9));
    float band = exp(-pow(dot(d, gal) * 3.2, 2.0));
    float dust = fb(d * 6.0 + 3.0);
    vec3 mw = mix(vec3(0.25, 0.22, 0.45), vec3(0.65, 0.55, 0.85), fb(d * 14.0)) * band * smoothstep(0.35, 0.75, dust + 0.2) * 0.22;
    mw += vec3(0.7, 0.75, 0.95) * band * step(0.9, h1(floor(d * 520.0))) * 0.6 * smoothstep(0.4, 0.8, dust);
    col += (vec3(st) * vec3(0.9, 0.95, 1.0) * 4.0 + mw * 2.2) * night * smoothstep(-0.05, 0.15, y);
    // deux lunes (phase éclairée côté soleil)
    for (int k = 0; k < 2; k++) {
      vec3 md = k == 0 ? uMoonDir : uMoon2Dir; float rad = k == 0 ? 0.035 : 0.018;
      float m = dot(d, md);
      if (m > cos(rad * 1.6)) {
        float disc = smoothstep(cos(rad), cos(rad * 0.94), m);
        vec3 refU = abs(md.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0); vec3 tng = normalize(cross(md, refU)); vec3 bt = cross(tng, md);
        vec2 q = vec2(dot(d - md, tng), dot(d - md, bt)) / rad;
        float z = sqrt(max(0.0, 1.0 - dot(q, q)));
        vec3 nrm = normalize(q.x * tng + q.y * bt + z * md);
        float lit = clamp(dot(nrm, normalize(uSunDir + vec3(0.0, 0.0, 0.2))) * 0.8 + 0.25, 0.04, 1.0);
        vec3 mc = (k == 0 ? vec3(0.95, 0.93, 1.0) : vec3(1.0, 0.85, 0.75)) * (0.75 + 0.25 * n3(vec3(q * 4.0, float(k))));
        col = mix(col, mc * lit * 1.6, disc * (0.35 + 0.65 * night));
        col += mc * pow(max(m, 0.0), 2000.0 * (k == 0 ? 1.0 : 3.0)) * 0.6 * night;
      }
    }
    // aurores : rideaux verts et violets au nord
    if (uAurora > 0.01 && y > 0.0) {
      vec2 a = d.xz / (y + 0.15);
      float curtain = fb(vec3(a.x * 0.8 + uTime * 0.03, a.y * 0.15, uTime * 0.05));
      float streak = pow(fb(vec3(a.x * 6.0, 0.0, uTime * 0.12)), 3.0) * 4.0;
      float hmask = smoothstep(0.05, 0.3, y) * smoothstep(0.85, 0.35, y) * smoothstep(0.1, -0.6, d.z);
      vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.25, 0.7, y));
      col += ac * curtain * streak * hmask * uAurora * 0.9;
    }
  }
  // sol sous l'horizon : sombre
  col = mix(col, hor * 0.35, smoothstep(0.0, -0.08, y));
  return col;
}`;

export class SkyDome extends THREE.Mesh {
  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: skyFn + '\nvarying vec3 vD; void main(){ gl_FragColor = vec4(skyColor(normalize(vD), true), 1.0); }',
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    super(new THREE.SphereGeometry(900, 48, 24), mat);
    this.frustumCulled = false; this.renderOrder = -1;
  }
}
export const SKY_GLSL = skyFn;

/** Calcule les couleurs et directions selon l'heure (0-24). */
export function timeOfDay(hour: number, day: number) {
  const a = ((hour - 6) / 24) * Math.PI * 2; // 6 h : lever à l'est, 18 h : coucher à l'ouest
  const sun = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.92, 0.32).normalize();
  const elev = sun.y;
  const dayK = THREE.MathUtils.smoothstep(elev, -0.12, 0.18);
  const dusk = Math.max(0, 1 - Math.abs(elev - 0.03) / 0.2) * THREE.MathUtils.smoothstep(elev, -0.2, 0.0);
  // lunes : trajectoires décalées, mouvement lent sur plusieurs jours
  const ma = a + Math.PI + 0.6 + day * 0.4, mb = a + Math.PI * 0.6 + day * 1.1;
  const moon = new THREE.Vector3(Math.cos(ma), Math.abs(Math.sin(ma)) * 0.8 + 0.15, -0.45).normalize();
  const moon2 = new THREE.Vector3(Math.cos(mb) * 0.8, Math.abs(Math.sin(mb)) * 0.6 + 0.2, -0.7).normalize();
  const sunCol = new THREE.Color().setRGB(1, 0.55 + 0.42 * THREE.MathUtils.smoothstep(elev, 0, 0.4), 0.3 + 0.62 * THREE.MathUtils.smoothstep(elev, 0.02, 0.5));
  return { sun, elev, dayK, dusk, moon, moon2, sunCol };
}
