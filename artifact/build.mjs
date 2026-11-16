// Construit la version « artefact » du Dashboard : une seule page HTML autonome (artifact/dashboard.html).
// Usage : node artifact/build.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Icônes Lucide utilisées, extraites du paquet installé (tracés SVG seulement).
const ICONS = [
  "mail", "brain", "trophy", "goal", "tv", "newspaper", "sparkles", "lightbulb", "graduation-cap", "folder-kanban",
  "calendar-days", "book-open", "scroll-text", "scale", "library", "circle-play", "clapperboard", "music", "monitor-play",
  "wallet", "cloud-sun", "ellipsis", "settings", "palette", "search", "x", "maximize-2", "info", "refresh-cw",
  "external-link", "lock", "droplets", "wind", "sunrise", "sunset", "star", "eye", "eye-off", "check",
  "plus", "trash-2", "chevron-left", "chevron-right", "upload", "triangle-alert", "maximize", "minimize", "house", "arrow-right", "pencil", "circle-check", "flame",
];
const icons = {};
const iconsDir = join(root, "node_modules/lucide-react/dist/esm/icons");
function readIcon(name, depth = 0) {
  const src = readFileSync(join(iconsDir, `${name}.mjs`), "utf8");
  const match = src.match(/const __iconData = (\{[\s\S]*?\n\});/);
  if (match) return new Function(`return ${match[1]}`)().node;
  // Certains fichiers ne sont que des alias vers une autre icône.
  const alias = src.match(/from '\.\/([\w-]+)\.mjs'/);
  if (alias && depth < 3) return readIcon(alias[1], depth + 1);
  throw new Error(`Icône introuvable : ${name}`);
}
for (const name of ICONS) {
  icons[name] = readIcon(name).map(([tag, attrs]) => {
    const rest = { ...attrs };
    delete rest.key;
    return [tag, rest];
  });
}

const result = await build({
  entryPoints: [join(here, "src/app.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
  define: { __ICONS__: JSON.stringify(icons) },
  alias: { "@": join(root, "src"), "server-only": join(here, "src/empty.ts") },
  tsconfig: join(root, "tsconfig.json"),
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// Les polices passent par Google Fonts (seul hébergeur autorisé dans un artefact).
const tokens = readFileSync(join(root, "src/styles/tokens.css"), "utf8").replace(/\[data-theme=/g, "[data-dash=").replace(/var\(--font-space-grotesk\)/g, '"Space Grotesk"').replace(/var\(--font-inter\)/g, '"Inter"');
const css = readFileSync(join(here, "styles.css"), "utf8");

const html = `<title>Dashboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@500;700&family=Inter:wght@400;500;600&family=Manrope:wght@400;500;700&family=Patrick+Hand&family=Space+Grotesk:wght@500;600&family=Space+Mono:wght@400;700&display=swap">
<style>
${tokens}
${css}
</style>
<div id="app"></div>
<script>
${js}
</script>
`;
writeFileSync(join(here, "dashboard.html"), html);
console.log(`artifact/dashboard.html : ${(html.length / 1024).toFixed(0)} Ko`);
