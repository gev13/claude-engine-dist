/* ═══════════════════════════════════════════════════════════════════════════
   Demo images
   ───────────────────────────────────────────────────────────────────────────
   The default pictures for the demo content. Each is an original composition
   drawn here as SVG — landscapes, objects, rooms, faceless portraits,
   interface mock-ups, invented logos and line icons — and rasterised to WebP
   or PNG by `npm run db:seed:demo`, which stores them in the media library.
   So the demo ships no third-party imagery and no binary files in git, and an
   editor can reuse or replace every picture from the Media screen.
   ═══════════════════════════════════════════════════════════════════════════ */

export type DemoImage = {
  /** Stored as `demo/<name>.<format>` in the media directory. */
  name: string;
  alt: string;
  width: number;
  height: number;
  format: 'webp' | 'png';
  svg: string;
};

/* ── Small helpers ────────────────────────────────────────────────────────── */

/** Deterministic pseudo-random numbers, so every seed run draws the same pictures. */
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const svg = (w: number, h: number, body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

const vertical = (id: string, stops: string[]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map((c, i) => `<stop offset="${(i / Math.max(stops.length - 1, 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`;

/** A soft ridge line across the canvas, filled to the bottom edge. */
function ridge(w: number, h: number, base: number, amp: number, freq: number, phase: number, fill: string) {
  const points: string[] = [];
  const step = w / 60;
  for (let x = 0; x <= w + step; x += step) {
    const y = base + amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `<path d="M0,${h} L${points.join(' L')} L${w},${h} Z" fill="${fill}"/>`;
}

/* ── Landscapes ───────────────────────────────────────────────────────────── */

type ScenePalette = { sky: [string, string, string]; sun: string; hills: [string, string, string]; stars?: boolean; water?: boolean };

function scene(p: ScenePalette, seed: number, w = 1600, h = 1000) {
  const r = rng(seed);
  const defs =
    vertical('sky', p.sky) +
    `<radialGradient id="glow"><stop offset="0" stop-color="${p.sun}" stop-opacity=".85"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>`;
  const sx = w * (0.55 + r() * 0.25);
  const sy = h * (0.28 + r() * 0.12);
  const sr = Math.min(w, h) * 0.07;
  const stars = p.stars
    ? Array.from({ length: 140 }, () => `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.55).toFixed(0)}" r="${(r() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.7 + 0.2).toFixed(2)}"/>`).join('')
    : '';
  const water = p.water
    ? `<rect y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="${mix(p.sky[2], '#000000', 0.25)}"/>` +
      Array.from({ length: 16 }, (_, i) => `<rect x="${(r() * w * 0.8).toFixed(0)}" y="${(h * 0.8 + i * 12).toFixed(0)}" width="${(80 + r() * 260).toFixed(0)}" height="2" fill="${p.sun}" opacity="${(0.15 + r() * 0.25).toFixed(2)}"/>`).join('')
    : '';
  const body =
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>${stars}` +
    `<circle cx="${sx}" cy="${sy}" r="${sr * 4}" fill="url(#glow)"/><circle cx="${sx}" cy="${sy}" r="${sr}" fill="${p.sun}"/>` +
    ridge(w, h, h * 0.56, h * 0.07, 0.004 + r() * 0.002, r() * 6, p.hills[0]) +
    `<rect y="${h * 0.4}" width="${w}" height="${h * 0.6}" fill="url(#haze)"/>` +
    ridge(w, h, h * 0.67, h * 0.06, 0.006 + r() * 0.002, r() * 6, p.hills[1]) +
    (p.water ? water : ridge(w, h, h * 0.8, h * 0.05, 0.009 + r() * 0.003, r() * 6, p.hills[2]));
  return svg(w, h, body, defs);
}

/* ── Objects on a studio backdrop ─────────────────────────────────────────── */

type ProductShape = 'device' | 'bottle' | 'watch' | 'speaker' | 'lamp';

function product(shape: ProductShape, color: string, back: [string, string], w = 1200, h = 1200) {
  const cx = w / 2;
  const light = mix(color, '#ffffff', 0.38);
  const dark = mix(color, '#000000', 0.38);
  const defs =
    `<radialGradient id="bg" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="${back[0]}"/><stop offset="1" stop-color="${back[1]}"/></radialGradient>` +
    `<linearGradient id="obj" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2636"/><stop offset="1" stop-color="#06080c"/></linearGradient>` +
    `<radialGradient id="lampglow" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff4d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>`;

  let object = '';
  let floor = 1000;
  switch (shape) {
    case 'device':
      object =
        `<rect x="${cx - 190}" y="250" width="380" height="720" rx="58" fill="url(#obj)"/>` +
        `<rect x="${cx - 172}" y="268" width="344" height="684" rx="44" fill="url(#screen)"/>` +
        `<path d="M${cx - 172},268 h344 v230 L${cx - 172},640 Z" fill="#fff" opacity=".05"/>` +
        `<rect x="${cx - 42}" y="288" width="84" height="20" rx="10" fill="#000"/>` +
        `<rect x="${cx - 120}" y="760" width="240" height="14" rx="7" fill="#fff" opacity=".18"/>` +
        `<rect x="${cx - 80}" y="790" width="160" height="10" rx="5" fill="#fff" opacity=".1"/>`;
      break;
    case 'bottle':
      object =
        `<rect x="${cx - 44}" y="200" width="88" height="60" rx="10" fill="#1b1b1d"/>` +
        `<rect x="${cx - 52}" y="250" width="104" height="90" rx="14" fill="${dark}"/>` +
        `<rect x="${cx - 150}" y="320" width="300" height="660" rx="96" fill="url(#obj)"/>` +
        `<rect x="${cx - 150}" y="560" width="300" height="210" fill="#f3efe6" opacity=".92"/>` +
        `<rect x="${cx - 90}" y="620" width="180" height="16" rx="8" fill="#2b2b2b" opacity=".7"/>` +
        `<rect x="${cx - 60}" y="652" width="120" height="10" rx="5" fill="#2b2b2b" opacity=".4"/>` +
        `<rect x="${cx - 120}" y="340" width="40" height="600" rx="20" fill="#fff" opacity=".12"/>`;
      break;
    case 'watch':
      floor = 1060;
      object =
        `<rect x="${cx - 86}" y="150" width="172" height="320" rx="34" fill="${dark}"/>` +
        `<rect x="${cx - 86}" y="730" width="172" height="320" rx="34" fill="${dark}"/>` +
        `<circle cx="${cx}" cy="600" r="200" fill="url(#obj)"/><circle cx="${cx}" cy="600" r="168" fill="#0d1016"/>` +
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return `<rect x="${(cx + Math.sin(a) * 140 - 3).toFixed(1)}" y="${(600 - Math.cos(a) * 140 - 12).toFixed(1)}" width="6" height="24" rx="3" fill="#e9e5dc" opacity=".8" transform="rotate(${(i * 30).toFixed(0)} ${(cx + Math.sin(a) * 140).toFixed(1)} ${(600 - Math.cos(a) * 140).toFixed(1)})"/>`;
        }).join('') +
        `<rect x="${cx - 4}" y="500" width="8" height="104" rx="4" fill="#e9e5dc"/>` +
        `<rect x="${cx - 3}" y="596" width="84" height="7" rx="3.5" fill="#e9e5dc" transform="rotate(35 ${cx} 600)"/>` +
        `<circle cx="${cx}" cy="600" r="10" fill="${color}"/><rect x="${cx + 196}" y="580" width="30" height="40" rx="8" fill="${dark}"/>`;
      break;
    case 'speaker': {
      const dots = [];
      for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 8; col++) {
          dots.push(`<circle cx="${cx - 140 + col * 40}" cy="${330 + row * 40}" r="7" fill="#000" opacity=".28"/>`);
        }
      }
      object = `<rect x="${cx - 210}" y="260" width="420" height="720" rx="130" fill="url(#obj)"/>${dots.join('')}<circle cx="${cx}" cy="905" r="22" fill="#fff" opacity=".35"/>`;
      break;
    }
    case 'lamp':
      object =
        `<ellipse cx="${cx}" cy="975" rx="170" ry="30" fill="${dark}"/>` +
        `<rect x="${cx - 12}" y="480" width="24" height="495" fill="${mix(color, '#000000', 0.2)}"/>` +
        `<path d="M${cx - 250},560 L${cx - 130},280 L${cx + 130},280 L${cx + 250},560 Z" fill="url(#obj)"/>` +
        `<path d="M${cx - 250},560 L${cx + 250},560 L${cx + 420},1000 L${cx - 420},1000 Z" fill="url(#lampglow)"/>`;
      break;
  }

  const body = `<rect width="${w}" height="${h}" fill="url(#bg)"/><ellipse cx="${cx}" cy="${floor}" rx="320" ry="42" fill="url(#shadow)"/>${object}`;
  return svg(w, h, body, defs);
}

/* ── Buildings ────────────────────────────────────────────────────────────── */

type BuildingPalette = { sky: [string, string]; wall: string; side: string; glass: string; lit: string; ground: string; trees: string };

function building(p: BuildingPalette, seed: number, w = 1600, h = 1000) {
  const r = rng(seed);
  const windows = (x0: number, y0: number, cols: number, rows: number, cw: number, ch: number, gx: number, gy: number, litShare: number) => {
    const out: string[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        out.push(`<rect x="${x0 + col * (cw + gx)}" y="${y0 + row * (ch + gy)}" width="${cw}" height="${ch}" fill="${r() < litShare ? p.lit : p.glass}"/>`);
      }
    }
    return out.join('');
  };
  const trees = Array.from({ length: 14 }, (_, i) => {
    const x = 80 + i * 110 + r() * 40;
    const s = 40 + r() * 34;
    return `<circle cx="${x.toFixed(0)}" cy="${(880 - s * 0.6).toFixed(0)}" r="${s.toFixed(0)}" fill="${p.trees}"/>`;
  }).join('');
  const body =
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>` +
    `<rect x="170" y="500" width="330" height="380" fill="${mix(p.wall, '#000000', 0.12)}"/>` +
    windows(196, 530, 5, 7, 40, 30, 21, 18, 0.2) +
    `<polygon points="920,150 1060,215 1060,880 920,880" fill="${p.side}"/>` +
    `<rect x="560" y="120" width="360" height="760" fill="${p.wall}"/>` +
    windows(588, 150, 6, 16, 34, 26, 20, 17, 0.28) +
    `<rect x="1110" y="600" width="360" height="280" fill="${mix(p.wall, '#ffffff', 0.08)}"/>` +
    windows(1136, 628, 6, 4, 34, 34, 22, 22, 0.35) +
    `<rect y="880" width="${w}" height="${h - 880}" fill="${p.ground}"/>${trees}`;
  return svg(w, h, body, vertical('sky', [...p.sky]));
}

/* ── Rooms ────────────────────────────────────────────────────────────────── */

type RoomPalette = { wall: [string, string]; floor: string; sky: [string, string]; accent: string; plant: string; wood: string };

function room(p: RoomPalette, w = 1600, h = 1000) {
  const leaves = [
    [1490, 560, -30],
    [1540, 540, 25],
    [1470, 500, -55],
    [1560, 490, 50],
    [1515, 470, 5],
  ]
    .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="70" fill="${p.plant}" transform="rotate(${a} ${x} ${y})"/>`)
    .join('');
  const defs = vertical('wall', [...p.wall]) + vertical('win', [...p.sky]);
  const body =
    `<rect width="${w}" height="${h}" fill="url(#wall)"/>` +
    `<rect y="720" width="${w}" height="${h - 720}" fill="${p.floor}"/><rect y="716" width="${w}" height="6" fill="#000" opacity=".12"/>` +
    `<rect x="980" y="140" width="460" height="480" fill="url(#win)" stroke="#f5f2ea" stroke-width="10"/>` +
    `<rect x="1205" y="140" width="10" height="480" fill="#f5f2ea"/><rect x="980" y="375" width="460" height="10" fill="#f5f2ea"/>` +
    `<polygon points="980,620 1440,620 1300,1000 700,1000" fill="#fff" opacity=".07"/>` +
    `<rect x="320" y="200" width="260" height="180" fill="${mix(p.wall[1], '#000000', 0.2)}"/><rect x="340" y="220" width="220" height="140" fill="${mix(p.accent, '#ffffff', 0.35)}"/>` +
    `<line x1="520" y1="0" x2="520" y2="210" stroke="#1a1a1a" stroke-width="4"/><path d="M450,250 a70,56 0 0 1 140,0 Z" fill="#1a1a1a"/><circle cx="520" cy="262" r="60" fill="#fff4d6" opacity=".18"/>` +
    `<rect x="220" y="480" width="560" height="130" rx="44" fill="${mix(p.accent, '#000000', 0.14)}"/>` +
    `<rect x="200" y="560" width="600" height="160" rx="40" fill="${p.accent}"/>` +
    `<rect x="240" y="715" width="16" height="40" fill="#222"/><rect x="744" y="715" width="16" height="40" fill="#222"/>` +
    `<rect x="840" y="690" width="200" height="18" rx="4" fill="${p.wood}"/><rect x="860" y="708" width="14" height="80" fill="${p.wood}"/><rect x="1006" y="708" width="14" height="80" fill="${p.wood}"/>` +
    `<rect x="1470" y="610" width="90" height="120" rx="10" fill="#c9b8a3"/>${leaves}`;
  return svg(w, h, body, defs);
}

/* ── Faceless portraits ───────────────────────────────────────────────────── */

function person(bg: [string, string], skin: string, top: string, hair: string, style: 0 | 1 | 2, w = 600, h = 600) {
  const hairShape = [
    `<path d="M206,262 C206,160 394,160 394,262 C394,212 350,186 300,186 C250,186 206,212 206,262 Z" fill="${hair}"/>`,
    `<ellipse cx="300" cy="300" rx="130" ry="170" fill="${hair}"/>`,
    `<circle cx="300" cy="150" r="52" fill="${hair}"/><path d="M208,258 C208,168 392,168 392,258 C392,214 350,192 300,192 C250,192 208,214 208,258 Z" fill="${hair}"/>`,
  ][style];
  const body =
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    (style === 1 ? hairShape : '') +
    `<path d="M60,600 C60,470 170,410 300,410 C430,410 540,470 540,600 Z" fill="${top}"/>` +
    `<rect x="262" y="330" width="76" height="100" rx="30" fill="${mix(skin, '#000000', 0.12)}"/>` +
    `<ellipse cx="300" cy="268" rx="92" ry="108" fill="${skin}"/>` +
    (style === 1 ? `<path d="M210,250 C220,170 380,170 390,250 C360,210 240,210 210,250 Z" fill="${hair}"/>` : hairShape);
  return svg(w, h, body, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>`);
}

/* ── Interface mock-ups ───────────────────────────────────────────────────── */

function dashboard(accent: string, seed: number, w = 1600, h = 1000) {
  const r = rng(seed);
  const series = Array.from({ length: 24 }, (_, i) => 700 - (i * 11 + r() * 90 + Math.sin(i / 3) * 40));
  const line = series.map((y, i) => `${(420 + i * 44).toFixed(0)},${y.toFixed(0)}`).join(' ');
  const bars = Array.from({ length: 12 }, (_, i) => {
    const bh = 60 + r() * 150;
    return `<rect x="${1130 + i * 34}" y="${(860 - bh).toFixed(0)}" width="20" height="${bh.toFixed(0)}" rx="4" fill="${i === 9 ? accent : '#2c3440'}"/>`;
  }).join('');
  const kpis = [0, 1, 2]
    .map((i) => {
      const x = 400 + i * 390;
      return `<rect x="${x}" y="120" width="360" height="150" rx="16" fill="#161b23"/><rect x="${x + 28}" y="150" width="120" height="12" rx="6" fill="#47505e"/><rect x="${x + 28}" y="182" width="${170 + i * 30}" height="34" rx="8" fill="#e9ecf2"/><rect x="${x + 28}" y="232" width="70" height="12" rx="6" fill="${i === 1 ? '#e2685a' : '#4fbf8b'}"/>`;
    })
    .join('');
  const rows = Array.from({ length: 5 }, (_, i) => `<rect x="400" y="${740 + i * 44}" width="680" height="1" fill="#252c36"/><rect x="420" y="${752 + i * 44}" width="${140 + r() * 120}" height="12" rx="6" fill="#58616f"/><rect x="900" y="${752 + i * 44}" width="${60 + r() * 60}" height="12" rx="6" fill="#3c4450"/>`).join('');
  const nav = Array.from({ length: 7 }, (_, i) => `<rect x="44" y="${190 + i * 56}" width="${i === 1 ? 250 : 170 - (i % 3) * 20}" height="${i === 1 ? 40 : 14}" rx="${i === 1 ? 10 : 7}" fill="${i === 1 ? '#1f2733' : '#3a424e'}"/>`).join('');
  const body =
    `<rect width="${w}" height="${h}" fill="#0e1117"/><rect width="340" height="${h}" fill="#12161d"/>` +
    `<rect x="44" y="56" width="44" height="44" rx="12" fill="${accent}"/><rect x="104" y="70" width="120" height="16" rx="8" fill="#e9ecf2"/>${nav}${kpis}` +
    `<rect x="400" y="300" width="1150" height="400" rx="16" fill="#161b23"/>` +
    `<polygon points="420,690 ${line} ${420 + 23 * 44},690" fill="url(#area)"/><polyline points="${line}" fill="none" stroke="${accent}" stroke-width="4"/>` +
    `<rect x="1110" y="720" width="440" height="160" rx="16" fill="#161b23"/>${bars}${rows}`;
  return svg(w, h, body, `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>`);
}

function phone(kind: 'home' | 'stats' | 'profile', accent: string, w = 450, h = 950) {
  const status = `<rect width="${w}" height="${h}" fill="#0f1218"/><rect x="30" y="26" width="60" height="12" rx="6" fill="#e9ecf2"/><rect x="${w - 100}" y="26" width="70" height="12" rx="6" fill="#e9ecf2"/>`;
  const tabs = `<rect y="${h - 96}" width="${w}" height="96" fill="#151a22"/>${[0, 1, 2, 3].map((i) => `<circle cx="${70 + i * 104}" cy="${h - 52}" r="14" fill="${i === 0 ? accent : '#4a5361'}"/>`).join('')}`;
  let content = '';
  if (kind === 'home') {
    content =
      `<rect x="30" y="80" width="200" height="26" rx="8" fill="#e9ecf2"/>` +
      `<rect x="30" y="130" width="${w - 60}" height="240" rx="22" fill="url(#card)"/><rect x="56" y="300" width="160" height="18" rx="9" fill="#fff" opacity=".85"/><rect x="56" y="330" width="100" height="12" rx="6" fill="#fff" opacity=".6"/>` +
      [0, 1, 2, 3].map((i) => `<rect x="30" y="${400 + i * 100}" width="${w - 60}" height="84" rx="16" fill="#171c25"/><rect x="50" y="${416 + i * 100}" width="52" height="52" rx="12" fill="#2a3240"/><rect x="118" y="${424 + i * 100}" width="${170 - i * 20}" height="14" rx="7" fill="#dfe3ea"/><rect x="118" y="${448 + i * 100}" width="110" height="10" rx="5" fill="#5b6472"/>`).join('');
  } else if (kind === 'stats') {
    const pts = Array.from({ length: 10 }, (_, i) => `${30 + i * 43},${360 - Math.sin(i / 1.6) * 60 - i * 12}`).join(' ');
    content =
      `<rect x="30" y="80" width="160" height="26" rx="8" fill="#e9ecf2"/><rect x="30" y="126" width="${w - 60}" height="300" rx="22" fill="#171c25"/>` +
      `<polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="5"/>` +
      [0, 1].map((i) => `<rect x="${30 + i * 202}" y="450" width="188" height="140" rx="18" fill="#171c25"/><rect x="${52 + i * 202}" y="474" width="80" height="12" rx="6" fill="#5b6472"/><rect x="${52 + i * 202}" y="502" width="120" height="30" rx="8" fill="#e9ecf2"/>`).join('') +
      [0, 1, 2].map((i) => `<rect x="30" y="${612 + i * 70}" width="${w - 60}" height="56" rx="14" fill="#171c25"/><rect x="50" y="${632 + i * 70}" width="${180 - i * 30}" height="14" rx="7" fill="#c9ced8"/>`).join('');
  } else {
    content =
      `<circle cx="${w / 2}" cy="190" r="74" fill="url(#card)"/><rect x="${w / 2 - 90}" y="290" width="180" height="22" rx="11" fill="#e9ecf2"/><rect x="${w / 2 - 60}" y="324" width="120" height="12" rx="6" fill="#5b6472"/>` +
      [0, 1, 2].map((i) => `<rect x="${40 + i * 128}" y="370" width="112" height="80" rx="14" fill="#171c25"/><rect x="${62 + i * 128}" y="392" width="60" height="18" rx="6" fill="#e9ecf2"/>`).join('') +
      [0, 1, 2, 3].map((i) => `<rect x="30" y="${480 + i * 80}" width="${w - 60}" height="64" rx="14" fill="#171c25"/><rect x="50" y="${502 + i * 80}" width="${200 - i * 25}" height="14" rx="7" fill="#c9ced8"/><rect x="${w - 80}" y="${500 + i * 80}" width="30" height="18" rx="9" fill="${i === 0 ? accent : '#3a424e'}"/>`).join('');
  }
  return svg(w, h, status + content + tabs, `<linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${mix(accent, '#000000', 0.45)}"/></linearGradient>`);
}

/* ── Invented logos and icons (transparent PNG) ───────────────────────────── */

type LogoMark = 'circle' | 'rings' | 'triangle' | 'diamond' | 'hex' | 'wave' | 'bars' | 'leaf';

function logo(name: string, mark: LogoMark, w = 480, h = 140) {
  const c = '#d9d5cd';
  const marks: Record<LogoMark, string> = {
    circle: `<circle cx="70" cy="70" r="38" fill="${c}"/><circle cx="70" cy="70" r="16" fill="#000" opacity=".35"/>`,
    rings: `<circle cx="56" cy="70" r="30" fill="none" stroke="${c}" stroke-width="10"/><circle cx="88" cy="70" r="30" fill="none" stroke="${c}" stroke-width="10"/>`,
    triangle: `<polygon points="70,30 112,106 28,106" fill="${c}"/>`,
    diamond: `<rect x="44" y="44" width="52" height="52" fill="${c}" transform="rotate(45 70 70)"/>`,
    hex: `<polygon points="70,28 106,49 106,91 70,112 34,91 34,49" fill="none" stroke="${c}" stroke-width="10"/>`,
    wave: `<path d="M26,78 C44,48 62,48 70,70 C78,92 96,92 114,62" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`,
    bars: `<rect x="32" y="60" width="16" height="46" rx="4" fill="${c}"/><rect x="58" y="42" width="16" height="64" rx="4" fill="${c}"/><rect x="84" y="28" width="16" height="78" rx="4" fill="${c}"/>`,
    leaf: `<path d="M34,104 C34,56 66,32 108,32 C108,78 82,104 34,104 Z" fill="${c}"/>`,
  };
  const text = `<text x="138" y="88" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="50" font-weight="700" letter-spacing="-1" fill="${c}">${name.replace(/&/g, '&amp;')}</text>`;
  return svg(w, h, marks[mark] + text);
}

type IconName = 'shield' | 'bolt' | 'leaf' | 'chart' | 'globe' | 'clock';

function icon(name: IconName, s = 128) {
  const paths: Record<IconName, string> = {
    shield: '<path d="M64 14 L104 30 V62 C104 88 86 106 64 116 C42 106 24 88 24 62 V30 Z"/><path d="M46 64 L60 78 L84 50"/>',
    bolt: '<path d="M72 12 L30 72 H62 L54 116 L98 54 H66 Z"/>',
    leaf: '<path d="M26 104 C26 52 60 22 104 22 C104 74 78 104 26 104 Z"/><path d="M26 104 L78 52"/>',
    chart: '<path d="M22 108 H108"/><path d="M34 90 L56 64 L74 78 L104 38"/><path d="M84 38 H104 V58"/>',
    globe: '<circle cx="64" cy="64" r="44"/><path d="M20 64 H108"/><path d="M64 20 C44 42 44 86 64 108 C84 86 84 42 64 20 Z"/>',
    clock: '<circle cx="64" cy="64" r="44"/><path d="M64 36 V64 L84 76"/>',
  };
  return svg(s, s, `<g fill="none" stroke="#ece8e0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</g>`);
}

function appIcon(accent: string, s = 512) {
  return svg(
    s,
    s,
    `<rect width="${s}" height="${s}" rx="112" fill="url(#g)"/><path d="M146 346 C146 230 214 166 366 166 C366 282 298 346 146 346 Z" fill="#fff" opacity=".92"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(accent, '#ffffff', 0.2)}"/><stop offset="1" stop-color="${mix(accent, '#000000', 0.35)}"/></linearGradient>`,
  );
}

/* ── The set ──────────────────────────────────────────────────────────────── */

const W = (name: string, alt: string, width: number, height: number, markup: string): DemoImage => ({ name, alt, width, height, format: 'webp', svg: markup });
const PNG = (name: string, alt: string, width: number, height: number, markup: string): DemoImage => ({ name, alt, width, height, format: 'png', svg: markup });

const studioBack: [string, string] = ['#3a3d44', '#15171b'];
const warmBack: [string, string] = ['#e9e1d4', '#b9ab98'];

export const DEMO_IMAGES: DemoImage[] = [
  W('scene-dawn', 'Hills at dawn under a pink and violet sky', 1600, 1000, scene({ sky: ['#f6c89f', '#f19a8e', '#7d6ea8'], sun: '#fff2d6', hills: ['#6b5b95', '#4b3f72', '#2e2749'] }, 11)),
  W('scene-dusk', 'Layered mountains at dusk with a low sun', 1600, 1000, scene({ sky: ['#1f2a44', '#5b3a6b', '#e0766b'], sun: '#ffd6a0', hills: ['#3a2d4f', '#271f38', '#150f22'] }, 23)),
  W('scene-forest', 'Soft green hills fading into mist', 1600, 1000, scene({ sky: ['#dfe9e1', '#a9c8b4', '#6f9a83'], sun: '#f7f3e3', hills: ['#4f7a63', '#35584a', '#1f3a31'] }, 37)),
  W('scene-ocean', 'Headlands over a calm sea at midday', 1600, 1000, scene({ sky: ['#cfe6f2', '#8cc0d8', '#4a86a8'], sun: '#ffffff', hills: ['#2f6a8a', '#1f4d68', '#123247'], water: true }, 41)),
  W('scene-desert', 'Warm desert dunes under a pale sun', 1600, 1000, scene({ sky: ['#fbe3c5', '#f0b98a', '#d98b5f'], sun: '#fff5e6', hills: ['#c47a4f', '#9c5a3a', '#6e3d27'] }, 53)),
  W('scene-night', 'A starry sky over dark ridges', 1600, 1000, scene({ sky: ['#0b1026', '#1b2550', '#3b3f7a'], sun: '#e8e6ff', hills: ['#232a57', '#161b3d', '#0c1027'], stars: true }, 67)),

  W('product-graphite', 'A handheld device in graphite', 1200, 1200, product('device', '#3a3d42', studioBack)),
  W('product-sand', 'A handheld device in sand', 1200, 1200, product('device', '#d4c3a3', studioBack)),
  W('product-ocean', 'A handheld device in ocean blue', 1200, 1200, product('device', '#2c5364', studioBack)),
  W('product-ruby', 'A handheld device in ruby red', 1200, 1200, product('device', '#a3243a', studioBack)),
  W('product-bottle', 'A glass bottle with a paper label', 1200, 1200, product('bottle', '#5d7f6d', warmBack)),
  W('product-watch', 'A wristwatch with a dark dial', 1200, 1200, product('watch', '#b89a6a', studioBack)),
  W('product-speaker', 'A rounded speaker with a dotted grille', 1200, 1200, product('speaker', '#c9c3b8', warmBack)),
  W('product-lamp', 'A desk lamp casting warm light', 1200, 1200, product('lamp', '#e0a64a', ['#2a2d33', '#101114'])),

  W('arch-tower', 'An office tower with lit windows at dusk', 1600, 1000, building({ sky: ['#28324f', '#b77a73'], wall: '#3b4252', side: '#2a2f3b', glass: '#1f2633', lit: '#f3d9a4', ground: '#1b1e24', trees: '#1f3328' }, 5)),
  W('arch-facade', 'A pale stone facade on a bright day', 1600, 1000, building({ sky: ['#cfe3f0', '#f3efe6'], wall: '#d9d2c5', side: '#b8b0a2', glass: '#6f8595', lit: '#9fb6c6', ground: '#8f8a80', trees: '#56735d' }, 9)),
  W('arch-pavilion', 'Low modern buildings among trees', 1600, 1000, building({ sky: ['#f4d8b8', '#e8b48f'], wall: '#8c6f5a', side: '#6d5646', glass: '#3d3431', lit: '#ffd9a0', ground: '#4d3f35', trees: '#3f5b44' }, 13)),

  W('interior-studio', 'A bright studio with a sofa, table and plant', 1600, 1000, room({ wall: ['#e7e1d6', '#d4ccbe'], floor: '#b89f83', sky: ['#bfe0f2', '#e9f4f9'], accent: '#58707d', plant: '#4c7a57', wood: '#7a5a3e' })),
  W('interior-lounge', 'A warm lounge in the evening', 1600, 1000, room({ wall: ['#3b3230', '#2a2322'], floor: '#5a4636', sky: ['#1b2446', '#e0876c'], accent: '#a3553f', plant: '#3c6247', wood: '#4a3526' })),
  W('interior-workshop', 'A workshop with a long bench and daylight', 1600, 1000, room({ wall: ['#cfd6d8', '#aeb8bb'], floor: '#6d6a64', sky: ['#dcebf2', '#f7fbfc'], accent: '#3e4c56', plant: '#557d5c', wood: '#8a6a4b' })),

  W('person-1', 'Portrait placeholder, short dark hair', 600, 600, person(['#3c4a5c', '#1d2530'], '#e3b999', '#2f4858', '#2b2019', 0)),
  W('person-2', 'Portrait placeholder, long hair', 600, 600, person(['#5a4b6b', '#2a2233'], '#c98f6c', '#8a3e3b', '#3a2418', 1)),
  W('person-3', 'Portrait placeholder, hair in a bun', 600, 600, person(['#4b6b5a', '#1e2d25'], '#f0cdb2', '#e0d6c3', '#6b4a2e', 2)),
  W('person-4', 'Portrait placeholder, short hair', 600, 600, person(['#6b5a3c', '#2e2517'], '#8d5b3e', '#2c3e50', '#1a1210', 0)),
  W('person-5', 'Portrait placeholder, long light hair', 600, 600, person(['#3c5a6b', '#172730'], '#f2d3bd', '#50677a', '#c9a567', 1)),
  W('person-6', 'Portrait placeholder, hair in a bun', 600, 600, person(['#6b3c4b', '#2e1720'], '#b27a5a', '#d9c8a9', '#2b1c14', 2)),

  W('ui-dashboard', 'An analytics dashboard with a line chart and figures', 1600, 1000, dashboard('#4f7cff', 3)),
  W('ui-analytics', 'A reporting screen with a rising chart', 1600, 1000, dashboard('#34c38f', 7)),
  W('phone-home', 'A phone app home screen', 450, 950, phone('home', '#4f7cff')),
  W('phone-stats', 'A phone app showing a chart', 450, 950, phone('stats', '#34c38f')),
  W('phone-profile', 'A phone app profile screen', 450, 950, phone('profile', '#e2685a')),

  PNG('logo-alder', 'Alder & Co', 480, 140, logo('Alder & Co', 'leaf')),
  PNG('logo-brightline', 'Brightline', 480, 140, logo('Brightline', 'bars')),
  PNG('logo-corvid', 'Corvid', 480, 140, logo('Corvid', 'triangle')),
  PNG('logo-dunmore', 'Dunmore', 480, 140, logo('Dunmore', 'hex')),
  PNG('logo-everly', 'Everly', 480, 140, logo('Everly', 'rings')),
  PNG('logo-halcyon', 'Halcyon', 480, 140, logo('Halcyon', 'wave')),
  PNG('logo-kestrel', 'Kestrel', 480, 140, logo('Kestrel', 'diamond')),
  PNG('logo-meridian', 'Meridian', 480, 140, logo('Meridian', 'circle')),

  PNG('icon-shield', '', 128, 128, icon('shield')),
  PNG('icon-bolt', '', 128, 128, icon('bolt')),
  PNG('icon-leaf', '', 128, 128, icon('leaf')),
  PNG('icon-chart', '', 128, 128, icon('chart')),
  PNG('icon-globe', '', 128, 128, icon('globe')),
  PNG('icon-clock', '', 128, 128, icon('clock')),
  PNG('app-icon', 'App icon', 512, 512, appIcon('#4f7cff')),
];

const BY_NAME = new Map(DEMO_IMAGES.map((image) => [image.name, image]));

/** The public URL a demo image is served from once the demo seed has run. */
export function demoImageUrl(name: string): string {
  const image = BY_NAME.get(name);
  if (!image) throw new Error(`Unknown demo image: ${name}`);
  return `/media/demo/${image.name}.${image.format}`;
}

/** The stored path inside the media directory. */
export const demoImageFile = (image: DemoImage) => `demo/${image.name}.${image.format}`;
