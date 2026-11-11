// Builds firebase/firestore.rules from the template (src/firestore.rules) + the private admin list
// (src/data/admins.json). Run with: npm run rules   – or deploy straight away: npm run deploy:rules
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SRC, '..');
const adminsFile = path.join(SRC, 'data', 'admins.json');
if (!existsSync(adminsFile)) {
  console.error('Missing src/data/admins.json – copy src/data/admins.example.json and fill in the emails.');
  process.exit(1);
}
const admins = JSON.parse(readFileSync(adminsFile, 'utf8'));
const clean = (list) => {
  const out = (list || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  for (const e of out) if (!/^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/.test(e)) throw new Error(`Not a valid email in admins.json: ${e}`);
  return out;
};
const owners = clean(admins.owners);
const staff = clean(admins.staff);
if (!owners.length) throw new Error('admins.json needs at least one owner');

const rules = readFileSync(path.join(SRC, 'firestore.rules'), 'utf8')
  .replaceAll('__OWNERS__', JSON.stringify(owners))
  .replaceAll('__STAFF__', JSON.stringify(staff));
if (/__(OWNERS|STAFF)__/.test(rules)) throw new Error('Rules template placeholders were not all replaced');
mkdirSync(path.join(ROOT, 'firebase'), { recursive: true });
writeFileSync(path.join(ROOT, 'firebase', 'firestore.rules'), rules);
console.log(`firebase/firestore.rules written (${owners.length} owner(s), ${staff.length} staff)`);
