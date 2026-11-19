// Takes screenshot.png: the repository's public GitHub page with the README showing, via headless Chrome.
//   node tools/screenshot.mjs "<chrome.exe>" <scratch dir> <github url>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [chrome, scratch, url] = process.argv.slice(2);
const port = 9351;
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${join(scratch, 'gh-shot-profile')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* starting */ }
    if (!target) await sleep(250);
  }
  const ws = new WebSocket(target);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); waiting.get(msg.id)?.(msg); waiting.delete(msg.id); });
  const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(7000);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('screenshot.png', Buffer.from(shot.result.data, 'base64'));
  console.log('screenshot.png', Buffer.from(shot.result.data, 'base64').length, 'bytes');
  ws.close();
} finally {
  proc.kill();
  setTimeout(() => process.exit(0), 500);
}
