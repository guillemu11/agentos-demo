export function addActivity(dsl, { activity, after_id }) {
  const activities = [...dsl.activities, activity];
  if (after_id) {
    const idx = activities.findIndex((a) => a.id === after_id);
    if (idx >= 0) {
      const prev = activities[idx];
      activities[idx] = relinkNext(prev, null, activity.id);
    }
  }
  return { ...dsl, activities };
}

export function updateActivity(dsl, { id, patch }) {
  return {
    ...dsl,
    activities: dsl.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function removeActivity(dsl, { id }) {
  const target = dsl.activities.find((a) => a.id === id);
  if (!target) return dsl;
  const targetNext = pickPrimaryNext(target);
  const activities = dsl.activities
    .filter((a) => a.id !== id)
    .map((a) => relinkNext(a, id, targetNext));
  return { ...dsl, activities };
}

export function setEntrySource(dsl, { master_de, sql, target_de_name }) {
  return {
    ...dsl,
    entry: {
      source: { type: 'master_de_query', master_de_key: master_de, sql, target_de_name },
    },
  };
}

function pickPrimaryNext(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send':
      return a.next;
    case 'decision_split':
      return a.default_next || a.branches?.[0]?.next || null;
    case 'wait_until_event':
      return a.on_event_next || a.on_timeout_next || null;
    case 'engagement_split':
      return a.yes_next || a.no_next || null;
    default:
      return null;
  }
}

function relinkNext(activity, fromId, toId) {
  const remap = (v) => (v === fromId ? toId : v);
  switch (activity.type) {
    case 'wait_duration':
    case 'email_send':
      return { ...activity, next: remap(activity.next) };
    case 'decision_split':
      return {
        ...activity,
        branches: (activity.branches || []).map((b) => ({ ...b, next: remap(b.next) })),
        default_next: remap(activity.default_next),
      };
    case 'wait_until_event':
      return { ...activity, on_event_next: remap(activity.on_event_next), on_timeout_next: remap(activity.on_timeout_next) };
    case 'engagement_split':
      return { ...activity, yes_next: remap(activity.yes_next), no_next: remap(activity.no_next) };
    default:
      return activity;
  }
}
