import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = 'c:\\Users\\BDBLAP-0027\\Downloads\\MFHF_Furniture_Inventory_Summary.docx';
const out = join(tmpdir(), `mfhf_inv_${Date.now()}`);
mkdirSync(out, { recursive: true });

try {
  execSync(`tar -xf "${src}" -C "${out}"`, { stdio: 'pipe' });
} catch {
  const zip = join(out, 'doc.zip');
  copyFileSync(src, zip);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${out.replace(/'/g, "''")}' -Force"`,
    { stdio: 'pipe' }
  );
}

let xml = readFileSync(join(out, 'word', 'document.xml'), 'utf8');
xml = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
xml = xml
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/\r/g, '');

const lines = xml
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const skip = new Set([
  'MFHF Furniture Inventory Summary',
  'Sofas',
  'Beds',
  'Furniture',
  'Quantity / Set Composition',
  'Available Colors',
]);

const items = [];
for (let i = 0; i < lines.length; i += 1) {
  const name = lines[i];
  if (skip.has(name) || name.startsWith('Based on') || name.startsWith('Note:') || name.startsWith('Source:')) {
    continue;
  }

  const quantity = lines[i + 1];
  const colorsLine = lines[i + 2];
  if (!quantity || !colorsLine) continue;
  if (skip.has(quantity) || skip.has(colorsLine)) continue;

  const availableColors = colorsLine
    .split(',')
    .map((color) => color.trim())
    .filter(Boolean);

  items.push({
    displayName: name,
    quantity,
    availableColors,
  });

  i += 2;
}

const outPath = join(__dirname, '..', 'data', 'furniture-inventory.json');
writeFileSync(outPath, JSON.stringify(items, null, 2));
console.log(`Parsed ${items.length} inventory items -> ${outPath}`);
rmSync(out, { recursive: true, force: true });
