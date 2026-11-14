import * as THREE from "three";

/**
 * Wind-blown grass around the player (high quality preset).
 * A fixed field of blades wraps around the camera's position so blades stay
 * anchored in the world; density and color come from the terrain grass map.
 * Blades are a GPU effect (like particles), not authored models.
 */
export class GrassField {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uWind: { value: 0.35 },
  };

  constructor(grassMap: THREE.DataTexture, mapExtent: number, count = 60000, patch = 56) {
    // One blade: a tapered strip of 3 segments (7 vertices), bent in the shader.
    const blade = new THREE.BufferGeometry();
    const w = 0.032;
    const verts = [-w, 0, 0, w, 0, 0, -w * 0.75, 0.33, 0, w * 0.75, 0.33, 0, -w * 0.45, 0.66, 0, w * 0.45, 0.66, 0, 0, 1, 0];
    blade.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    blade.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(21).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));

    const geo = new THREE.InstancedBufferGeometry();
    geo.index = blade.index;
    geo.setAttribute("position", blade.getAttribute("position"));
    geo.setAttribute("normal", blade.getAttribute("normal"));
    const data = new Float32Array(count * 4);
    let seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      data[i * 4] = rnd() * patch;
      data[i * 4 + 1] = rnd() * patch;
      data[i * 4 + 2] = 0.5 + rnd() * rnd() * 1.1; // height scale (mostly short, a few tall)
      data[i * 4 + 3] = rnd() * Math.PI * 2; // yaw
    }
    geo.setAttribute("blade", new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = count;

    const material = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, {
        uGrassMap: { value: grassMap },
        uExtent: { value: mapExtent },
        uPatch: { value: patch },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
attribute vec4 blade;
uniform vec2 uCenter;
uniform float uTime;
uniform float uWind;
uniform sampler2D uGrassMap;
uniform float uExtent;
uniform float uPatch;
varying vec3 vGrassColor;
varying float vGrassH;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif`,
        )
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `
  // Wrap the patch around the center so blades keep their gWorld position.
  vec2 gOrigin = uCenter - vec2(uPatch * 0.5);
  vec2 gWorld = gOrigin + mod(blade.xy - gOrigin, vec2(uPatch));
  vec2 gUv = gWorld / uExtent + 0.5;
  vec4 gMap = texture2D(uGrassMap, gUv);
  float gEdge = smoothstep(uPatch * 0.5, uPatch * 0.36, length(gWorld - uCenter));
  float gH = blade.z * gMap.a * gEdge * step(0.0, gUv.x) * step(gUv.x, 1.0) * step(0.0, gUv.y) * step(gUv.y, 1.0);
  vGrassColor = gMap.rgb;
  vGrassH = position.y;
  float gCos = cos(blade.w), gSin = sin(blade.w);
  vec3 gP = vec3(position.x * gCos, position.y * gH * 0.7, position.x * gSin);
  // Wind: slow gGusts + fast flutter, stronger at the tip.
  float gGust = sin(uTime * 1.3 + gWorld.x * 0.18 + gWorld.y * 0.11) * 0.5 + 0.5;
  float gBend = (gGust * uWind + sin(uTime * 4.0 + blade.w * 10.0) * 0.05) * position.y * position.y;
  gP.x += gBend * 0.6;
  gP.z += gBend * 0.25;
  // Blades with no grass under them collapse entirely and sink below the ground.
  float gAlive = step(0.03, gH);
  vec3 transformed = vec3(gWorld.x, gAlive - 1.0, gWorld.y) + gP * gAlive;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vGrassColor;\nvarying float vGrassH;`)
        .replace(
          "#include <normal_fragment_begin>",
          // Both faces of a blade are lit like the ground beneath (soft, no black backsides).
          `#include <normal_fragment_begin>\n  normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n  diffuseColor.rgb = vGrassColor * mix(0.62, 1.2, vGrassH);`,
        );
    };
    material.customProgramCacheKey = () => "chronos-grass";
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = "grass";
  }

  update(dt: number, center: THREE.Vector3): void {
    this.uniforms.uTime.value += dt;
    this.uniforms.uCenter.value.set(center.x, center.z);
  }
}
