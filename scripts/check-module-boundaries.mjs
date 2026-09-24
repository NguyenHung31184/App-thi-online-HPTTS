import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const sourceRoot = resolve('src');
const modulesRoot = resolve(sourceRoot, 'modules');
const servicesRoot = resolve(sourceRoot, 'services');
const supabaseClient = resolve(sourceRoot, 'lib', 'supabaseClient');
const sourceFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(file);
  }
}

function moduleName(file) {
  const parts = relative(modulesRoot, file).split(sep);
  return parts.length > 1 ? parts[0] : null;
}

await collect(sourceRoot);
const violations = [];
for (const file of sourceFiles) {
  const contents = await readFile(file, 'utf8');
  const imports = [...contents.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const currentModule = file.startsWith(`${modulesRoot}${sep}`) ? moduleName(file) : null;
  const moduleLayer = currentModule ? relative(resolve(modulesRoot, currentModule), file).split(sep)[0] : null;
  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const target = resolve(file, '..', specifier).replace(/\.(ts|tsx)$/, '');
    if (currentModule && target.startsWith(`${servicesRoot}${sep}`)) {
      violations.push(`${relative(sourceRoot, file)} imports ${specifier}; modules must not depend on legacy services.`);
    }
    if (currentModule && target === supabaseClient && moduleLayer !== 'data') {
      violations.push(`${relative(sourceRoot, file)} imports ${specifier}; only a module data adapter may import the Supabase client.`);
    }
    if (!target.startsWith(`${modulesRoot}${sep}`)) continue;
    const targetModule = moduleName(target);
    if (targetModule === currentModule) continue;
    if (!target.endsWith(`${sep}public`) && !target.endsWith(`${sep}public.ts`)) {
      violations.push(`${relative(sourceRoot, file)} imports ${specifier}; import a module only through public.ts.`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Module boundaries passed.');
