// Modular monolith score (docs/implementation/2026-10-01-modular-monolith-90-plan.md, section 2).
// `node scripts/architecture-score.mjs` prints a table; `--json` prints the same data. Reads files only.
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const srcRoot = resolve('src');
const toPosix = (path) => path.split(sep).join('/');
// Not business code: generated types, the app shell, technical platform and shared UI, and entry files.
const NOT_BUSINESS = [/^types\/supabase\.ts$/, /^app\//, /^platform\//, /^shared\//, /^main\.tsx$/, /^App\.tsx$/, /\.d\.ts$/];
const ROUTE_SHELLS = new Set(['Navigate', 'Layout', 'AdminLayout']);

async function collect(directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(file, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(file);
  }
  return out;
}
const lines = (text) => text.split('\n').length;
const SUPABASE_CALL = /supabase\s*\.\s*(from|rpc|storage|auth|functions)\b/;

const files = [];
for (const file of await collect(srcRoot)) {
  const path = toPosix(relative(srcRoot, file));
  if (/\.test\.tsx?$/.test(path)) continue;
  const text = await readFile(file, 'utf8');
  files.push({ path, text, lines: lines(text) });
}
const business = files.filter((file) => !NOT_BUSINESS.some((pattern) => pattern.test(file.path)));
const inModules = business.filter((file) => file.path.startsWith('modules/'));
const sum = (list) => list.reduce((total, file) => total + file.lines, 0);
const businessLines = sum(business);
const moduleLines = sum(inModules);

// Routes: element={<Name …>} in App.tsx, owned when Name is imported from a module public.ts.
const app = await readFile(resolve(srcRoot, 'App.tsx'), 'utf8');
const origin = new Map();
for (const match of app.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)) {
  const names = [match[1], ...(match[2] ?? '').split(',').map((name) => name.trim().split(/\s+as\s+/).pop())].filter(Boolean);
  for (const name of names) origin.set(name, match[3]);
}
const routeElements = [...app.matchAll(/element=\{<(\w+)/g)].map((match) => match[1]).filter((name) => !ROUTE_SHELLS.has(name));
const ownedRoutes = routeElements.filter((name) => /modules\/[^/]+\/public$/.test(origin.get(name) ?? ''));

const supabaseOutsideData = files
  .filter((file) => SUPABASE_CALL.test(file.text))
  .filter((file) => !/^modules\/[^/]+\/data\//.test(file.path) && !file.path.startsWith('platform/'))
  .map((file) => file.path);
const services = files.filter((file) => file.path.startsWith('services/'));
const pages = files.filter((file) => file.path.startsWith('pages/'));
const heavyPages = pages.filter((file) => file.lines > 60 || SUPABASE_CALL.test(file.text) || /from\s*['"][./]*services\//.test(file.text));

const allowlist = JSON.parse(await readFile(resolve('scripts', 'architecture-allowlist.json'), 'utf8'));
const exceptionsOf = (test) => allowlist.imports.filter((entry) => test(entry.key.split('|')));
const boundaries = spawnSync(process.execPath, [resolve('scripts', 'check-module-boundaries.mjs')], { encoding: 'utf8' });
const ci = await readFile(resolve('.github', 'workflows', 'ci.yml'), 'utf8').catch(() => '');
const modules = [...new Set(inModules.map((file) => file.path.split('/')[1]))].sort();
const allTests = (await collect(srcRoot)).map((file) => toPosix(relative(srcRoot, file))).filter((path) => /\.test\.tsx?$/.test(path));
const untestedModules = modules.filter((name) => !allTests.some((path) => path.startsWith(`modules/${name}/`)));

const pct = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
const criteria = [
  ['1. ≥85% mã nghiệp vụ trong src/modules', pct(moduleLines, businessLines) >= 85, `${pct(moduleLines, businessLines)}%`],
  ['2. ≥90% route nghiệp vụ từ public.ts của module', pct(ownedRoutes.length, routeElements.length) >= 90, `${ownedRoutes.length}/${routeElements.length}`],
  ['3. Gọi Supabase chỉ trong data/ hoặc platform', supabaseOutsideData.length === 0, `${supabaseOutsideData.length} file ngoài`],
  ['4. Module gọi module khác qua public.ts', boundaries.status === 0 && exceptionsOf((key) => key[0] === 'module-internal').length === 0, boundaries.status === 0 ? 'ranh giới đạt' : 'ranh giới lỗi'],
  ['5. domain không phụ thuộc layer/thư viện khác', exceptionsOf((key) => key[0] === 'domain-dependency').length === 0, `${exceptionsOf((key) => key[0] === 'domain-dependency').length} ngoại lệ`],
  ['6. ui không gọi Supabase/data', exceptionsOf((key) => /\/ui\//.test(key[1]) && ['layer', 'supabase-client'].includes(key[0])).length === 0, `${exceptionsOf((key) => /\/ui\//.test(key[1]) && ['layer', 'supabase-client'].includes(key[0])).length} ngoại lệ`],
  ['7. Không còn src/services', services.length === 0, `${services.length} file, ${sum(services)} dòng`],
  ['8. src/pages chỉ là route shell', heavyPages.length === 0, `${heavyPages.length}/${pages.length} trang còn nghiệp vụ`],
  ['9. Module nào cũng có unit test', untestedModules.length === 0, untestedModules.length ? `thiếu: ${untestedModules.join(', ')}` : 'đủ'],
  ['10. CI chạy boundary và score', /check:boundaries/.test(ci) && /arch:score/.test(ci), /arch:score/.test(ci) ? 'có' : 'thiếu score'],
];

const result = {
  businessLines,
  moduleLines,
  moduleShare: pct(moduleLines, businessLines),
  routes: { owned: ownedRoutes.length, total: routeElements.length },
  supabaseOutsideData,
  legacyServices: { files: services.length, lines: sum(services) },
  modules,
  criteriaPassed: criteria.filter((item) => item[1]).length,
  criteria: criteria.map(([name, pass, detail]) => ({ name, pass, detail })),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Mã nghiệp vụ trong module: ${moduleLines}/${businessLines} dòng = ${result.moduleShare}%`);
  console.log(`Route do module sở hữu: ${ownedRoutes.length}/${routeElements.length}`);
  console.log(`Service cũ: ${services.length} file, ${sum(services)} dòng`);
  console.log(`Tiêu chí đạt: ${result.criteriaPassed}/10`);
  for (const item of result.criteria) console.log(`  ${item.pass ? '✓' : '·'} ${item.name} — ${item.detail}`);
}
