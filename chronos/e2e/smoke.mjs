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
  // Without a proxy, the browser itself logs the failed /api requests: expected in "local" mode.
  const expectedNoise = (t) => process.env.EXPECT_AI === "local" && /Failed to load resource/.test(t);
  page.on("console", (m) => m.type() === "error" && !expectedNoise(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE_URL);
  await page.waitForFunction(() => !!window.__chronos, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__chronos.ready, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "01-title.png" });
  const placeholders = await page.evaluate(() => window.__chronos.placeholders);
  check(placeholders.length === 0, `all glTF models loaded${placeholders.length ? " (missing: " + placeholders.join(", ") + ")" : ""}`);
  check(await page.evaluate(() => window.__chronos.animated), "Kael is the animated glTF character");
  const pop = await page.evaluate(() => window.__chronos.agents);
  check(pop.total >= 100 && pop.rendered, `${pop.total} inhabitants simulated and rendered (${pop.outside} outside, ${pop.inside} indoors)`);

  await page.evaluate(() => window.__chronos.start());
  const p0 = await page.evaluate(() => window.__chronos.player);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  // Poll: software-rendered headless Chromium runs at a few fps.
  let running = "";
  for (let i = 0; i < 40 && running !== "run"; i++) {
    await page.waitForTimeout(250);
    running = await page.evaluate(() => window.__chronos.player.state);
  }
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  const p1 = await page.evaluate(() => window.__chronos.player);
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  // Headless software WebGL runs at a few fps, and the fixed-step loop caps catch-up
  // per frame, so distance is lower than on a real GPU; we only check the controls work.
  check(moved > 0.3 && p1.z < p0.z, `player moved ${moved.toFixed(1)} m north with W+Shift`);
  check(running === "run", `player state while holding Shift: "${running}"`);

  // Scenic shots at several times of day.
  const shots = [
    ["02-morning-market", 10, [2, 15], [0.2, 0.32, 9]],
    ["08-forge", 9, [36, -1], [3.5, 0.25, 7]],
    ["09-tavern-evening", 19, [10, 2], [-0.3, 0.25, 9]],
    ["03-noon-temple", 12.5, [-14, -30], [0, 0.22, 9]],
    ["04-dusk-tavern", 17.9, [4, -2], [-0.69, 0.2, 8]],
    ["05-night-lowtown", 23, [0, 56], [0, 0.25, 7]],
    ["06-north-gate", 10, [0, -58], [0, 0.18, 6]],
    ["07-overview", 15, [0, 20], [0.5, 0.7, 10]],
  ];
  const only = process.env.SHOTS?.split(",");
  for (const [name, hour, [x, z], [yaw, pitch, dist]] of shots) {
    if (only && !only.some((o) => name.includes(o))) continue;
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

  // Nameplate: stand next to the blacksmith at work.
  await page.evaluate(() => {
    const c = window.__chronos;
    c.setHour(9);
    const b = c.agent("brann");
    c.teleport(b.x + 0.7, b.z, 0);
  });
  await page.waitForTimeout(1500);
  const plate = await page.evaluate(() => document.getElementById("nameplate")?.textContent ?? "");
  check(/ · /.test(plate), `nameplate shown next to an inhabitant: "${plate}"`);
  // J3: a public crime → witnesses, reactions, reputations, journal.
  await page.evaluate(() => {
    const c = window.__chronos;
    c.setHour(10.5);
    const a = c.agent("aldric");
    c.teleport(a.x + 1.3, a.z + 0.6, 0);
    c.setCamera(0.9, 0.42, 9);
  });
  await page.waitForTimeout(1500);
  await page.keyboard.press("KeyJ");
  await page.evaluate(() => window.__chronos.act("assault", "aldric"));
  await page.waitForTimeout(2500);
  const soc = await page.evaluate(() => window.__chronos.social);
  check(soc.events === 1 && soc.informed[0] > 3, `assault seen by ${soc.informed[0]} people`);
  check(soc.reputation.villagers < 0 && soc.reputation.royal_guard <= 0, `reputations moved: ${JSON.stringify(soc.reputation)}`);
  check(soc.emotes > 0, `${soc.emotes} inhabitants show a reaction`);
  await page.waitForFunction(() => /as frappé/.test(document.getElementById("journal")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
  const journal = await page.evaluate(() => document.getElementById("journal")?.textContent ?? "");
  if (!/as frappé/.test(journal)) console.log("  journal:", JSON.stringify(journal), await page.evaluate(() => document.getElementById("journal").className));
  check(/Réputations/.test(journal) && /as frappé/.test(journal), "journal lists reputations and what people know");
  await page.screenshot({ path: `${OUT}${QUALITY}-10-assault-witnesses.png` });
  await page.keyboard.press("KeyJ");
  // J4: free-text dialogue with a key character (AI via the proxy when available, local lines otherwise).
  if (process.env.EXPECT_AI) {
    await page.evaluate(() => {
      const c = window.__chronos;
      c.setHour(10);
      const g = c.agent("garn");
      c.teleport(g.x + 1.2, g.z + 0.4, 0);
      c.setCamera(0.6, 0.3, 6);
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__chronos.talk("garn"));
    await page.waitForTimeout(600);
    await page.locator("#dialogue-input").fill("Bonjour Garn ! Que sais-tu de Valdren ?");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__chronos.ai.turns.length >= 2, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    const ai = await page.evaluate(() => window.__chronos.ai);
    const expected = process.env.EXPECT_AI; // "mock", "ai" or "local"
    // A repeated run may be served from the proxy's response cache: that still counts as an AI reply.
    const got = expected === "local" ? ai.stats.localReplies : ai.stats.aiReplies + ai.stats.cachedReplies;
    check(ai.open && ai.turns[1].speaker === "npc" && ai.turns[1].text.length > 3, `Garn answered: "${ai.turns[1].text}"`);
    check(got === 1, `reply source is "${expected}" (stats ${JSON.stringify(ai.stats)})`);
    await page.screenshot({ path: `${OUT}${QUALITY}-11-dialogue-${expected}.png` });
    await page.evaluate(() => window.__chronos.closeDialogue());
  }
  await page.evaluate(() => window.__chronos.setHour(3));
  await page.waitForTimeout(800);
  const night = await page.evaluate(() => window.__chronos.agents);
  check(night.inside > night.total * 0.7, `at 3 am most inhabitants are indoors (${night.inside}/${night.total})`);
  await page.evaluate(() => window.__chronos.setHour(15));
  await page.waitForTimeout(600);
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
