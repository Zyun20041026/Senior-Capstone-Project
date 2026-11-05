// Alex 202384014054
// Minimal Chrome DevTools Protocol driver for headless review shots and the
// video export. Starts Chrome, opens one page, and exposes eval / shot.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openPage(url, { width = 1280, height = 720, port = Number(process.env.CDP_PORT) || 9351 } = {}) {
  const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'wetlab-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
    // Extra flags for unusual hosts, e.g. CHROME_ARGS="--no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader" in a root container.
    ...(process.env.CHROME_ARGS || '').split(/\s+/).filter(Boolean), 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) { /* not up yet */ }
  }
  if (!target) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map(), waiters = [], errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { r, j } = pending.get(msg.id); pending.delete(msg.id); msg.error ? j(new Error(msg.error.message)) : r(msg.result); }
    else if (msg.method) for (const w of waiters.slice()) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.r(msg.params); }
    if (msg.method === 'Runtime.exceptionThrown') { const t = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text; errors.push(t); console.error('page error:', t); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') { const t = msg.params.args.map((a) => a.value ?? a.description).join(' '); errors.push(t); console.error('console.error:', t); }
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method) => new Promise((r) => waiters.push({ method, r }));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (format = 'png', quality = 92) => Buffer.from((await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? quality : undefined, captureBeyondViewport: false })).data, 'base64');
  const close = () => { try { ws.close(); } catch (e) { /* closed */ } proc.kill(); };
  return { send, evaluate, shot, close, errors };
}
