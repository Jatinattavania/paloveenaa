// Development mode: builds the site, serves it on http://localhost:8080 and rebuilds on every change.
// Run with: npm run dev   (stop with Ctrl+C)
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SRC, '..');
const run = (cmd) => spawn(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' });

let building = false;
let queued = false;
function buildHtml() {
  if (building) return void (queued = true);
  building = true;
  run('node src/build.mjs').on('exit', () => {
    building = false;
    if (queued) { queued = false; buildHtml(); }
  });
}

buildHtml();
// Tailwind watches the generated HTML/JS/templates and src/styles, recompiling CSS on change.
run('npx tailwindcss -i src/styles/input.css -o website/assets/css/styles.css --watch');
run('npx http-server website -p 8080 -c-1 -s');

// Rebuild pages when content, templates or JS change (styles are handled by Tailwind above).
let timer;
watch(SRC, { recursive: true }, (_event, file) => {
  if (!file || !/^(data|templates|js)[\\/]/.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\n> ${file} changed - rebuilding pages`);
    buildHtml();
  }, 150);
});

console.log('\nDev server: http://localhost:8080  (edit files in src/ and refresh the browser; Ctrl+C to stop)\n');
