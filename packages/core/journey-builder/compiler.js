export function compileDslToInteraction(dsl, { target_de_key }) {
  const key = `journey-${dsl.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}`;
  return {
    key,
    name: dsl.name,
    description: 'Built by AgentOS Journey Builder',
    workflowApiVersion: 1.0,
    status: 'Draft',
    triggers: [buildTrigger(target_de_key)],
    goals: [],
    activities: dsl.activities.map((a) => compileActivity(a)),
    defaults: { email: [], properties: { analyticsTracking: { enabled: false } } },
  };
}

function buildTrigger(target_de_key) {
  return {
    key: 'trigger-1',
    name: 'Entry',
    type: 'AutomationAudience',
    eventDefinitionKey: null,
    configurationArguments: { dataExtensionId: target_de_key },
    metaData: {
      eventDefinitionId: null,
      sourceInteractionId: '00000000-0000-0000-0000-000000000000',
    },
  };
}

function compileActivity(a) {
  const base = { key: a.id, name: a.id, outcomes: [] };
  switch (a.type) {
    case 'wait_duration':
      return {
        ...base,
        type: 'WAITBYDURATION',
        configurationArguments: { waitDuration: a.amount, waitUnit: unitToSfmc(a.unit) },
        outcomes: a.next ? [{ key: `${a.id}-out`, next: a.next, arguments: {} }] : [],
      };
    case 'decision_split':
      return {
        ...base,
        type: 'MULTICRITERIADECISION',
        configurationArguments: {},
        outcomes: [
          ...a.branches.map((b, i) => ({
            key: `${a.id}-br-${i}`,
            next: b.next,
            arguments: { criteriaDescription: b.label, expression: b.condition },
          })),
          ...(a.default_next
            ? [{ key: `${a.id}-default`, next: a.default_next, arguments: { criteriaDescription: 'default' } }]
            : []),
        ],
      };
    case 'email_send':
      if (a.mc_email_id == null) {
        throw new Error(`email_send ${a.id} has no mc_email_id (shells not created?)`);
      }
      return {
        ...base,
        type: 'EMAILV2',
        configurationArguments: {
          triggeredSend: {
            emailId: a.mc_email_id,
            name: a.email_shell_name,
            autoAddSubscribers: true,
            autoUpdateSubscribers: true,
          },
        },
        outcomes: a.next ? [{ key: `${a.id}-out`, next: a.next, arguments: {} }] : [],
      };
    case 'wait_until_event':
      return {
        ...base,
        type: 'WAITBYEVENT',
        configurationArguments: {
          event: a.event,
          targetActivityKey: a.target_activity,
          timeoutHours: a.timeout_hours,
        },
        outcomes: [
          ...(a.on_event_next
            ? [{ key: `${a.id}-event`, next: a.on_event_next, arguments: { path: 'event' } }]
            : []),
          ...(a.on_timeout_next
            ? [{ key: `${a.id}-timeout`, next: a.on_timeout_next, arguments: { path: 'timeout' } }]
            : []),
        ],
      };
    case 'engagement_split':
      return {
        ...base,
        type: 'ENGAGEMENTSPLIT',
        configurationArguments: { sendActivityKey: a.send_activity_id, metric: a.metric },
        outcomes: [
          ...(a.yes_next ? [{ key: `${a.id}-yes`, next: a.yes_next, arguments: { path: 'yes' } }] : []),
          ...(a.no_next ? [{ key: `${a.id}-no`, next: a.no_next, arguments: { path: 'no' } }] : []),
        ],
      };
    default:
      throw new Error(`unknown activity type: ${a.type}`);
  }
}

function unitToSfmc(u) {
  return { minutes: 'Minutes', hours: 'Hours', days: 'Days', weeks: 'Weeks' }[u];
}
