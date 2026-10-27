// JULIAN'S IPHONE TESTERS, ON GITHUB'S MAC (core/ios.js puts this in the app's repo as .github/julian/ios-crawl.mjs;
// deploy/CHUNK-testers.md phase 4). The app is built for the simulator (ios-build.sh); here the testers take turns on it,
// on iPhone and iPad simulators through Appium, each its own way: its screen, light or dark, big text or not, pressing
// everything, typing into every box with the keyboard up, going back. What they find goes straight to Julian with the run's
// own key, each with a picture of the screen, the thing boxed in red. Self-contained: Node 22, Appium, and sharp if it is
// there (without it the picture is sent without its box).
//
//   node ios-crawl.mjs              the testers
//   node ios-crawl.mjs hello "..."  tell Julian how far it has got
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const { JULIAN_RUN: RUN = '', JULIAN_KEY: KEY = '', JULIAN_BASE: BASE = '', APP = '' } = process.env;
const T = (() => { try { return JSON.parse(process.env.JULIAN_TESTERS || '{}'); } catch { return {}; } })();
const LIST = Array.isArray(T.list) ? T.list : [], PAGE = String(T.page || 'ios:app');
const AP = 'http://127.0.0.1:4723';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// (and said in the run's log on GitHub too, so a run can be read there)
const log = (...a) => console.log('[julian]', ...a);
const tell = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-julian-run': KEY }, body: JSON.stringify({ run: RUN, ...body }) })
  .then(r => r.json()).catch(() => null);

// ---- READING THE SCREEN ----------------------------------------------------------------------------------------------------
// XCUITest's page source: every element with its type, words and place in points
export function parse(xml) {
  return [...String(xml).matchAll(/<XCUIElementType(\w+)\s([^>]*?)\/?>/g)].map((m, i) => {
    const a = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')]));
    const x = +a.x || 0, y = +a.y || 0, w = +a.width || 0, h = +a.height || 0;
    return { i, type: m[1], name: a.name || '', label: a.label || '', value: a.value || '', visible: a.visible !== 'false', enabled: a.enabled !== 'false', x1: x, y1: y, x2: x + w, y2: y + h };
  }).filter(n => n.visible && n.x2 > n.x1 && n.y2 > n.y1);
}
const PRESS = /^(Button|Link|Cell|Switch|Tab|SegmentedControl|MenuItem|Image)$/, BOX = /^(TextField|SecureTextField|TextView|SearchField)$/;
const LEAVE = /delete|remove|pay|buy|purchase|log ?out|sign ?out|subscribe|unsubscribe/i;
const nameOf = n => (BOX.test(n.type) ? n.label || n.name || n.value || 'the text box' : n.label || n.name || n.value || n.type).slice(0, 40);
const sigOf = list => list.map(n => n.type + n.label + n.value + Math.round(n.x1) + ',' + Math.round(n.y1)).join('|');
// what code sees on a screen: text over text, too small to tap, placeholder words
export function looks(nodes) {
  const out = [], texts = nodes.filter(n => n.type === 'StaticText' && (n.label || n.value));
  for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
    const A = texts[a], B = texts[b];
    if ((A.x1 <= B.x1 && A.x2 >= B.x2 && A.y1 <= B.y1 && A.y2 >= B.y2) || (B.x1 <= A.x1 && B.x2 >= A.x2 && B.y1 <= A.y1 && B.y2 >= A.y2)) continue;
    const ix = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1), iy = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1);
    if (ix > 3 && iy > 3 && ix * iy > 0.25 * Math.min((A.x2 - A.x1) * (A.y2 - A.y1), (B.x2 - B.x1) * (B.y2 - B.y1))) out.push(['overlap', 'Text overlaps: "' + nameOf(A).slice(0, 24) + '"', A]);
  }
  for (const n of nodes) if (/^(Button|Link|Switch)$/.test(n.type) && n.enabled && ((n.x2 - n.x1) < 40 || (n.y2 - n.y1) < 40)) out.push(['tap', '"' + nameOf(n) + '" is too small to tap', n]);
  const bad = texts.find(n => /\b(something went wrong|exception|undefined|null|NaN|lorem ipsum|TODO)\b/i.test(n.label + ' ' + n.value));
  if (bad) out.push(['placeholder', 'Placeholder text: "' + (bad.label || bad.value).slice(0, 40) + '"', bad]);
  return out;
}

// ---- APPIUM ---------------------------------------------------------------------------------------------------------------
const wd = async (method, path, body) => { const r = await fetch(AP + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).catch(e => ({ json: async () => ({ value: { error: String(e.message) } }) }));
  const j = await r.json().catch(() => ({})); return j && j.value; };
const run = (s, script, args = {}) => wd('POST', '/session/' + s + '/execute/sync', { script, args: [args] });
const tap = (s, x, y) => wd('POST', '/session/' + s + '/actions', { actions: [{ type: 'pointer', id: 'f', parameters: { pointerType: 'touch' }, actions: [
  { type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 60 }, { type: 'pointerUp', button: 0 }] }] });
const screen = async s => parse(await wd('GET', '/session/' + s + '/source'));
const SIMS = { 'iphone-se': ['iPhone SE (3rd generation)'], 'iphone-15': ['iPhone 16', 'iPhone 15'], 'iphone-max': ['iPhone 16 Pro Max', 'iPhone 15 Pro Max', 'iPhone 16 Plus'],
  ipad: ['iPad (10th generation)', 'iPad (A16)', 'iPad Air 11-inch (M2)', 'iPad Air 11-inch (M3)'], 'ipad-land': ['iPad (10th generation)', 'iPad (A16)', 'iPad Air 11-inch (M2)', 'iPad Air 11-inch (M3)'] };
function sims() { try { const j = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' })); return Object.values(j.devices).flat().map(d => d.name); } catch { return []; } }
const bundle = () => { try { return execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', join(APP, 'Info.plist')], { encoding: 'utf8' }).trim(); } catch { return ''; } };
// why it crashed, from the newest crash report the simulator left for it
function crashWhy(app) {
  try { const dir = join(homedir(), 'Library/Logs/DiagnosticReports'), f = readdirSync(dir).filter(x => /\.ips$/.test(x) && x.toLowerCase().includes(app.toLowerCase().slice(0, 12)))
      .map(x => join(dir, x)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    const t = f ? readFileSync(f, 'utf8') : '', m = /"type"\s*:\s*"(EXC_[A-Z_]+)"|"exception"\s*:\s*\{[^}]*"type"\s*:\s*"([^"]+)"/.exec(t) || /\b(NSInvalidArgumentException|NSRangeException|EXC_[A-Z_]+|SIGABRT|SIGSEGV)\b/.exec(t);
    return m ? (m[1] || m[2] || m[0]) : ''; } catch { return ''; }
}
// the tester's picture: the screen, the thing boxed and labelled (sharp, when it is there)
async function picture(s, n, label, scale) {
  const b64 = await wd('GET', '/session/' + s + '/screenshot');
  if (typeof b64 !== 'string' || b64.length < 1000) return '';
  try { const sharp = (await import('sharp')).default;
    const img = sharp(Buffer.from(b64, 'base64')), meta = await img.metadata(), W = meta.width, H = meta.height, k = scale || 1, esc = t => String(t).replace(/[<&"]/g, c => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' })[c]);
    const box = n ? '<rect x="' + (n.x1 * k - 6) + '" y="' + (n.y1 * k - 6) + '" width="' + ((n.x2 - n.x1) * k + 12) + '" height="' + ((n.y2 - n.y1) * k + 12) + '" rx="14" fill="none" stroke="#ff3b30" stroke-width="' + (6 * k / 2) + '"/>'
      + '<rect x="' + Math.max(0, n.x1 * k - 6) + '" y="' + Math.max(0, n.y1 * k - 52 * k / 2) + '" width="' + (label.length * 13 * k / 2 + 24) + '" height="' + (40 * k / 2) + '" rx="8" fill="#ff3b30"/>'
      + '<text x="' + (Math.max(0, n.x1 * k - 6) + 12) + '" y="' + (Math.max(0, n.y1 * k - 52 * k / 2) + 28 * k / 2) + '" font-family="Helvetica" font-weight="700" font-size="' + (22 * k / 2) + '" fill="#fff">' + esc(label) + '</text>' : '';
    const out = await img.composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' + box + '</svg>') }]).resize({ width: 420 }).jpeg({ quality: 62 }).toBuffer();
    return 'data:image/jpeg;base64,' + out.toString('base64');
  } catch { return 'data:image/png;base64,' + b64; }
}
const LABEL = { overlap: 'Text overlaps', tap: 'Too small to tap', placeholder: 'Placeholder text', keyboard: 'Keyboard covers it', dead: 'Does nothing', appcrash: 'Crash' };

// ---- THE TESTERS ------------------------------------------------------------------------------------------------------------
async function main() {
  const status = Object.fromEntries(LIST.map(p => [p.id, { id: p.id, state: 'waiting', page: '', found: 0 }]));
  const progress = async () => { const r = await tell('/api/testers/progress', { testers: Object.values(status), pages: [PAGE] }); return !!(r && r.stop); };
  const id = bundle(), have = sims();
  if (!APP || !id) { await tell('/api/testers/found', { findings: [{ kind: 'setup', what: 'The app did not build', page: PAGE }] }); return; }
  // one simulator a kind of screen, the testers on it one after another
  const groups = new Map();
  for (const p of LIST) { const name = (SIMS[p.device] || []).find(n => have.includes(n)) || have.find(n => /^iPhone/.test(n)) || 'iPhone 16'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(p); }
  let stop = false;
  for (const [sim, team] of groups) {
    if (stop) break;
    team.forEach(p => { status[p.id] = { ...status[p.id], state: 'running', doing: 'starting ' + sim }; });
    stop = await progress();
    const land = team[0].device === 'ipad-land';
    const ses = await wd('POST', '/session', { capabilities: { alwaysMatch: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:deviceName': sim, 'appium:app': APP,
      'appium:connectHardwareKeyboard': false, 'appium:wdaLaunchTimeout': 360000, 'appium:wdaConnectionTimeout': 360000, 'appium:newCommandTimeout': 900, 'appium:orientation': land ? 'LANDSCAPE' : 'PORTRAIT' } } });
    const s = ses && ses.sessionId;
    log('simulator', sim, s ? 'ready' : 'would not start: ' + JSON.stringify(ses).slice(0, 300));
    if (!s) { await tell('/api/testers/found', { findings: [{ kind: 'setup', what: 'The ' + sim + ' simulator would not start', page: PAGE }] }); team.forEach(p => { status[p.id] = { ...status[p.id], state: 'done', doing: '' }; }); continue; }
    const caps = ses.capabilities || {}, udid = caps.udid || 'booted';
    const win = await wd('GET', '/session/' + s + '/window/rect'), shot = await wd('GET', '/session/' + s + '/screenshot');
    const scale = (() => { try { return Buffer.from(String(shot), 'base64').readUInt32BE(16) / ((win && win.width) || 390); } catch { return 2; } })();
    for (const p of team) {
      if (stop) break;
      const steps = [], seen = new Set(), mine = [];
      status[p.id] = { ...status[p.id], state: 'running', page: PAGE, doing: 'getting ready' };
      const note = async (kind, what, n) => { const k = kind + '|' + what; if (seen.has(k)) return; seen.add(k);
        log(p.id, 'found', kind + ':', what);
        mine.push({ kind, what, page: PAGE, el: n ? nameOf(n) : '', tester: p.id, device: p.label + ' (iPhone simulator)', steps: steps.slice(-6), shot: await picture(s, n, LABEL[kind] || 'Fault', scale) }); };
      await run(s, 'mobile: setAppearance', { style: p.dark ? 'dark' : 'light' });
      try { execFileSync('xcrun', ['simctl', 'ui', udid, 'content_size', p.way === 'words' || p.slow ? 'extra-extra-large' : 'large']); } catch {}
      await run(s, 'mobile: terminateApp', { bundleId: id }); await run(s, 'mobile: activateApp', { bundleId: id }); await sleep(2500);
      steps.push('Open the app');
      const alive = async () => (await run(s, 'mobile: queryAppState', { bundleId: id })) === 4;
      const crashed = async () => { if (await alive()) return false; await note('appcrash', 'App crashes' + ((w => (w ? ': ' + w : ''))(crashWhy(id.split('.').pop()))), null);
        await run(s, 'mobile: activateApp', { bundleId: id }); await sleep(2500); return true; };
      const tested = new Set(), max = LIST.length > 6 ? 25 : 20;
      for (let i = 0; i < max && !stop; i++) {
        const nodes = await screen(s);
        status[p.id].doing = 'looking at the screen'; status[p.id].found = mine.length;
        for (const [k, w, n] of looks(nodes)) await note(k, w, n);
        // THE KEYBOARD OVER THE BOX: every box typed into with the keyboard up
        const box = nodes.find(n => BOX.test(n.type) && !tested.has('e' + n.type + Math.round(n.y1)));
        if (box && (p.way === 'forms' || p.way === 'words' || p.way === 'first' || i % 3 === 0)) {
          tested.add('e' + box.type + Math.round(box.y1)); status[p.id].doing = 'typing into ' + nameOf(box);
          await tap(s, (box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2); await sleep(900);
          await run(s, 'mobile: keys', { keys: [...(p.way === 'words' ? 'Supercalifragilistic Julian' : 'Julian tester')] }).catch(() => null);
          await sleep(600); steps.push('Type into ' + nameOf(box));
          const after = await screen(s), kb = after.find(n => n.type === 'Keyboard'), same = after.find(n => n.type === box.type && Math.abs(n.x1 - box.x1) < 2) || box;
          if (kb && same.y2 > kb.y1 + 2) await note('keyboard', 'Keyboard covers "' + nameOf(box) + '"', same);
          await run(s, 'mobile: hideKeyboard', {}).catch(() => null); await sleep(400);
          continue;
        }
        // PRESS EVERYTHING: each control must do something
        const ctl = nodes.filter(n => PRESS.test(n.type) && n.enabled && !tested.has(n.type + nameOf(n) + Math.round(n.x1) + Math.round(n.y1)) && !LEAVE.test(n.label + ' ' + n.name) && (n.type !== 'Image' || n.name));
        if (!ctl.length) { const back = nodes.find(n => n.type === 'Button' && /back/i.test(n.name + n.label)); if (back && (p.way === 'back' || i % 4 === 3)) { await tap(s, (back.x1 + back.x2) / 2, (back.y1 + back.y2) / 2); steps.push('Back'); await sleep(900); continue; } break; }
        const n = ctl[Math.floor(((p.seed * (i + 7)) % 997) / 997 * ctl.length)];
        tested.add(n.type + nameOf(n) + Math.round(n.x1) + Math.round(n.y1));
        status[p.id].doing = 'pressing ' + nameOf(n);
        const sig = sigOf(nodes);
        await tap(s, (n.x1 + n.x2) / 2, (n.y1 + n.y2) / 2); steps.push('Press "' + nameOf(n) + '"');
        await sleep(1200);
        if (await crashed()) continue;
        if (sigOf(await screen(s)) === sig) await note('dead', '"' + nameOf(n) + '" does nothing', n);
        if (p.way === 'back') { const back = (await screen(s)).find(x => x.type === 'Button' && /back/i.test(x.name + x.label)); if (back) { await tap(s, (back.x1 + back.x2) / 2, (back.y1 + back.y2) / 2); steps.push('Back'); await sleep(800); } }
        if (i % 5 === 4) stop = await progress();
      }
      log(p.id, 'done after', steps.length, 'steps:', steps.slice(-6).join(' > '));
      if (mine.length) log('sent', JSON.stringify((await tell('/api/testers/found', { findings: mine })) || {}).slice(0, 120));
      status[p.id] = { ...status[p.id], state: 'done', doing: '', found: mine.length };
      stop = await progress();
    }
    await wd('DELETE', '/session/' + s);
  }
}

const mode = process.argv[2];
if (mode === 'hello') {
  const first = LIST[0] && LIST[0].id;
  await tell('/api/testers/progress', { testers: first ? [{ id: first, state: 'running', page: PAGE, doing: process.argv[3] || 'starting' }] : [] });
} else if (process.argv[1] && /ios-crawl\.mjs$/.test(process.argv[1])) {
  // Appium up first (it is started just before this)
  for (let i = 0; i < 60; i++) { const ok = await fetch(AP + '/status').then(r => r.ok).catch(() => false); if (ok) break; await sleep(2000); }
  try { await main(); } catch (e) { log('stopped:', String((e && e.stack) || e).slice(0, 400)); await tell('/api/testers/found', { findings: [{ kind: 'setup', what: 'The testers stopped: ' + String((e && e.message) || e).slice(0, 60), page: PAGE }] }); }
  await tell('/api/testers/finish', {});
}
