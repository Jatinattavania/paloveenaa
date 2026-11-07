// Optimises the original photos in src/images into resized WebP files in website/assets/images.
// Run with: npm run images   (only needed when you add or change images)
import sharp from 'sharp';
import { readdir, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(root, 'images');
const OUT = path.join(root, '..', 'website', 'assets', 'images');

// folder -> widths to generate (WebP). Folders not listed are copied as-is.
const RULES = {
  products: { widths: [400, 800, 1200], quality: 78 },
  banners: { widths: [768, 1280, 1920], quality: 80 },
  misc: { widths: [1920], quality: 75, only: /page-title-bg/ },
  brand: { widths: [240, 480], quality: 90, only: /logo/ },
};

const exists = async (f) => stat(f).then(() => true, () => false);

for (const folder of await readdir(SRC)) {
  const rule = RULES[folder];
  await mkdir(path.join(OUT, folder), { recursive: true });
  for (const file of await readdir(path.join(SRC, folder))) {
    const input = path.join(SRC, folder, file);
    const base = file.replace(/\.[^.]+$/, '');
    if (!rule || (rule.only && !rule.only.test(file))) {
      await copyFile(input, path.join(OUT, folder, file));
      continue;
    }
    for (const w of rule.widths) {
      const out = path.join(OUT, folder, `${base}-${w}.webp`);
      if (await exists(out)) continue;
      await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: rule.quality }).toFile(out);
    }
    console.log('optimised', folder + '/' + file);
  }
}
