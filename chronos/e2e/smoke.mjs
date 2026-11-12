// Smoke test for the playable demo: builds nothing, expects `npm run build` first.
// Starts `vite preview`, opens the game in headless Chromium, plays a few seconds,
// checks for console errors and takes screenshots into e2e/output/.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = Number(process.env.PORT ?? 4173);
const QUALITY = process.env.QUALITY ?? "high";
const BASE_URL = `http://localhost:${PORT}/?quality=${QUALITY}`;
const OUT = new URL("./output/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = process.env.NO_SERVER ? null : spawn("npm", ["run", "preview", "-w", "client"], { stdio: ["ignore", "pipe", "pipe"] });
const stop = () => server?.kill("SIGTERM");
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE_URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview server did not start");
}

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failures.push(msg);
};

try {
  await waitForServer();
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE_URL);
  await page.waitForFunction(() => !!window.__chronos, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__chronos.ready, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "01-title.png" });
  const placeholders = await page.evaluate(() => window.__chronos.placeholders);
  check(placeholders.length === 0, `all glTF models loaded${placeholders.length ? " (missing: " + placeholders.join(", ") + ")" : ""}`);
  check(await page.evaluate(() => window.__chronos.animated), "Kael is the animated glTF character");

  await page.evaluate(() => window.__chronos.start());
  const p0 = await page.evaluate(() => window.__chronos.player);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForTimeout(1000);
  const running = await page.evaluate(() => window.__chronos.player.state);
  await page.waitForTimeout(1000);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  const p1 = await page.evaluate(() => window.__chronos.player);
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  // Headless software WebGL runs at a few fps, and the fixed-step loop caps catch-up
  // per frame, so distance is lower than on a real GPU; we only check the controls work.
  check(moved > 1 && p1.z < p0.z, `player moved ${moved.toFixed(1)} m north with W+Shift`);
  check(running === "run", `player state while holding Shift: "${running}"`);

  // Scenic shots at several times of day.
  const shots = [
    ["02-morning-market", 9, [2, 14], [0.35, 0.3, 8]],
    ["03-noon-temple", 12.5, [-14, -30], [0, 0.22, 9]],
    ["04-dusk-tavern", 17.9, [4, -2], [-0.69, 0.2, 8]],
    ["05-night-lowtown", 23, [0, 56], [0, 0.25, 7]],
    ["06-north-gate", 10, [0, -58], [0, 0.18, 6]],
    ["07-overview", 15, [0, 20], [0.5, 0.7, 10]],
  ];
  for (const [name, hour, [x, z], [yaw, pitch, dist]] of shots) {
    await page.evaluate(
      ([h, x, z, yaw, pitch, dist]) => {
        const c = window.__chronos;
        c.setHour(h);
        c.teleport(x, z, yaw + Math.PI);
        c.setCamera(yaw, pitch, dist);
      },
      [hour, x, z, yaw, pitch, dist],
    );
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}${QUALITY}-${name}.png` });
  }

  const clock = await page.evaluate(() => window.__chronos.clock);
  check(clock.phase === "day", `clock phase at 15:00 is "${clock.phase}"`);
  const info = await page.evaluate(() => window.__chronos.renderInfo());
  check(info.calls > 0 && info.calls < 400, `draw calls per frame: ${info.calls}`);
  console.log(`  triangles: ${info.triangles}, headless fps: ${info.fps.toFixed(1)}`);
  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);

  await browser.close();
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  stop();
}
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nSmoke test passed. Screenshots in ${OUT}`);
process.exit(0);
