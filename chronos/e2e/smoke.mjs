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
  check(soc.events >= 1 && soc.informed[0] > 3, `assault seen by ${soc.informed[0]} people`);
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
  // J5: powers and visible consequences. (Software rendering is very slow in crowded
  // places, so every step waits for a condition instead of a fixed delay.)
  {
    const shot = (name) => page.screenshot({ path: `${OUT}${QUALITY}-${name}.png` });
    const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 45000, polling: 250 }).then(() => true).catch(() => false);
    const powersState = () => page.evaluate(() => window.__chronos.powers);
    // The forge yard: a few people at work, far from the market crowd.
    await page.evaluate(() => {
      const c = window.__chronos;
      c.setHour(10);
      const b = c.agent("brann");
      c.teleport(b.x - 3, b.z + 0.5, Math.PI / 2);
      c.setCamera(-Math.PI / 2 + 0.5, 0.4, 9);
    });
    await page.waitForTimeout(1500);
    await page.keyboard.press("Digit1");
    check(await until(() => window.__chronos.powers.zones === 1 && window.__chronos.powers.energy < 100), "slow time: bubble active, energy spent");
    await page.waitForTimeout(1500);
    await shot("12-power-time-bubble");
    await page.evaluate(() => window.__chronos.cast("freeze"));
    check(await until(() => window.__chronos.powers.frozen > 0), `freeze: ${(await powersState()).frozen} inhabitants frozen`);
    await page.waitForTimeout(1200);
    await shot("13-power-freeze");

    // Telekinesis: lift a barrel beside the tavern, then throw it.
    await page.evaluate(() => {
      const c = window.__chronos;
      const p = c.powers.props[0];
      c.teleport(p.x + 4, p.z + 1, -Math.PI / 2);
      c.setCamera(Math.PI / 2, 0.3, 7); // camera east of the hero, aiming west at the prop
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__chronos.cast("grab"));
    check(await until(() => window.__chronos.powers.holding === "prop" && window.__chronos.powers.props.some((p) => p.held && p.y > 1)), "telekinesis: an object is lifted and carried");
    await page.waitForTimeout(800);
    await shot("14-power-telekinesis");
    await page.evaluate(() => window.__chronos.cast("grab"));
    check(await until(() => window.__chronos.powers.holding === null && window.__chronos.powers.props.every((p) => !p.held && p.y === 0)), "telekinesis: the object was thrown and landed");

    // Shadow.
    await until(() => window.__chronos.powers.energy >= 30);
    await page.keyboard.press("Digit6");
    check(await until(() => window.__chronos.powers.cloaked), "shadow: the hero is invisible");
    await page.waitForTimeout(1200);
    await shot("15-power-shadow");
    await page.evaluate(() => window.__chronos.cast("cloak"));
    check(await until(() => !window.__chronos.powers.cloaked), "shadow: dropped on demand");

    // Rewind undoes a crime.
    await page.evaluate(() => {
      const c = window.__chronos;
      const b = c.agent("brann");
      c.teleport(b.x - 1.5, b.z, Math.PI / 2);
      c.setCamera(-Math.PI / 2, 0.35, 7);
    });
    await until(() => window.__chronos.powers.energy >= 45);
    await page.waitForTimeout(2500); // let the history buffer fill at this spot
    const eventsBefore = (await page.evaluate(() => window.__chronos.social)).events;
    await page.evaluate(() => window.__chronos.act("assault", "brann"));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__chronos.cast("rewind"));
    const feed = (await page.evaluate(() => window.__chronos.social)).feed;
    check(feed.some((t) => /n'a jamais eu lieu/.test(t)), `rewind: the assault is erased from the world (events ${eventsBefore} → log keeps it as undone)`);

    // Branches unlock from deeds.
    await page.evaluate(() => window.__chronos.setMoral(3, 3));
    check(
      await until(() => ["time_loop", "guardian_stasis", "crush", "helping_hand", "watcher", "light_fingers"].every((id) => window.__chronos.powers.unlocked.includes(id))),
      "hero and dark branches unlock from the player's deeds",
    );

    // Consequences: a hated player is hunted by the guard, caught and jailed until dawn.
    await page.evaluate(() => {
      const c = window.__chronos;
      c.setHour(10);
      c.setReputation("royal_guard", -45);
      for (let i = 1; i < 8; i++) {
        const g = c.agent("guard_day_" + i);
        if (g && !g.insideOf) {
          c.teleport(g.x + 9, g.z, 0);
          c.setCamera(Math.PI / 2, 0.35, 9);
          break;
        }
      }
    });
    check(await until(() => window.__chronos.consequences.wanted === 1 && /RECHERCHÉ/.test(document.getElementById("hud-wanted")?.textContent ?? "")), "wanted by the guard, shown on the HUD");
    await page.waitForTimeout(1000);
    await shot("16-consequence-wanted");
    const arrested = await until(() => window.__chronos.social.feed.some((t) => /Arrêté/.test(t)));
    const after = await page.evaluate(() => ({ clock: window.__chronos.clock, coins: window.__chronos.social.coins, cq: window.__chronos.consequences }));
    check(arrested && after.coins === 0 && after.clock.hour === 6 && after.cq.wanted === 0, `arrested: purse emptied, released at ${after.clock.hour}:00, no longer wanted`);
    await page.evaluate(() => window.__chronos.setReputation("royal_guard", 0));
  }
  // J6: echo of the past and false face, both wired to the event log and the rumors.
  {
    const shot = (name) => page.screenshot({ path: `${OUT}${QUALITY}-${name}.png` });
    const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 45000, polling: 250 }).then(() => true).catch(() => false);
    await page.evaluate(() => {
      const c = window.__chronos;
      c.setHour(10);
      const b = c.agent("brann");
      c.teleport(b.x - 1.5, b.z, Math.PI / 2);
      c.setCamera(-Math.PI / 2 + 0.4, 0.4, 8);
    });
    await page.evaluate(() => window.__chronos.act("pickpocket", "brann"));
    await until(() => window.__chronos.powers.energy >= 30);
    await page.keyboard.press("Digit8");
    const echoOk = await until(() => window.__chronos.powers.echo.length > 0 && document.getElementById("echo")?.classList.contains("visible"));
    const echo = (await page.evaluate(() => window.__chronos.powers)).echo;
    const panel = await page.evaluate(() => document.getElementById("echo")?.textContent ?? "");
    check(echoOk && echo.some((v) => v.act === "pickpocket" && v.actorId === "player") && /Kael a volé/.test(panel), `echo: ${echo.length} scene(s) read from the log, the theft is shown with its true author`);
    await page.waitForTimeout(1500);
    await shot("17-power-echo");

    // False face: study Brann from close by, step behind him, take his face.
    check(await until(() => (window.__chronos.powers.studied.brann ?? 0) >= 3), "false face: a face is learnt by staying close");
    await until(() => window.__chronos.powers.energy >= 35);
    await page.evaluate(() => {
      const c = window.__chronos;
      const b = c.agent("brann");
      c.teleport(b.x - Math.sin(b.facing) * 6, b.z - Math.cos(b.facing) * 6, b.facing);
      c.setCamera(Math.atan2(-Math.sin(b.facing), -Math.cos(b.facing)), 0.35, 6);
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__chronos.cast("disguise"));
    const worn = await until(() => window.__chronos.powers.disguise === "brann" && /Visage : Brann/.test(document.getElementById("hud-disguise")?.textContent ?? ""));
    check(worn, "false face: the hero wears Brann's face, shown on the HUD");
    // Far from Brann, commit two crimes: the witnesses blame Brann, and the guard takes him.
    const victim = await page.evaluate(() => {
      const c = window.__chronos;
      const b = c.agent("brann");
      const v = c.outdoors().find((a) => !a.key && a.faction === "villagers" && Math.hypot(a.x - b.x, a.z - b.z) > 35);
      if (v) {
        c.teleport(v.x + 1.4, v.z, -Math.PI / 2);
        c.setCamera(Math.PI / 2, 0.35, 6);
      }
      return v?.id ?? null;
    });
    await page.waitForTimeout(1500);
    await shot("18-power-false-face");
    const repBefore = (await page.evaluate(() => window.__chronos.social)).reputation;
    await page.evaluate((id) => window.__chronos.act("assault", id), victim);
    await page.evaluate((id) => window.__chronos.act("assault", id), victim);
    const framed = await until(() => window.__chronos.powers.jailed.includes("brann") && window.__chronos.social.feed.some((t) => /arrêté à ta place/.test(t)));
    const repAfter = (await page.evaluate(() => window.__chronos.social)).reputation;
    check(framed, "false face: the crimes are pinned on Brann, who is arrested in the hero's place");
    check(repAfter.villagers >= repBefore.villagers - 0.01, `false face: the hero's own reputation is untouched (villagers ${repBefore.villagers.toFixed(1)} → ${repAfter.villagers.toFixed(1)})`);
    await page.evaluate(() => window.__chronos.cast("disguise"));
    check(await until(() => window.__chronos.powers.disguise === null), "false face: dropped on demand");
  }
  // J7: three generated missions, validated by the game, played to the end.
  {
    const shot = (name) => page.screenshot({ path: `${OUT}${QUALITY}-${name}.png` });
    const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 60000, polling: 250 }).then(() => true).catch(() => false);
    const state = () => page.evaluate(() => window.__chronos.missions);
    const mission = async (title) => (await state()).list.find((m) => m.title === title);
    const offerFrom = async (giverId) => {
      await page.evaluate((id) => {
        const c = window.__chronos;
        const g = c.agent(id);
        c.teleport(g.x + 1.6, g.z, -Math.PI / 2);
        c.setCamera(Math.PI / 2 + 0.5, 0.35, 7);
      }, giverId);
      await page.evaluate((id) => window.__chronos.requestMission(id), giverId);
      await until(() => window.__chronos.missions.offer !== null);
      return (await state()).offer;
    };
    const gotoObjective = (title) =>
      page.evaluate((t) => {
        const c = window.__chronos;
        const o = c.missions.list.find((m) => m.title === t).objective;
        c.teleport(o.x, o.z + 1, Math.PI);
      }, title);
    /** Ends a mission the way its proposal says: talk to someone, or do something to someone. */
    const conclude = async (title, which) => {
      const o = (await mission(title)).proposal[which];
      if (o.type === "talk") {
        await page.evaluate((id) => window.__chronos.talk(id), o.targetId);
        await page.evaluate(() => window.__chronos.closeDialogue());
      } else await page.evaluate(([act, id]) => window.__chronos.act(act, id), [o.actId, o.targetId]);
      return until((t) => window.__chronos.missions.list.find((m) => m.title === t)?.status === "done", title);
    };
    await page.evaluate(() => window.__chronos.setHour(10));
    const coins0 = (await page.evaluate(() => window.__chronos.social)).coins;

    // 1. Investigation.
    const o1 = await offerFrom("hadrien");
    check(!!o1 && o1.proposal.intent === "investigate", `mission offered by Hadrien: "${o1?.title}" (source: ${o1?.source}, ${o1?.attempts} model call(s), ${o1?.rejections} draft(s) refused by the validator)`);
    await page.waitForTimeout(1200);
    await shot("19-mission-offer");
    await page.keyboard.press("Enter");
    check(await until(() => window.__chronos.missions.list.length === 1 && window.__chronos.missions.marker && document.getElementById("hud-missions")?.children.length === 1), "mission accepted: tracked on the HUD, objective marked in the world");
    for (let i = 0; i < 4; i++) {
      const m = await mission(o1.title);
      const step = m.proposal.steps[m.step];
      if (m.status !== "active" || !step) break;
      if (step.type === "goto" || step.type === "echo") await gotoObjective(o1.title);
      if (step.type === "echo") {
        await until(() => window.__chronos.powers.energy >= 30);
        await page.evaluate(() => window.__chronos.cast("echo"));
      }
      if (step.type === "talk") {
        await page.evaluate((id) => window.__chronos.talk(id), step.targetId);
        await page.evaluate(() => window.__chronos.closeDialogue());
      }
      if (step.type === "act") await page.evaluate(([act, id]) => window.__chronos.act(act, id), [step.actId, step.targetId]);
      await until(([t, n]) => { const x = window.__chronos.missions.list.find((m) => m.title === t); return x.step > n || x.status !== "active"; }, [o1.title, m.step]);
    }
    check((await mission(o1.title)).status === "choice", "investigation: the echo revealed the staged theft, two endings are open");
    await page.waitForTimeout(1500);
    await shot("20-mission-echo-choice");
    check(await conclude(o1.title, "hero"), "investigation finished the heroic way");

    // 2. Protection: scare the aggressor off.
    const o2 = await offerFrom("aveline");
    await page.evaluate(() => window.__chronos.answerOffer(true));
    await page.waitForTimeout(1200);
    await shot("21-mission-protect");
    await page.evaluate((id) => window.__chronos.act("intimidate", id), o2.proposal.culpritId);
    check(await until((t) => window.__chronos.missions.list.find((m) => m.title === t)?.status === "choice", o2.title), `protection: "${o2.title}" — the aggressor was scared off`);
    check(await conclude(o2.title, "dark"), "protection finished the dark way");

    // 3. Infiltration under the Shadow.
    const o3 = await offerFrom("sylve");
    await page.evaluate(() => window.__chronos.answerOffer(true));
    await until(() => window.__chronos.powers.energy >= 40);
    await page.evaluate(() => window.__chronos.cast("cloak"));
    await until(() => window.__chronos.powers.cloaked);
    await gotoObjective(o3.title);
    check(await until((t) => window.__chronos.missions.list.find((m) => m.title === t)?.status === "choice", o3.title), `infiltration: "${o3.title}" — reached unseen`);
    await page.evaluate(() => window.__chronos.cast("cloak"));
    check(await conclude(o3.title, "hero"), "infiltration finished");
    const end = await page.evaluate(() => ({ m: window.__chronos.missions.list, coins: window.__chronos.social.coins }));
    check(end.m.length === 3 && end.m.every((m) => m.status === "done") && end.coins > coins0, `three missions played to the end (${end.m.map((m) => `${m.intent}:${m.outcome}`).join(", ")}), purse ${coins0} → ${end.coins}`);
    await page.waitForTimeout(800);
    await shot("22-missions-done");
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
