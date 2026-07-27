import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoots = ['backend/src', 'frontend/src', 'flutter/lib'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.dart']);
const ignored = new Set(['node_modules', 'dist', 'build', '.dart_tool', 'coverage', '.git']);

function walk(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (extensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function moduleName(file) {
  const p = relative(file).split('/');
  const src = p.indexOf('src');
  if (p[0] === 'flutter' && p[1] === 'lib') {
    if (p[2] === 'features') return `flutter/${p[3] || 'shared'}`;
    return `flutter/${p[2] || 'shared'}`;
  }
  if (src >= 0) return `${p[0]}/${p[src + 1] || 'shared'}`;
  return p[0];
}

function cleanDeclaration(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function extract(file, text) {
  const symbols = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    let match;

    match = line.match(/\bclass\s+([A-Za-z_$][\w$]*)/);
    if (match) symbols.push({ kind: 'class', name: match[1], line: index + 1, declaration: cleanDeclaration(line) });

    match = line.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (match) symbols.push({ kind: 'function', name: match[1], line: index + 1, declaration: cleanDeclaration(line) });

    match = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
    if (match) symbols.push({ kind: 'function', name: match[1], line: index + 1, declaration: cleanDeclaration(line) });

    if (!/^(if|for|while|switch|catch|return|throw)\b/.test(line)) {
      match = line.match(/^(?:export\s+)?(?:async\s+)?(?:static\s+)?(?:override\s+)?(?:[A-Za-z_$][\w$<>?,.\[\] ]+\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?:\{|=>)/);
      if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
        const already = symbols.some((s) => s.name === match[1] && s.line === index + 1);
        if (!already) symbols.push({ kind: 'method/function', name: match[1], line: index + 1, declaration: cleanDeclaration(line) });
      }
    }
  });
  return symbols;
}

const files = sourceRoots.flatMap((item) => walk(path.join(root, item)));
const contents = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
const allText = [...contents.values()].join('\n');
const modules = new Map();

for (const file of files) {
  const mod = moduleName(file);
  if (!modules.has(mod)) modules.set(mod, { files: new Set(), classes: [], functions: [] });
  const bucket = modules.get(mod);
  bucket.files.add(relative(file));
  for (const symbol of extract(file, contents.get(file))) {
    const occurrences = [...allText.matchAll(new RegExp(`\\b${symbol.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g'))];
    const referenceFiles = files.filter((candidate) => {
      const count = (contents.get(candidate).match(new RegExp(`\\b${symbol.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g')) || []).length;
      return count > 0;
    }).map(relative);
    const item = { ...symbol, file: relative(file), references: Math.max(0, occurrences.length - 1), referenceFiles };
    if (symbol.kind === 'class') bucket.classes.push(item);
    else bucket.functions.push(item);
  }
}

function esc(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const sortedModules = [...modules.entries()].sort(([a], [b]) => a.localeCompare(b));
const totalClasses = sortedModules.reduce((n, [, m]) => n + m.classes.length, 0);
const totalFunctions = sortedModules.reduce((n, [, m]) => n + m.functions.length, 0);
const out = [];
out.push('# SETU Code-Level Function and Class Inventory');
out.push('');
out.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
out.push('');
out.push('## Scope and Counting Method');
out.push('');
out.push('This report is generated from the current repository source. It inventories TypeScript/JavaScript under `backend/src` and `frontend/src`, and Dart under `flutter/lib`. Each row contains the declaration line, source location, a representative declaration snippet, and a static textual reference count. The count is the number of repository occurrences minus the declaration occurrence; it is not a runtime call count and does not prove that every reference executes. Overloaded, dynamically constructed, reflection-based, generated, or string-based calls may not be counted exactly.');
out.push('');
out.push(`Scanned files: ${files.length} | Modules: ${sortedModules.length} | Classes: ${totalClasses} | Functions/methods: ${totalFunctions}`);
out.push('');
out.push('## How to Read a Row');
out.push('');
out.push('- `Declaration`: the source line that declares the class or callable symbol.');
out.push('- `Static refs`: textual references elsewhere in the scanned source, excluding the declaration.');
out.push('- `Reference files`: files containing at least one textual occurrence.');
out.push('- Full executable bodies remain in the linked source file; this report includes the declaration code to keep the inventory navigable.');
out.push('');
out.push('## Module Summary');
out.push('');
out.push('| Module | Files | Classes | Functions/methods |');
out.push('|---|---:|---:|---:|');
for (const [name, data] of sortedModules) out.push(`| ${name} | ${data.files.size} | ${data.classes.length} | ${data.functions.length} |`);

for (const [name, data] of sortedModules) {
  out.push('');
  out.push(`## ${name}`);
  out.push('');
  out.push(`Source files: ${data.files.size}`);
  out.push('');
  out.push('### Classes');
  out.push('');
  if (!data.classes.length) out.push('No class declarations detected by the inventory parser.');
  else {
    out.push('| Class | Source | Declaration | Static refs | Reference files |');
    out.push('|---|---|---|---:|---|');
    for (const item of data.classes) out.push(`| \`${esc(item.name)}\` | [${item.file}:${item.line}](../${item.file}:${item.line}) | \`${esc(item.declaration)}\` | ${item.references} | ${item.referenceFiles.map((f) => `\`${f}\``).join(', ') || 'None'} |`);
  }
  out.push('');
  out.push('### Functions and Methods');
  out.push('');
  if (!data.functions.length) out.push('No callable declarations detected by the inventory parser.');
  else {
    out.push('| Name | Source | Declaration/code | Static refs | Reference files |');
    out.push('|---|---|---|---:|---|');
    for (const item of data.functions) out.push(`| \`${esc(item.name)}\` | [${item.file}:${item.line}](../${item.file}:${item.line}) | \`${esc(item.declaration)}\` | ${item.references} | ${item.referenceFiles.map((f) => `\`${f}\``).join(', ') || 'None'} |`);
  }
}

const destination = path.join(root, 'Final Documentation', 'code-inventory.md');
fs.writeFileSync(destination, `${out.join('\n')}\n`, 'utf8');
console.log(`Wrote ${destination}`);
