import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Agent, AgentAnim } from "../sim/agents";
import { AssetLibrary, type LoadedModel } from "./assets";

export interface LookDef {
  model: string;
  /** Names of non-skinned accessory nodes to keep (hat, cape, weapon…); the others are hidden. */
  accessories: string[];
}

export interface CrowdDef {
  height: number;
  clips: Record<AgentAnim, string>;
  sampleRate: number;
  maxFrames: number;
}

interface ClipInfo {
  start: number;
  frames: number;
  duration: number;
}

interface BakedLook {
  geometry: THREE.BufferGeometry;
  texture: THREE.DataTexture;
  vertexCount: number;
  clips: Record<AgentAnim, ClipInfo>;
  map: THREE.Texture | null;
}

const VAT_WIDTH = 1024;

/**
 * Bakes a skinned character into a vertex animation texture (VAT): for every
 * sampled frame of every clip, the skinned position of each vertex. The crowd
 * then renders with plain instancing — one draw call per look, no skeletons.
 */
function bakeLook(model: LoadedModel, look: LookDef, def: CrowdDef): BakedLook {
  const root = AssetLibrary.instantiate(model);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const skinned = (m as THREE.SkinnedMesh).isSkinnedMesh;
    if (skinned || look.accessories.includes(m.name)) meshes.push(m);
  });
  if (meshes.length === 0) throw new Error(`Look has no meshes: ${look.model}`);

  // Merged static geometry (uv + index); positions come from the texture.
  const parts = meshes.map((m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", m.geometry.getAttribute("position").clone());
    g.setAttribute("normal", m.geometry.getAttribute("normal").clone());
    g.setAttribute("uv", m.geometry.getAttribute("uv").clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    return g;
  });
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error(`Cannot merge look geometry: ${look.model}`);
  const vertexCount = geometry.getAttribute("position").count;
  const ids = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) ids[i] = i;
  geometry.setAttribute("vid", new THREE.BufferAttribute(ids, 1));

  // Plan the frames.
  const mixer = new THREE.AnimationMixer(root);
  const clips = {} as Record<AgentAnim, ClipInfo>;
  const plan: { key: AgentAnim; clip: THREE.AnimationClip; info: ClipInfo }[] = [];
  let total = 0;
  for (const [key, name] of Object.entries(def.clips) as [AgentAnim, string][]) {
    const clip = THREE.AnimationClip.findByName(model.animations, name) ?? THREE.AnimationClip.findByName(model.animations, def.clips.idle);
    if (!clip) throw new Error(`Missing clip "${name}" in ${look.model}`);
    const frames = Math.max(6, Math.min(def.maxFrames, Math.round(clip.duration * def.sampleRate)));
    const info = { start: total, frames, duration: clip.duration };
    clips[key] = info;
    plan.push({ key, clip, info });
    total += frames;
  }

  const height = Math.ceil((total * vertexCount) / VAT_WIDTH);
  const raw = new Float32Array(VAT_WIDTH * height * 4);
  const v = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { clip, info } of plan) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.play();
    for (let f = 0; f < info.frames; f++) {
      mixer.setTime((f / info.frames) * clip.duration);
      root.updateMatrixWorld(true);
      let offset = ((info.start + f) * vertexCount) * 4;
      for (const m of meshes) {
        const sk = m as THREE.SkinnedMesh;
        if (sk.isSkinnedMesh) sk.skeleton.update();
        const count = m.geometry.getAttribute("position").count;
        for (let i = 0; i < count; i++) {
          m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
          raw[offset] = v.x;
          raw[offset + 1] = v.y;
          raw[offset + 2] = v.z;
          offset += 4;
          if (info.start === 0 && f === 0) {
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
          }
        }
      }
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);

  // Normalize to the crowd's reference height and pack as half floats.
  const scale = def.height / Math.max(0.1, maxY - minY);
  const data = new Uint16Array(raw.length);
  for (let i = 0; i < raw.length; i++) data[i] = THREE.DataUtils.toHalfFloat((raw[i] as number) * scale);
  const texture = new THREE.DataTexture(data, VAT_WIDTH, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  // Bounds for the rest pose are meaningless once animated; culling is disabled on the mesh.
  const map = ((meshes[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).map ?? null;
  return { geometry, texture, vertexCount, clips, map };
}

const VAT_PARS = /* glsl */ `
attribute float vid;
attribute vec3 aAnim; // x: first frame of the clip, y: frame count, z: phase 0..1
uniform highp sampler2D uVat;
uniform float uVerts;
vec3 vatFetch(float frame) {
  float idx = frame * uVerts + vid;
  float y = floor(idx / ${VAT_WIDTH}.0);
  return texelFetch(uVat, ivec2(int(idx - y * ${VAT_WIDTH}.0), int(y)), 0).xyz;
}`;

const VAT_BEGIN = /* glsl */ `
float vatF = aAnim.z * aAnim.y;
float vatF0 = floor(vatF);
float vatF1 = mod(vatF0 + 1.0, aAnim.y);
vec3 transformed = mix(vatFetch(aAnim.x + vatF0), vatFetch(aAnim.x + vatF1), vatF - vatF0);`;

function patchVat(material: THREE.Material, baked: BakedLook, key: string): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVat = { value: baked.texture };
    shader.uniforms.uVerts = { value: baked.vertexCount };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VAT_PARS}`)
      .replace("#include <begin_vertex>", VAT_BEGIN);
  };
  material.customProgramCacheKey = () => key;
}

interface LookBatch {
  mesh: THREE.InstancedMesh;
  anim: THREE.InstancedBufferAttribute;
  clips: Record<AgentAnim, ClipInfo>;
  agents: Agent[];
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Renders every inhabitant with instanced vertex-animation-texture meshes. */
export class Crowd {
  readonly group = new THREE.Group();
  private readonly batches: LookBatch[] = [];
  private readonly phase: Float32Array;
  private readonly lastAnim: (AgentAnim | null)[];
  private readonly facing: Float32Array;
  /** Interpolated render positions (x, z per agent), reused by the UI. */
  readonly positions: Float32Array;

  private constructor(agentCount: number) {
    this.phase = new Float32Array(agentCount);
    this.facing = new Float32Array(agentCount);
    this.positions = new Float32Array(agentCount * 2);
    this.lastAnim = new Array(agentCount).fill(null);
    this.group.name = "crowd";
  }

  static async create(
    lib: AssetLibrary,
    assetsBase: string,
    looks: Record<string, LookDef>,
    def: CrowdDef,
    agents: readonly Agent[],
    castShadows: boolean,
  ): Promise<Crowd> {
    const crowd = new Crowd(agents.length);
    const byLook = new Map<string, Agent[]>();
    for (const a of agents) {
      const list = byLook.get(a.look);
      if (list) list.push(a);
      else byLook.set(a.look, [a]);
      crowd.phase[a.index] = (a.index * 0.618) % 1;
      crowd.facing[a.index] = a.facing;
    }
    for (const [lookId, list] of byLook) {
      const look = looks[lookId];
      if (!look) throw new Error(`Unknown look "${lookId}"`);
      const model = await lib.load(`${assetsBase}${look.model}.glb`);
      const baked = bakeLook(model, look, def);
      const material = new THREE.MeshStandardMaterial({ map: baked.map, flatShading: true, roughness: 0.85, metalness: 0 });
      patchVat(material, baked, "chronos-crowd");
      const mesh = new THREE.InstancedMesh(baked.geometry, material, list.length);
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      anim.setUsage(THREE.DynamicDrawUsage);
      baked.geometry.setAttribute("aAnim", anim);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = castShadows;
      mesh.receiveShadow = true;
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      patchVat(depth, baked, "chronos-crowd-depth");
      mesh.customDepthMaterial = depth;
      mesh.name = `crowd:${lookId}`;
      list.forEach((a, i) => mesh.setColorAt(i, tmpC.set(a.tint)));
      crowd.batches.push({ mesh, anim, clips: baked.clips, agents: list });
      crowd.group.add(mesh);
    }
    return crowd;
  }

  setShadows(enabled: boolean): void {
    for (const b of this.batches) b.mesh.castShadow = enabled;
  }

  /**
   * @param dt     frame time scaled by the world's time scale (animation speed)
   * @param alpha  interpolation factor between the last two simulation ticks
   */
  update(dt: number, alpha: number): void {
    for (const b of this.batches) {
      let n = 0;
      for (const a of b.agents) {
        if (a.insideOf) continue;
        const i = a.index;
        const x = a.prevX + (a.x - a.prevX) * alpha;
        const z = a.prevZ + (a.z - a.prevZ) * alpha;
        this.positions[i * 2] = x;
        this.positions[i * 2 + 1] = z;

        // Smooth the 10 Hz facing at render rate.
        let d = (a.facing - (this.facing[i] as number)) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        this.facing[i] = (this.facing[i] as number) + d * Math.min(1, dt * 10 + 0.02);

        const clip = b.clips[a.anim];
        if (this.lastAnim[i] !== a.anim) {
          this.lastAnim[i] = a.anim;
          if (a.anim !== "walk" && a.anim !== "idle") this.phase[i] = 0;
        }
        // Walk cycles follow the actual stride (speed and body size).
        const rate = a.anim === "walk" ? a.walkSpeed / (1.5 * a.scale) : 1;
        this.phase[i] = ((this.phase[i] as number) + (dt * rate) / clip.duration) % 1;

        tmpP.set(x, 0, z);
        tmpQ.setFromAxisAngle(UP, this.facing[i] as number);
        tmpS.setScalar(a.scale);
        b.mesh.setMatrixAt(n, tmpM.compose(tmpP, tmpQ, tmpS));
        b.mesh.setColorAt(n, tmpC.set(a.tint));
        b.anim.setXYZ(n, clip.start, clip.frames, this.phase[i] as number);
        n++;
      }
      b.mesh.count = n;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.anim.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }
  }
}
