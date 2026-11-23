// Research loader: immutable git objects only, never working-tree TypeScript.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const packageManifest = JSON.parse(readFileSync(path.join(packageRoot, 'MANIFEST.json'), 'utf8'));
const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const match = /^(--repo|--output)(?:=(.*))?$/.exec(args[i]);
  if (!match) throw new Error(`Unknown argument: ${args[i]}. Use --repo PATH and --output PATH.`);
  const value = match[2] ?? args[++i];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${match[1]}`);
  options[match[1].slice(2)] = value;
}
const checkout = path.resolve(options.repo ?? process.env.SEEDS_AUDIT_REPO ?? process.cwd());
export const outputRoot = path.resolve(options.output ?? process.env.SEEDS_AUDIT_OUTPUT ??
  path.join(checkout, 'test-results/seeds-generator-audit/followup-12082'));
export function writeResult(name, value) {
  mkdirSync(outputRoot, {recursive: true});
  writeFileSync(path.join(outputRoot, name), JSON.stringify(value, null, 2) + '\n');
}

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function loadPinned(pin) {
  const source = new Map(), files = [];
  for (const expected of pin.files) {
    let bytes;
    try {
      bytes = execFileSync('git', ['-C', checkout, 'show', `${pin.ref}:${expected.path}`],
        {maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
    } catch (error) {
      throw new Error(`Cannot read ${pin.repo}@${pin.ref}:${expected.path}. ` +
        'Use a git checkout containing both pinned commits; set --repo or SEEDS_AUDIT_REPO.', {cause: error});
    }
    const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (gitBlob !== expected.gitBlob || sha256 !== expected.sha256)
      throw new Error(`Pinned source mismatch at ${pin.ref}:${expected.path}; got blob ${gitBlob}`);
    files.push({path: expected.path, gitBlob, sha256});
    source.set(expected.path, stripTypeScriptTypes(bytes.toString('utf8')));
  }
  const coreURL = dataURL(source.get('src/core.ts'));
  const profileURL = dataURL(source.get('src/classic-profile.ts')
    .replaceAll('"./core"', JSON.stringify(coreURL)));
  const denseURL = dataURL(source.get('src/classic-dense.ts')
    .replaceAll('"./core"', JSON.stringify(coreURL))
    .replaceAll('"./classic-profile"', JSON.stringify(profileURL)));
  const generatorURL = dataURL(source.get('src/classic-generator.ts')
    .replaceAll('"./core"', JSON.stringify(coreURL))
    .replaceAll('"./classic-profile"', JSON.stringify(profileURL))
    .replaceAll('"./classic-dense"', JSON.stringify(denseURL)));
  return {manifest: {repo: pin.repo, ref: pin.ref, files},
    core: await import(coreURL), profile: await import(profileURL),
    dense: await import(denseURL), generator: await import(generatorURL)};
}
const current = await loadPinned(packageManifest.sources.current);
export const previous = await loadPinned(packageManifest.sources.baseline);
export const {core, profile, dense, generator, manifest} = current;
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
