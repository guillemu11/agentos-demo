import dagre from '@dagrejs/dagre';

const NODE_W = 260;
const NODE_H = 110;

export function autoLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

export function dslToGraph(dsl) {
  if (!dsl) return { nodes: [], edges: [] };
  const nodes = [];
  const edges = [];

  if (dsl.entry) {
    nodes.push({ id: '__entry__', type: 'entry', data: { source: dsl.entry.source }, position: { x: 0, y: 0 } });
    const firstId = dsl.activities?.[0]?.id;
    if (firstId) edges.push({ id: `e-entry-${firstId}`, source: '__entry__', target: firstId, type: 'animated' });
  }

  for (const a of dsl.activities || []) {
    nodes.push({ id: a.id, type: nodeTypeFor(a.type), data: { activity: a }, position: { x: 0, y: 0 } });
    for (const { to, label } of nextsOf(a)) {
      if (!to) continue;
      edges.push({ id: `e-${a.id}-${to}-${label || 'n'}`, source: a.id, target: to, label, type: 'animated' });
    }
  }
  return { nodes: autoLayout(nodes, edges), edges };
}

function nodeTypeFor(t) {
  return ({
    wait_duration: 'waitDuration',
    decision_split: 'decisionSplit',
    email_send: 'emailSend',
    wait_until_event: 'waitUntilEvent',
    engagement_split: 'engagementSplit',
  })[t] || 'default';
}

function nextsOf(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send':
      return [{ to: a.next }];
    case 'decision_split':
      return [
        ...(a.branches || []).map((b) => ({ to: b.next, label: b.label })),
        ...(a.default_next ? [{ to: a.default_next, label: 'default' }] : []),
      ];
    case 'wait_until_event':
      return [
        { to: a.on_event_next, label: 'event' },
        { to: a.on_timeout_next, label: 'timeout' },
      ];
    case 'engagement_split':
      return [
        { to: a.yes_next, label: 'yes' },
        { to: a.no_next, label: 'no' },
      ];
    default:
      return [];
  }
}
