// Build: bundles the React app into one self-contained index.html (like the PAT kiosk),
// then writes the manifest, icons and an offline service worker into dist/.
// Usage: node build.mjs        (needs: npm install)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
mkdirSync(join(out, "icons"), { recursive: true });

const res = await build({
  entryPoints: [join(root, "src/main.jsx")],
  bundle: true, minify: true, format: "iife", write: false, jsx: "automatic",
  target: ["safari15", "chrome100"], define: { "process.env.NODE_ENV": '"production"' }, legalComments: "none",
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(":") : [],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(root, "src/styles.css"), "utf8") + "\n" + readFileSync(join(root, "src/mission/mission.css"), "utf8") + "\n" + readFileSync(join(root, "src/spell/spell.css"), "utf8");
const html = readFileSync(join(root, "public/index.template.html"), "utf8").replace("/*CSS*/", () => css).replace("/*JS*/", () => js);
writeFileSync(join(out, "index.html"), html);
cpSync(join(root, "public/manifest.webmanifest"), join(out, "manifest.webmanifest"));
cpSync(join(root, "public/icons"), join(out, "icons"), { recursive: true });

const files = ["./", "./index.html", "./manifest.webmanifest", ...readdirSync(join(out, "icons")).map((f) => `./icons/${f}`)];
const hash = createHash("sha256").update(html).digest("hex").slice(0, 10);
writeFileSync(join(out, "sw.js"), readFileSync(join(root, "public/sw.template.js"), "utf8").replace("__HASH__", hash).replace("__FILES__", JSON.stringify(files, null, 1)));
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB, cache ${hash}`);
