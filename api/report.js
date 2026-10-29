/* Builds the Safari Sightings PDF on the server (same design as the phone PDF, v4). */
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const CATS = ['Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish', 'Butterflies', 'Plants', 'Other'];
const CC = { Mammals: '#B5651D', Birds: '#356B8C', Reptiles: '#4C7A2E', Amphibians: '#6B7A3A', Fish: '#397A8A', Butterflies: '#8A5A9E', Plants: '#3F6F45', Other: '#7A4F8F' };
const ST = { 'Endangered': ['#FCEBEB', '#A32D2D'], 'Vulnerable': ['#FAEEDA', '#854F0B'], 'Least concern': ['#EAF3DE', '#3B6D11'], 'Critically endangered': ['#FCEBEB', '#791F1F'], 'Near threatened': ['#FAF3D2', '#6B5A0B'], 'Not evaluated': ['#F1EFE8', '#5F5E5A'] };
const FEATURED = ['Leopard', 'Sloth bear', 'Elephant', 'Wild Water Buffalo', 'Mugger crocodile'];
const FEATURE_TITLE = 'Big Five progress';
const GU = { name: 'S. C. Jastan Ric', role: 'Environmental Steward', phone: '+94 754540123', email: 'jastanric@outlook.com', site: 'jastanric.vercel.app' };
const FEEDBACK = 'https://g.page/r/CTknMOMTPqYaEBM/review';

let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'logo.png')).toString('base64'); } catch (e) { }

/* Cloudinary photo -> 600 x 450 JPEG as data URI (null if it cannot be downloaded) */
async function img(u) {
  if (!u) return null;
  if (u.startsWith('data:')) return u;
  try {
    const url = u.includes('res.cloudinary.com') && u.includes('/upload/') ? u.replace('/upload/', '/upload/w_600,h_450,c_fill,q_auto,f_jpg/') : u;
    const r = await fetch(url);
    if (!r.ok) return null;
    return 'data:image/jpeg;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
  } catch (e) { return null; }
}

async function buildReport(g, sp) {
  const photos = {};
  const urls = [...new Set(sp.flatMap(s => [s['Male photo link'], s['Female photo link']]).filter(Boolean))];
  await Promise.all(urls.map(async u => { photos[u] = await img(u); }));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const date = g.dateText || new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const rc = (x, y, w, h, c) => { doc.setFillColor(c); doc.rect(x, y, w, h, 'F'); };
  const rr = (x, y, w, h, r, c) => { doc.setFillColor(c); doc.roundedRect(x, y, w, h, r, r, 'F'); };
  const tx = (s, x, y, sz, st, c, al) => { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(c); doc.text(String(s), x, y, { align: al || 'left' }); };
  const tick = (x, y, r, c) => { doc.setFillColor(c); doc.circle(x, y, r, 'F'); doc.setDrawColor('#FFFFFF'); doc.setLineWidth(.5); doc.lines([[1.2, 1.3], [2.1, -2.8]], x - 1.6, y, [1, 1], 'S'); };
  const strip = () => {
    rc(0, 0, W, 14, '#1F4D3A'); rc(0, 14, W, 1, '#C9923A');
    tx('Safari Sightings Report', 18, 9, 10, 'bold', '#FFFFFF');
    tx(g.name + ' | ' + date, 192, 9, 8.5, 'normal', '#FFFFFF', 'right');
  };
  const newPage = () => { doc.addPage(); strip(); return 26; };

  /* ---------- first page header ---------- */
  rc(0, 0, W, 48, '#1F4D3A'); rc(0, 48, W, 2, '#C9923A');
  doc.setDrawColor('#FFFFFF'); doc.setLineWidth(.4); doc.circle(26.1, 25, 12.8, 'S');
  if (LOGO) doc.addImage(LOGO, 'PNG', 21.95, 16.25, 7.8, 17);
  tx('Safari Sightings Report', 46, 21, 23, 'bold', '#FFFFFF');
  tx(g.park, 46, 29, 11, 'normal', '#FFFFFF');
  tx('Your personal record of the wildlife you spotted', 46, 36, 9, 'italic', '#FFFFFF');

  /* ---------- guest box ---------- */
  rr(18, 58, 174, 31, 3, '#EAF3EC');
  [['GUEST', g.name], ['PREPARED BY', GU.name], ['PARK', g.park], ['DATE', date]].forEach((f, i) => {
    const x = 24 + (i % 2) * 85, y = 64 + (i >> 1) * 14;
    tx(f[0], x, y, 8, 'normal', '#6B6A65'); tx(f[1], x, y + 6, 11, 'bold', '#2C2C2A');
  });

  /* ---------- summary cards ---------- */
  const cards = [['Total', sp.length, '#1F4D3A']].concat(CATS.map(c => [c, sp.filter(s => s.Category === c).length, CC[c]]));
  const shown = cards.filter((k, i) => i === 0 || k[1] > 0);
  const cw = (174 - (shown.length - 1) * 3) / shown.length;
  shown.forEach((k, i) => {
    const x = 18 + i * (cw + 3);
    doc.setDrawColor('#D3D1C7'); doc.setLineWidth(.2); doc.setFillColor('#FFFFFF'); doc.roundedRect(x, 94, cw, 16, 2, 2, 'FD');
    tx(k[1], x + cw / 2, 102, 16, 'bold', k[2], 'center');
    tx(k[0], x + cw / 2, 107.5, shown.length > 6 ? 6.5 : 8, 'normal', '#6B6A65', 'center');
  });

  /* ---------- Big Five ---------- */
  const names = sp.map(s => String(s['Common name'] || '').toLowerCase());
  const hit = FEATURED.map(f => names.some(n => n.includes(f.toLowerCase())));
  rr(18, 116, 174, 26, 3, '#FAEEDA');
  tx(FEATURE_TITLE, 24, 123, 10.5, 'bold', '#633806');
  tx(hit.filter(Boolean).length + ' of ' + FEATURED.length + ' spotted', 186, 123, 9, 'normal', '#633806', 'right');
  FEATURED.forEach((f, i) => {
    const cx = 18 + 34.8 * i + 17.4;
    if (hit[i]) tick(cx, 129.5, 3.2, '#3B6D11'); else { doc.setFillColor('#D3D1C7'); doc.circle(cx, 129.5, 3.2, 'F'); }
    tx(f, cx, 137.5, 8.5, hit[i] ? 'bold' : 'normal', hit[i] ? '#2C2C2A' : '#6B6A65', 'center');
  });
  tx('Only the species you ticked appear in this report. Status tags show IUCN Red List category.', 18, 148, 8.5, 'italic', '#6B6A65');

  /* ---------- species ---------- */
  let y = 157, n = 0;
  for (const c of CATS) {
    const items = sp.filter(s => s.Category === c);
    if (!items.length) continue;
    if (y + 103 > 273) y = newPage();
    rr(18, y, 174, 8, 1.5, CC[c]);
    tx(c.toUpperCase(), 22, y + 5.4, 10, 'bold', '#FFFFFF');
    tx(items.length + ' spotted', 188, y + 5.4, 9, 'normal', '#FFFFFF', 'right');
    y += 13;

    for (const s of items) {
      const no = String(++n).padStart(2, '0');
      if (s.extra) {
        if (y + 20 > 273) y = newPage();
        tx(no, 18, y + 1.5, 10, 'bold', CC[c]);
        tx(s['Common name'], 28, y + 1.5, 12.5, 'bold', '#2C2C2A');
        tx('Added by ' + g.name + (s.time ? '   |   Spotted at ' + s.time : ''), 28, y + 7, 9.5, 'italic', '#6B6A65');
        tick(188.8, y + 3, 3.2, '#3B6D11');
        y += 16;
        continue;
      }
      if (y + 84 > 273) y = newPage();
      tx(no, 18, y + 1.5, 10, 'bold', CC[c]);
      tx(s['Common name'], 28, y + 1.5, 12.5, 'bold', '#2C2C2A');
      tx((s['Scientific name'] || '') + (s.time ? '   |   Spotted at ' + s.time : ''), 28, y + 7, 9.5, 'italic', '#6B6A65');
      const st = String(s['IUCN status'] || 'Not evaluated'), col = ST[st] || ST['Not evaluated'];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      const w = doc.getTextWidth(st.toUpperCase()) + 5;
      rr(182 - w, y + 1, w, 5, 2.5, col[0]);
      tx(st.toUpperCase(), 182 - w / 2, y + 4.5, 7.5, 'bold', col[1], 'center');
      tick(188.8, y + 3, 3.2, '#3B6D11');

      const top = y + 10;
      for (let j = 0; j < 2; j++) {
        const x = 18 + j * 90, lab = j ? 'Female' : 'Male';
        const data = photos[s[lab + ' photo link']];
        if (data) doc.addImage(data, 'JPEG', x, top, 84, 63);
        else { rr(x, top, 84, 63, 2, j ? '#EEE8DA' : '#E6DFCC'); tx('[ ' + lab + ' photo ]', x + 42, top + 32, 9, 'normal', '#6B6A65', 'center'); }
        tx(s[lab + ' caption'] || '', x, top + 67.5, 8.5, 'italic', '#2C2C2A');
      }
      tx('Did you know?', 18, top + 73.5, 8.5, 'bold', '#C9923A');
      tx(s['Did you know'] || '', 41, top + 73.5, 8.5, 'normal', '#2C2C2A');
      y += 90;
    }
  }

  /* ---------- feedback ---------- */
  if (y + 80 > 273) y = newPage();
  rr(18, y, 174, 18, 3, '#EAF3EC');
  tx('How was your safari?', 24, y + 7, 10.5, 'bold', '#2C2C2A');
  tx('We would love your feedback:', 24, y + 13, 9, 'normal', '#6B6A65');
  tx(FEEDBACK, 72, y + 13, 9, 'bold', '#185FA5');
  doc.link(72, y + 9, 70, 5, { url: FEEDBACK });
  y += 24;

  /* ---------- naturalist panel ---------- */
  doc.saveGraphicsState();
  doc.roundedRect(18, y, 174, 54, 4, 4, null); doc.clip(); doc.discardPath();
  rc(18, y, 174, 54, '#E0A93B');
  doc.setFillColor('#12342B');
  doc.lines([[168, 0], [0, 56], [-168, 0], [-4.5, -15, -4.5, -41, 0, -56]], 25.5, y - 1, [1, 1], 'F', true);
  doc.setDrawColor('#F2CF7A'); doc.setLineWidth(.35);
  doc.lines([[-4.5, 15, -4.5, 41, 0, 56]], 27.5, y - 1, [1, 1], 'S', false);
  doc.restoreGraphicsState();

  doc.setFillColor('#1F5645'); doc.circle(170.1, y + 14.7, 12, 'F');
  doc.setDrawColor('#E0A93B'); doc.setLineWidth(.5); doc.circle(170.1, y + 14.7, 12, 'S');
  doc.setLineWidth(.15); doc.circle(170.1, y + 14.7, 10.6, 'S');
  if (LOGO) doc.addImage(LOGO, 'PNG', 166.4, y + 6.95, 6.9, 15);

  tx('YOUR NATURALIST', 31, y + 9, 8, 'bold', '#E0A93B');
  tx(GU.name, 31, y + 18, 20, 'bold', '#FFFFFF');
  tx(GU.role, 31, y + 24, 9.5, 'italic', '#9FE1CB');
  tx('Thank you for sharing the bush with me today. I hope the sightings, the stories and', 31, y + 31, 9, 'normal', '#E6F1EC');
  tx('the quiet moments stay with you long after the trip. Come back soon.', 31, y + 36, 9, 'normal', '#E6F1EC');
  doc.setDrawColor('#4A8B75'); doc.setLineWidth(.2); doc.line(31, y + 41.5, 186, y + 41.5);
  const site = /^https?:/i.test(GU.site) ? GU.site : 'https://' + GU.site;
  [['PHONE', GU.phone, 'tel:' + GU.phone.replace(/[^+0-9]/g, '')], ['EMAIL', GU.email, 'mailto:' + GU.email], ['WEBSITE', GU.site, site]].forEach((k, i) => {
    const x = 31 + i * 51;
    doc.setFillColor('#E0A93B'); doc.circle(x + 1.2, y + 46.1, 1.2, 'F');
    tx(k[0], x + 4, y + 45.5, 7.5, 'bold', '#E0A93B');
    tx(k[1], x + 4, y + 50.5, 9, 'bold', '#FFFFFF');
    const w = doc.getTextWidth(String(k[1]));
    doc.setDrawColor('#E0A93B'); doc.setLineWidth(.25); doc.line(x + 4, y + 51.6, x + 4 + w, y + 51.6);
    doc.link(x + 4, y + 47, w, 5.5, { url: k[2] });
  });

  /* ---------- footers ---------- */
  const N = doc.getNumberOfPages();
  for (let i = 1; i <= N; i++) {
    doc.setPage(i);
    doc.setDrawColor('#D3D1C7'); doc.setLineWidth(.2); doc.line(18, 280, 192, 280);
    tx('Prepared by ' + GU.name + ' | ' + g.park + ' | ' + date, 18, 285, 7.5, 'normal', '#6B6A65');
    tx('Page ' + i + ' of ' + N, 192, 285, 7.5, 'normal', '#6B6A65', 'right');
  }
  return doc;
}

const CANON = v => { const t = String(v || '').toLowerCase().trim(); return t === 'cr' || t.includes('critical') ? 'Critically endangered' : t === 'en' || t.includes('endanger') ? 'Endangered' : t === 'vu' || t.includes('vulner') ? 'Vulnerable' : t === 'nt' || t.includes('near') ? 'Near threatened' : t === 'lc' || t.includes('least') ? 'Least concern' : 'Not evaluated'; };
const CAT = c => CATS.find(o => o.toLowerCase() === String(c || '').toLowerCase().trim()) || 'Other';

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('POST only');
    const d = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!process.env.REPORT_KEY || !d || d.key !== process.env.REPORT_KEY) return res.status(401).send('Not allowed');
    const sp = (d.species || []).map(s => Object.assign({}, s, { Category: CAT(s.Category), 'IUCN status': CANON(s['IUCN status']) }));
    const doc = await buildReport(d.guest, sp);
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(Buffer.from(doc.output('arraybuffer')));
  } catch (e) {
    res.status(500).send('PDF error: ' + e.message);
  }
};
module.exports.buildReport = buildReport;
