// Development mode: builds the site, serves it on http://localhost:8080 and rebuilds on every change.
// Run with: npm run dev   (stop with Ctrl+C)
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SRC, '..');
const run = (cmd) => spawn(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' });
const step = (cmd) => new Promise((resolve) => run(cmd).on('exit', resolve));

// Pages first, then CSS (Tailwind scans the freshly generated HTML for the classes in use).
let building = false;
let queued = false;
async function build() {
  if (building) return void (queued = true);
  building = true;
  await step('node src/build.mjs');
  await step('npx tailwindcss -i src/styles/input.css -o website/assets/css/styles.css');
  building = false;
  if (queued) { queued = false; build(); }
}

await build();
run('npx http-server website -p 8080 -c-1 -s');

// Rebuild on any change to content, templates, JS, styles or the Tailwind config.
let timer;
const onChange = (file) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\n> ${file} changed - rebuilding`);
    build();
  }, 150);
};
watch(SRC, { recursive: true }, (_event, file) => {
  if (file && /^(data|templates|js|styles)[\\/]/.test(file)) onChange(file);
});
watch(path.join(ROOT, 'tailwind.config.js'), () => onChange('tailwind.config.js'));

console.log('\nDev server: http://localhost:8080  (edit files in src/ and refresh the browser; Ctrl+C to stop)\n');
