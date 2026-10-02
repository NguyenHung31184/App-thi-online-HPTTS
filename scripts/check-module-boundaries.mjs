// Architecture rules for src/ (docs/implementation/2026-10-02-architecture-phase-0.md).
// Existing exceptions live in scripts/architecture-allowlist.json; the list may only shrink.
// `node scripts/check-module-boundaries.mjs --write-allowlist` rewrites it from the current code (review the diff).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const root = resolve('.');
const srcRoot = resolve('src');
const allowlistPath = resolve('scripts', 'architecture-allowlist.json');
const LAYERS = new Set(['domain', 'application', 'data', 'queries', 'ui']);
const LEGACY_DIRS = ['services', 'pages', 'components', 'contexts', 'utils'];
const LEGACY_IMPORT_DIRS = new Set(['components', 'contexts', 'utils', 'pages', 'lib']);
const SUPABASE_CLIENTS = new Set(['lib/supabaseClient', 'platform/supabase/client']);

const toPosix = (path) => path.split(sep).join('/');
const srcPath = (file) => toPosix(relative(srcRoot, file)).replace(/\.(tsx?|d\.ts)$/, '');

async function collect(directory, out) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(file, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(file);
  }
  return out;
}

/** Import statements with their target and whether only types are imported. */
function importsOf(contents) {
  const found = [];
  const statement = /(^|\n)\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  for (const match of contents.matchAll(statement)) {
    if (match[7]) { found.push({ specifier: match[7], typeOnly: false }); continue; }
    const clause = match[4] ?? '';
    const named = /^\{([^}]*)\}$/.exec(clause.trim());
    const allNamedTypes = named !== null && named[1].split(',').map((part) => part.trim()).filter(Boolean).every((part) => part.startsWith('type '));
    found.push({ specifier: match[5], typeOnly: Boolean(match[3]) || allNamedTypes });
  }
  return found;
}

/** Where a file sits: module name and layer, or the top-level folder of src. */
function place(path) {
  const parts = path.split('/');
  if (parts[0] !== 'modules') return { module: null, layer: null, top: parts.length > 1 ? parts[0] : '(root)' };
  return { module: parts[1], layer: parts.length > 3 && LAYERS.has(parts[2]) ? parts[2] : 'root', top: 'modules' };
}

function checkImport(from, to, typeOnly, packageName) {
  const source = place(from);
  if (packageName) {
    if (source.layer === 'domain' && /^(react|react-dom|@supabase\/)/.test(packageName)) return ['domain-dependency', `domain imports ${packageName}`];
    if (source.module && source.layer !== 'data' && /^@supabase\//.test(packageName)) return ['supabase-client', `${source.layer} imports ${packageName}`];
    return null;
  }
  const target = place(to);
  const targetTop = to.split('/')[0];
  if (target.module && target.module !== source.module && !/^modules\/[^/]+\/public$/.test(to)) {
    return ['module-internal', 'import another module only through its public.ts'];
  }
  if (!source.module) return null;
  if (targetTop === 'services') return ['legacy-service', 'modules must not depend on src/services'];
  if (SUPABASE_CLIENTS.has(to) && source.layer !== 'data') return ['supabase-client', 'only a module data/ adapter may import the Supabase client'];
  if (target.module === source.module) {
    const from_ = source.layer;
    const to_ = target.layer;
    const forbidden = {
      domain: ['application', 'data', 'queries', 'ui', 'root'],
      application: ['queries', 'ui', 'root'],
      data: ['queries', 'ui', 'root'],
      queries: ['ui', 'data', 'root'],
      ui: ['data', 'root'],
    }[from_] ?? [];
    if (forbidden.includes(to_)) return ['layer', `${from_} must not import ${to_}`];
    if (from_ === 'ui' && to_ === 'application' && !typeOnly) return ['layer', 'ui may import application for types only'];
    return null;
  }
  if (source.layer === 'domain' && !(targetTop === 'types' && typeOnly)) return ['domain-dependency', `domain must not import ${targetTop}`];
  if (LEGACY_IMPORT_DIRS.has(targetTop) && !SUPABASE_CLIENTS.has(to) && !typeOnly) return ['legacy-dependency', `module depends on legacy src/${targetTop}`];
  return null;
}

const files = await collect(srcRoot, []);
const findings = [];
for (const file of files) {
  const from = srcPath(file);
  const contents = await readFile(file, 'utf8');
  for (const { specifier, typeOnly } of importsOf(contents)) {
    const isRelative = specifier.startsWith('.');
    const to = isRelative ? srcPath(resolve(file, '..', specifier)) : null;
    if (isRelative && to.startsWith('..')) continue;
    const result = checkImport(from, to, typeOnly, isRelative ? null : specifier);
    if (result) findings.push({ rule: result[0], file: `src/${from}`, target: isRelative ? `src/${to}` : specifier, message: result[1] });
  }
}
const legacyFiles = files
  .map((file) => toPosix(relative(root, file)))
  .filter((path) => LEGACY_DIRS.some((dir) => path.startsWith(`src/${dir}/`)) && !/\.test\.tsx?$/.test(path))
  .sort();

const key = (item) => `${item.rule}|${item.file}|${item.target}`;

if (process.argv.includes('--write-allowlist')) {
  const previous = JSON.parse(await readFile(allowlistPath, 'utf8').catch(() => '{"imports":[],"legacyFiles":[]}'));
  const notes = new Map([...previous.imports, ...previous.legacyFiles].map((entry) => [entry.key ?? entry.file, entry]));
  const imports = findings.map((item) => ({ key: key(item), phase: notes.get(key(item))?.phase ?? null, reason: notes.get(key(item))?.reason ?? item.message }));
  const legacy = legacyFiles.map((file) => ({ file, phase: notes.get(file)?.phase ?? null }));
  await writeFile(allowlistPath, `${JSON.stringify({ imports, legacyFiles: legacy }, null, 2)}\n`);
  console.log(`Wrote ${imports.length} import exceptions and ${legacy.length} legacy files to scripts/architecture-allowlist.json.`);
  process.exit(0);
}

const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
const allowedImports = new Set(allowlist.imports.map((entry) => entry.key));
const allowedLegacy = new Set(allowlist.legacyFiles.map((entry) => entry.file));
const errors = [];
for (const item of findings) {
  if (!allowedImports.has(key(item))) errors.push(`${item.file} imports ${item.target}: ${item.message} [${item.rule}]`);
}
for (const file of legacyFiles) {
  if (!allowedLegacy.has(file)) errors.push(`${file}: new file in a legacy folder; put new code in src/modules/<name>/ [legacy-new-file]`);
}
const current = new Set(findings.map(key));
const present = new Set(legacyFiles);
for (const entry of allowlist.imports) if (!current.has(entry.key)) errors.push(`allowlist entry no longer needed, remove it: ${entry.key}`);
for (const entry of allowlist.legacyFiles) if (!present.has(entry.file)) errors.push(`allowlist entry no longer needed, remove it: ${entry.file}`);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Module boundaries passed (${allowlist.imports.length} listed import exceptions, ${allowlist.legacyFiles.length} legacy files).`);
