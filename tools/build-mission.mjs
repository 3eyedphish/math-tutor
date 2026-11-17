// Builds the stand-alone mission prototype as one HTML page (React loaded from cdnjs).
// Usage: node tools/build-mission.mjs [out.html]     (needs: npm install)
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || join(root, "dist", "mission.html");
// "react" and "react-dom/client" come from the UMD globals on the page.
const globals = {
  name: "globals",
  setup(b) {
    b.onResolve({ filter: /^react(-dom\/client|-dom)?$|^react\/jsx-runtime$/ }, (a) => ({ path: a.path, namespace: "g" }));
    b.onLoad({ filter: /.*/, namespace: "g" }, (a) => ({
      contents: a.path === "react/jsx-runtime"
        ? "const R=window.React;const j=(t,p,k)=>{const{children,...r}=p||{};return k!==undefined&&(r.key=k),Array.isArray(children)?R.createElement(t,r,...children):children!==undefined?R.createElement(t,r,children):R.createElement(t,r)};module.exports={jsx:j,jsxs:j,Fragment:R.Fragment};"
        : a.path.startsWith("react-dom") ? "module.exports=window.ReactDOM;" : "module.exports=window.React;",
      loader: "js",
    }));
  },
};
const res = await build({
  entryPoints: [join(root, "src/mission/proto.jsx")], bundle: true, minify: true, format: "iife", write: false,
  jsx: "automatic", target: ["safari15", "chrome100"], legalComments: "none", plugins: [globals],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(root, "src/styles.css"), "utf8") + "\n" + readFileSync(join(root, "src/mission/mission.css"), "utf8");
const html = `<title>Math Missions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap">
<style>${css}
body { background: #0b1030; color: #eef1ff; }</style>
<div id="root"></div>
<script>document.documentElement.dataset.theme="dark";</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(`${out} ${(html.length / 1024).toFixed(0)} KB`);
