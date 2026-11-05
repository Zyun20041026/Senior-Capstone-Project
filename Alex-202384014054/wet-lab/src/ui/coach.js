// Alex 202384014054
// Tutorial overlay: a line in the step card that says the one next thing to
// do, and a ring around what to tap. The advice itself comes from each step's
// `coach(kit)` (see levels/coachkit.js); this file only finds and draws it.

import { kit } from '../levels/coachkit.js';
import { kbd } from './hud.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createCoach(app) {
  const ring = $('coachRing');

  const hide = () => { ring.hidden = true; };

  function current(w, level, prog) {
    const i = level.steps.findIndex((s, k) => !prog[k] && !(s.optional && s.skip?.(w)));
    return i;
  }

  function advice(w, level, prog) {
    const i = current(w, level, prog);
    if (i < 0) return { i, h: { say: '所有步骤都完成了。按 N 检查记录本里的计算，然后按 ⏎ 提交实验。', keys: ['N', '⏎'], target: { dom: '#step [data-submit]' } } };
    const s = level.steps[i];
    let h = null;
    try { h = s.coach ? s.coach(kit(w)) : null; } catch (e) { h = null; (app.coachErrors ||= []).push(`${level.id}/${s.id}: ${e.message}`); }
    if (!h) h = { say: s.hint || s.text, keys: s.keys || [] };
    return { i, h };
  }

  // Target rectangle in game coordinates (the HUD shares the stage transform).
  function rectOf(t) {
    if (!t) return null;
    if (t.item || t.tool || t.slot || t.fx || t.rect) return app.S.rectOf(t);
    let els = [];
    if (t.tab) els = [...document.querySelectorAll(`#tabs [data-st="${t.tab}"]`)];
    else if (t.dom) els = [...document.querySelectorAll(t.dom)];
    const g = $('game').getBoundingClientRect(), k = app.scale || 1;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      return [(r.left - g.left) / k, (r.top - g.top) / k, (r.right - g.left) / k, (r.bottom - g.top) / k];
    }
    return null;
  }

  function update(w, level, prog) {
    if (!app.save.coach || !w || !level || !app.running || !$('sop').hidden || !level.steps.length) { hide(); return; }
    const { h } = advice(w, level, prog);
    // The advice line lives inside the step card, in place of its hint.
    const line = $('step').querySelector('.co');
    const sig = `${h.say}|${(h.keys || []).join()}`;
    if (line && line.dataset.sig !== sig) {
      line.dataset.sig = sig;
      line.innerHTML = `<em>教程</em>${esc(h.say)}${h.keys && h.keys.length ? ` <i>${h.keys.map(kbd).join('')}</i>` : ''}`;
    }
    const r = rectOf(h.target);
    if (!r) { ring.hidden = true; return; }
    const pad = 6;
    ring.hidden = false;
    ring.style.transform = `translate(${r[0] - pad}px,${r[1] - pad}px)`;
    ring.style.width = `${r[2] - r[0] + 2 * pad}px`;
    ring.style.height = `${r[3] - r[1] + 2 * pad}px`;
  }

  return { update, hide, advise: () => (app.w && app.level?.steps.length ? advice(app.w, app.level, app.prog) : null) };
}
