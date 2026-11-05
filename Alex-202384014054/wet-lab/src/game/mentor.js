// Alex 202384014054
// The easy tier's mentor: a senior colleague who stops you once, before the
// first time you are about to break a sterility rule, and says why (one stop
// covers every rule that action would break). The
// world's rules do not change by tier — after the warning the same action
// counts exactly as it would on any tier.

import { RULES } from './sop.js';

export function mentorStop(w, ruleIds) {
  if (!w.diff?.mentor || !ruleIds?.length) return false;
  const seen = (w.flags.mentored ||= {});
  const fresh = ruleIds.filter((r) => RULES[r] && !seen[r]);
  if (!fresh.length) return false;
  // One stop names every slip this action would make; none of them stops you again.
  for (const r of ruleIds) seen[r] = true;
  w.events.push({ kind: 'mentor', text: fresh.map((r) => RULES[r].text).join('；'), why: RULES[fresh[0]].why, rule: fresh[0] });
  return true;
}
