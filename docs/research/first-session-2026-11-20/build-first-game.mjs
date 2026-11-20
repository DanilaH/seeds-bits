import { build } from "vite";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const target = path.resolve(process.argv[2] || "test-results/first-game.html");
const sandbox = await mkdtemp(path.join(tmpdir(), "seeds-first-game-"));
try {
  for (const item of ["src", "fixtures", "index.html", "package.json"])
    await cp(path.join(root, item), path.join(sandbox, item), { recursive: true });
  await symlink(path.join(root, "node_modules"), path.join(sandbox, "node_modules"));
  execFileSync("git", ["apply", path.join(path.dirname(fileURLToPath(import.meta.url)), "first-game.patch")], {cwd: sandbox});
  // Isolate research saves and turn workers into self-contained blobs for file://.
  for (const name of ["main", "advice-client", "help-client", "shuffle-lab-client"]) {
    const file = path.join(sandbox, "src", name + ".ts");
    let source = await readFile(file, "utf8");
    if (name === "main") source = source.replaceAll('"seeds-bits.', '"seeds-research.first-game.');
    else {
      const worker = name.replace("-client", "-worker");
      const expression = /new Worker\(new URL\("[^"]+-worker\.ts",\s*import\.meta\.url\),\s*\{\s*type:\s*"module",?\s*\}\)/;
      if (!expression.test(source)) throw Error("Worker entry changed: " + name);
      source = 'import InlineWorker from "./' + worker + '.ts?worker&inline";\n' +
        source.replace(expression, "new InlineWorker()");
    }
    await writeFile(file, source);
  }
  const bundle = await build({root:sandbox, configFile:false, base:"./", logLevel:"warn",
    build:{target:"es2022", write:false, cssCodeSplit:false, modulePreload:false,
      rolldownOptions:{output:{codeSplitting:false}}}});
  const outputs = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(result => result.output);
  const js = outputs.filter(x => x.type === "chunk");
  const css = outputs.find(x => x.fileName.endsWith(".css"));
  if (js.length !== 1 || !css) throw Error("Expected one self-contained JS/CSS pair");
  const html = (await readFile(path.join(sandbox,"index.html"),"utf8"))
    .replace("</head>", () => "<style>" + css.source + "</style></head>")
    .replace('<script type="module" src="/src/main.ts"></script>', () =>
      '<script type="module">' + js[0].code.replace(/<\/script/gi,"<\\/script") + "</script>");
  await mkdir(path.dirname(target), {recursive:true});
  await writeFile(target, html);
  console.log(target);
} finally {
  await rm(sandbox, {recursive:true,force:true});
}
