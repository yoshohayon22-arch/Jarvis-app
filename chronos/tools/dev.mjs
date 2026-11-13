// Starts the AI proxy and the game together:  npm run dev:all
// Set ANTHROPIC_API_KEY for real AI dialogue, or CHRONOS_MOCK=1 for the offline stand-in.
import { spawn } from "node:child_process";

const run = (name, args) => {
  const p = spawn("npm", args, { stdio: "inherit", env: process.env });
  p.on("exit", (code) => {
    console.log(`[${name}] arrêté (code ${code})`);
    process.exit(code ?? 0);
  });
  return p;
};
const procs = [run("proxy", ["run", "start", "-w", "server"]), run("jeu", ["run", "dev", "-w", "client"])];
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => procs.forEach((p) => p.kill(sig)));
