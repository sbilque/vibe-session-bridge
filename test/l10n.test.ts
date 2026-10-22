// Cohérence des fichiers de localisation : clés et paramètres {n} identiques EN/FR,
// manifeste ↔ package.nls.json ↔ package.nls.fr.json, bundle.l10n.json ↔ code source.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { l10n } from './vscode-stub';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// 1. Le stub de l10n substitue {0}…{n} comme vscode.l10n.t.
assert.equal(l10n.t('code {0}', 3), 'code 3');
assert.equal(l10n.t('{0} et {1}', 'a', 'b'), 'a et b');
assert.equal(l10n.t('Bonjour {name}', { name: 'x' }), 'Bonjour x');

// 2. bundle.l10n.json (EN, source) ↔ bundle.l10n.fr.json : mêmes clés, mêmes paramètres.
const en = read('l10n/bundle.l10n.json');
const fr = read('l10n/bundle.l10n.fr.json');
assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort(), 'l10n : clés EN/FR différentes');
for (const [k, v] of Object.entries(en)) {
  assert.ok(k in fr, `clé absente du bundle FR : ${k}`);
  assert.equal(params(String(v)), params(String(fr[k])), `paramètres différents pour : ${k}`);
}

// 3. package.nls.json (EN) ↔ package.nls.fr.json : mêmes clés.
const nlsEn = read('package.nls.json');
const nlsFr = read('package.nls.fr.json');
assert.deepEqual(Object.keys(nlsEn).sort(), Object.keys(nlsFr).sort(), 'nls : clés EN/FR différentes');

// 4. Manifeste : chaque %clé% existe dans package.nls.json et package.nls.fr.json.
const manifest = readFileSync('package.json', 'utf8');
for (const m of manifest.matchAll(/%([\w.-]+)%/g)) {
  assert.ok(m[1] in nlsEn, `clé absente de package.nls.json : ${m[1]}`);
  assert.ok(m[1] in nlsFr, `clé absente de package.nls.fr.json : ${m[1]}`);
}
assert.ok(manifest.includes(String.raw`"l10n": "./l10n"`), "champ l10n manquant dans package.json");
assert.ok(existsSync('l10n/bundle.l10n.json') && existsSync('l10n/bundle.l10n.fr.json'));

// 5. bundle.l10n.json à jour avec le code : l.extraction officielle ne doit rien changer.
//    (l10n-dev affiche un avertissement : package.json pointe ./l10n alors qu'on exporte dans un dossier temporaire pour comparer.)
const out = execFileSync('npx', ['-y', '@vscode/l10n-dev', 'export', '--outDir', '/tmp/l10n-check', 'src'], { encoding: 'utf8' });
const extracted = read('/tmp/l10n-check/bundle.l10n.json');
assert.deepEqual(Object.keys(extracted).sort(), Object.keys(en).sort(), 'bundle.l10n.json en retard sur src/ : relancer npx @vscode/l10n-dev export');

console.log('1 OK l10n : stub, bundles EN/FR, manifeste, extraction à jour');
