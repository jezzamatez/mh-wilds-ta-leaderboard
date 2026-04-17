const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const SHEET_ID = '1H6wf4FxwHntdQvsy5DSMXxaEpgLPeX7NQ7SQ51KaU04';
const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const GID_MONSTERS = '73280311';
const GID_WEAPONS = '2020437619';

const OUT_DIR = path.join(process.cwd(), 'assets', 'cache', 'icons');
const MAP_PATH = path.join(process.cwd(), 'assets', 'cache', 'icon-map.json');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (current || row.length) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function clean(value) {
  return value ? value.toString().trim() : '';
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function extensionFromContentType(contentType) {
  if (!contentType) return null;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('svg')) return '.svg';
  return null;
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
  } catch {}
  return null;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function collectIcons() {
  const [monsterCsv, weaponCsv] = await Promise.all([
    fetchText(`${SHEET_BASE}&gid=${GID_MONSTERS}`),
    fetchText(`${SHEET_BASE}&gid=${GID_WEAPONS}`)
  ]);

  const icons = [];

  const monsterRows = parseCSV(monsterCsv);
  monsterRows.slice(1).forEach(row => {
    const monsterName = clean(row[1]);
    const iconUrl = clean(row[3]);
    if (monsterName && iconUrl) {
      icons.push({
        type: 'monster',
        name: monsterName,
        url: iconUrl
      });
    }
  });

  const weaponRows = parseCSV(weaponCsv);
  weaponRows.slice(1).forEach(row => {
    const weaponName = clean(row[0]);
    const iconUrl = clean(row[2]);
    if (weaponName && iconUrl) {
      icons.push({
        type: 'weapon',
        name: weaponName,
        url: iconUrl
      });
    }
  });

  return icons;
}

async function downloadIcon(icon) {
  const hash = crypto.createHash('sha1').update(icon.url).digest('hex').slice(0, 8);
  const baseName = `${icon.type}-${slugify(icon.name)}-${hash}`;
  const existing = await findExisting(baseName);

  if (existing) {
    return existing;
  }

  const res = await fetch(icon.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 icon-cache-script'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to download ${icon.url}: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const ext = extensionFromContentType(contentType) || extensionFromUrl(icon.url) || '.img';
  const fileName = `${baseName}${ext}`;
  const filePath = path.join(OUT_DIR, fileName);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return `assets/cache/icons/${fileName}`;
}

async function findExisting(baseName) {
  try {
    const files = await fs.readdir(OUT_DIR);
    const match = files.find(file => file.startsWith(`${baseName}.`));
    return match ? `assets/cache/icons/${match}` : null;
  } catch {
    return null;
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const existingMap = await fs.readFile(MAP_PATH, 'utf8')
    .then(JSON.parse)
    .catch(() => ({}));

  const icons = await collectIcons();
  const iconMap = { ...existingMap };

  for (const icon of icons) {
    if (iconMap[icon.url]) {
      console.log(`Already mapped: ${icon.name}`);
      continue;
    }

    try {
      const localPath = await downloadIcon(icon);
      iconMap[icon.url] = localPath;
      console.log(`Cached ${icon.type}: ${icon.name} -> ${localPath}`);
    } catch (error) {
      console.warn(`Skipped ${icon.type}: ${icon.name}`);
      console.warn(`  ${error.message}`);
    }
  }

  await fs.mkdir(path.dirname(MAP_PATH), { recursive: true });
  await fs.writeFile(MAP_PATH, `${JSON.stringify(iconMap, null, 2)}\n`);
  console.log(`Wrote ${MAP_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
