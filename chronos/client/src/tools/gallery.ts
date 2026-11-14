// Dev tool: shows every imported model in a grid with its name. /gallery.html?cat=buildings
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ASSET_ROOT, AssetLibrary } from "../render/assets";

const params = new URLSearchParams(location.search);
const cat = params.get("cat") ?? "buildings";
const filter = params.get("filter");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#cfd9e0");
scene.add(new THREE.HemisphereLight("#ffffff", "#7a6a55", 1.6));
const sun = new THREE.DirectionalLight("#fff2dd", 2.5);
sun.position.set(5, 10, 7);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);

const manifest = await (await fetch(ASSET_ROOT + "kaykit/manifest.json")).json();
let names: string[] = Object.keys(manifest[cat] ?? {});
if (filter) names = names.filter((n) => new RegExp(filter).test(n));
const lib = new AssetLibrary();
const cols = Math.ceil(Math.sqrt(names.length * 1.6));
const cell = 2.4;
const labels: { el: HTMLSpanElement; pos: THREE.Vector3 }[] = [];
await Promise.all(
  names.map(async (name, i) => {
    const m = await lib.load(`kaykit/${cat}/${name}.glb`);
    const o = AssetLibrary.instantiate(m);
    const size = m.box.getSize(new THREE.Vector3());
    const s = 1.8 / Math.max(size.x, size.y, size.z);
    o.scale.setScalar(s);
    const x = (i % cols) * cell;
    const z = Math.floor(i / cols) * cell;
    o.position.set(x, -m.box.min.y * s, z);
    scene.add(o);
    const el = document.createElement("span");
    el.textContent = `${name} (${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)})`;
    document.getElementById("labels")!.appendChild(el);
    labels.push({ el, pos: new THREE.Vector3(x, -0.15, z + 0.9) });
  }),
);
const rows = Math.ceil(names.length / cols);
const cx = ((cols - 1) * cell) / 2;
const cz = ((rows - 1) * cell) / 2;
controls.target.set(cx, 0, cz);
camera.position.set(cx, Math.max(cols, rows) * cell * 0.95, cz + Math.max(cols, rows) * cell * 0.75);
document.getElementById("bar")!.textContent = `${cat}: ${names.length} modèles`;
const v = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  for (const l of labels) {
    v.copy(l.pos).project(camera);
    l.el.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
    l.el.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
  }
});
(window as unknown as { __galleryReady: boolean }).__galleryReady = true;
