import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wpsPath = process.argv[2] || join(__dirname, '..', 'scratch', 'list.wps');
const outPath = join(__dirname, '..', 'data', 'furniture-dimensions.json');

const text = readFileSync(wpsPath).toString('utf16le');

const idMap = {
  'abu dhabi sofa': 'abu-dhabi-sofa',
  'bahamas sofa': 'bahamas-sofa',
  'bahrain accent chair': 'bahrain-accent-chair',
  'bhutan sofa': 'bhutan-sofa',
  'brunei sofa': 'brunei-sofa',
  'canada sofa': 'canada-sofa',
  'chad sofa': 'chad-sofa',
  'croatia sofa': 'croatia-sofa',
  'cuba sofa': 'cuba-sofa',
  'cyprus accent chair': 'cyprus-accent-chair',
  'divan love seat': 'divan-love-seat',
  'ecuador sofa bed': 'ecuador-sofa-bed',
  'france sofa bed': 'france-sofa-bed',
  'indonesia love seats': 'indonesia-love-seats',
  'indonesia love seat': 'indonesia-love-seats',
  'iraq love seat': 'iraq-love-seat',
  'israel sofa': 'israel-sofa',
  'korea love seat': 'korea-love-seat',
  'kuwait sofa': 'kuwait-sofa',
  'latvia sofa': 'latvia-sofda',
  'malaysian sofa': 'malaysian-sofa',
  'malaysia sofa': 'malaysian-sofa',
  'maldives love seats': 'maldives-love-seats',
  'maldives love seat': 'maldives-love-seats',
  'malta mini sofa': 'malta-mini-sofa',
  'morocco sofa': 'morocco-sofa',
  'myanmar sofa': 'myanmar-sofa',
  'palestine sofa': 'palestine-sofa',
  'philippines sofa': 'phillipine-sofa',
  'qatar sofa': 'qatar-sofa',
  'russia sofa': 'russia-sofa',
  'sakura bed': 'sakura-bed',
  'sri lanka mini sofa': 'sri-lanka-mini-sofa',
  'tanzania sofa': 'tanzania-sofa',
  'turkey sofa': 'turkey-sofa',
};

function parseBedDim(raw) {
  const m = raw.match(/([\d.]+)"\s*x\s*([\d.]+)"\s*\(Width x Length\)/i);
  if (!m) return null;
  const inch = 0.0254;
  const widthIn = Number(m[1]);
  const lengthIn = Number(m[2]);
  const heightIn = 24;
  return {
    lengthIn,
    widthIn,
    heightIn,
    length: lengthIn * inch,
    width: widthIn * inch,
    height: heightIn * inch,
    label: `W ${widthIn}" × L ${lengthIn}" × H ${heightIn}"`,
    labelCm: `${Math.round(widthIn * 2.54)} × ${Math.round(lengthIn * 2.54)} × ${Math.round(heightIn * 2.54)} cm`,
  };
}

function parseDim(raw) {
  const bed = parseBedDim(raw);
  if (bed) return bed;

  const m = raw.match(/L\s*([\d.]+)"?\s*x\s*W\s*([\d.]+)"?\s*(?:\([^)]*\))?\s*x\s*H\s*([\d.]+)"?/i);
  if (!m) return null;
  const inch = 0.0254;
  const lengthIn = Number(m[1]);
  const widthIn = Number(m[2]);
  const heightIn = Number(m[3]);
  return {
    lengthIn,
    widthIn,
    heightIn,
    length: lengthIn * inch,
    width: widthIn * inch,
    height: heightIn * inch,
    label: `L ${lengthIn}" × W ${widthIn}" × H ${heightIn}"`,
    labelCm: `${Math.round(lengthIn * 2.54)} × ${Math.round(widthIn * 2.54)} × ${Math.round(heightIn * 2.54)} cm`,
  };
}

function parseVariantRows(block, currentName) {
  const id = idMap[currentName.toLowerCase()];
  if (!id) return [];

  const cells = block.split('\u0007').map((c) => c.trim()).filter((c) => c.length > 0);
  const rows = [];
  for (let i = 0; i < cells.length; i++) {
    const dim = parseDim(cells[i]);
    if (!dim) continue;
    const variant = i > 0 && !parseDim(cells[i - 1]) ? cells[i - 1] : 'default';
    rows.push({ id, displayName: currentName, variant, ...dim });
  }
  return rows;
}

const blocks = text.split('\r').map((s) => s.trim()).filter(Boolean);
const entries = [];
let currentName = null;

for (const block of blocks) {
  if (/part \/ variant/i.test(block)) {
    entries.push(...parseVariantRows(block, currentName));
    continue;
  }

  if (/sofa|bed|chair|love seat|love seats|mini sofa/i.test(block)
    && !/^love seats$/i.test(block)
    && block.length < 80
    && !/L\s*[\d.]+"\s*x\s*W/i.test(block)) {
    currentName = block.replace(/\s*\(.*\)$/, '').trim();
  }
}

const byId = new Map();
for (const e of entries) {
  const prev = byId.get(e.id);
  if (!prev || e.lengthIn > prev.lengthIn) byId.set(e.id, e);
}

const furniture = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(outPath, `${JSON.stringify({ furniture }, null, 2)}\n`);

console.log(`Parsed ${furniture.length} / 32 furniture records`);
for (const r of furniture) console.log(`  ${r.id}: ${r.label}`);
const missing = [...new Set(Object.values(idMap))].filter((id) => !byId.has(id));
if (missing.length) console.log('Missing:', missing.join(', '));
