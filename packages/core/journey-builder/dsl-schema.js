import { CAMPAIGN_TYPES } from '../campaign-builder/index.js';

const ACTIVITY_TYPES = ['wait_duration', 'decision_split', 'email_send', 'wait_until_event', 'engagement_split'];
const DANGEROUS_SQL = /\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|ALTER|GRANT|REVOKE|MERGE|EXEC|EXECUTE|SP_\w+|XP_\w+)\b/i;

export function validateDsl(dsl) {
  const errors = [];
  if (!dsl || typeof dsl !== 'object') return { valid: false, errors: ['DSL must be an object'] };
  if (dsl.version !== 1) errors.push('version must be 1');
  if (typeof dsl.name !== 'string') errors.push('name must be a string');
  if (!dsl.entry) errors.push('entry is required');
  else validateEntry(dsl.entry, errors);
  if (!Array.isArray(dsl.activities)) { errors.push('activities must be an array'); return { valid: false, errors }; }

  const ids = new Set();
  for (const a of dsl.activities) {
    if (!a.id) errors.push('activity missing id');
    else if (ids.has(a.id)) errors.push(`duplicate activity id: ${a.id}`);
    else ids.add(a.id);
    if (!ACTIVITY_TYPES.includes(a.type)) errors.push(`unknown activity type: ${a.type}`);
  }

  for (const a of dsl.activities) validateActivity(a, ids, dsl.activities, errors);

  try { if (hasCycle(dsl)) errors.push('cycle detected in activity graph'); }
  catch { /* malformed activities already reported above */ }

  return { valid: errors.length === 0, errors };
}

function validateEntry(entry, errors) {
  const s = entry.source;
  if (!s || s.type !== 'master_de_query') { errors.push('entry.source.type must be master_de_query'); return; }
  if (!s.master_de_key) errors.push('entry.source.master_de_key required');
  if (!s.target_de_name) errors.push('entry.source.target_de_name required');
  if (!s.sql) { errors.push('entry.source.sql required'); return; }
  if (s.sql.includes(';')) errors.push('sql must be a single statement (no semicolons)');
  if (DANGEROUS_SQL.test(s.sql)) errors.push('dangerous sql detected (DROP/DELETE/UPDATE/TRUNCATE/INSERT/ALTER)');
  if (!/^\s*SELECT\b/i.test(s.sql)) errors.push('sql must start with SELECT');
  if (s.master_de_key && !new RegExp(`\\bFROM\\s+\\[?${s.master_de_key}\\]?`, 'i').test(s.sql))
    errors.push(`sql must reference master_de_key "${s.master_de_key}" in FROM clause`);
}

function validateActivity(a, ids, all, errors) {
  const nextRefs = [];
  switch (a.type) {
    case 'wait_duration':
      if (!Number.isFinite(a.amount) || a.amount <= 0) errors.push(`${a.id}: amount must be positive`);
      if (!['minutes', 'hours', 'days', 'weeks'].includes(a.unit)) errors.push(`${a.id}: unit invalid`);
      nextRefs.push(a.next);
      break;
    case 'decision_split':
      if (!Array.isArray(a.branches) || a.branches.length === 0) errors.push(`${a.id}: branches required`);
      else for (const b of a.branches) {
        if (!b.label || !b.condition) errors.push(`${a.id}: branch missing label or condition`);
        nextRefs.push(b.next);
      }
      nextRefs.push(a.default_next);
      break;
    case 'email_send':
      if (!CAMPAIGN_TYPES[a.campaign_type]) errors.push(`${a.id}: campaign_type "${a.campaign_type}" not in CAMPAIGN_TYPES registry`);
      if (!a.email_shell_name) errors.push(`${a.id}: email_shell_name required`);
      if (a.mc_email_id !== null && a.mc_email_id !== undefined && typeof a.mc_email_id !== 'number')
        errors.push(`${a.id}: mc_email_id must be null or a number`);
      nextRefs.push(a.next);
      break;
    case 'wait_until_event':
      if (!['email_opened', 'email_clicked'].includes(a.event)) errors.push(`${a.id}: event invalid`);
      if (!a.target_activity) errors.push(`${a.id}: target_activity required`);
      else {
        const targetIdx = all.findIndex(x => x.id === a.target_activity);
        const selfIdx = all.findIndex(x => x.id === a.id);
        const target = all[targetIdx];
        if (!target) errors.push(`${a.id}: target_activity "${a.target_activity}" not found`);
        else if (target.type !== 'email_send') errors.push(`${a.id}: target_activity must be an email_send`);
        else if (targetIdx >= selfIdx) errors.push(`${a.id}: target_activity must be a preceding (earlier) activity`);
      }
      if (!Number.isFinite(a.timeout_hours) || a.timeout_hours <= 0) errors.push(`${a.id}: timeout_hours must be positive`);
      nextRefs.push(a.on_event_next, a.on_timeout_next);
      break;
    case 'engagement_split':
      if (!a.send_activity_id || !all.some(x => x.id === a.send_activity_id && x.type === 'email_send'))
        errors.push(`${a.id}: send_activity_id must reference an email_send`);
      if (!['opened', 'clicked'].includes(a.metric)) errors.push(`${a.id}: metric must be opened or clicked`);
      nextRefs.push(a.yes_next, a.no_next);
      break;
  }
  for (const ref of nextRefs) {
    if (ref === null || ref === undefined) continue;
    if (!ids.has(ref)) errors.push(`${a.id}: next "${ref}" does not reference an existing activity id`);
  }
}

function hasCycle(dsl) {
  const map = new Map(dsl.activities.map(a => [a.id, a]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...map.keys()].map(k => [k, WHITE]));
  function dfs(id) {
    if (!id || !map.has(id)) return false;
    if (color.get(id) === GRAY) return true;
    if (color.get(id) === BLACK) return false;
    color.set(id, GRAY);
    const a = map.get(id);
    const nexts = collectNexts(a);
    for (const n of nexts) if (dfs(n)) return true;
    color.set(id, BLACK);
    return false;
  }
  return dsl.activities.some(a => dfs(a.id));
}

function collectNexts(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send': return [a.next];
    case 'decision_split': return [...(a.branches || []).map(b => b.next), a.default_next];
    case 'wait_until_event': return [a.on_event_next, a.on_timeout_next];
    case 'engagement_split': return [a.yes_next, a.no_next];
    default: return [];
  }
}
