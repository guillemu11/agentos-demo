const TYPE_PREFIX = {
  wait_duration: 'WAITBYDURATION',
  decision_split: 'MULTICRITERIADECISION',
  email_send: 'EMAILV2',
  wait_until_event: 'WAITBYEVENT',
  engagement_split: 'ENGAGEMENTSPLIT',
};

export function compileDslToInteraction(dsl, { target_de_key, event_definition_key }) {
  const key = `journey-${dsl.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}`;

  // MC Journey Builder UI reads the key prefix to pick the activity icon/renderer.
  // Keys MUST match `{TYPE}-{index}` (e.g. EMAILV2-1, WAITBYDURATION-2). Our DSL uses
  // human ids like `send_hero`; here we translate them to MC keys and rewrite all
  // outcome.next references to match.
  const idToKey = {};
  const nameById = {};
  const typeCounter = {};
  for (const a of dsl.activities) {
    const prefix = TYPE_PREFIX[a.type];
    if (!prefix) throw new Error(`unknown activity type: ${a.type}`);
    typeCounter[prefix] = (typeCounter[prefix] || 0) + 1;
    idToKey[a.id] = `${prefix}-${typeCounter[prefix]}`;
    nameById[a.id] = humanName(a);
  }

  const translate = (nextId) => (nextId && idToKey[nextId]) || null;

  // Minimal root shape — match what worked on the first deploy. Server-managed
  // fields (id, definitionId, scheduledStatus, version, exits, notifiers, metaData)
  // must NOT be sent on POST or MC's deserializer rejects with "Location Unknown".
  return {
    key,
    name: dsl.name,
    description: 'Built by AgentOS Journey Builder',
    workflowApiVersion: 1,
    status: 'Draft',
    triggers: [buildTrigger(target_de_key, event_definition_key)],
    goals: [],
    activities: dsl.activities.map((a) => compileActivity(a, idToKey, nameById, translate)),
    defaults: { email: [], properties: { analyticsTracking: { enabled: false } } },
  };
}

function buildTrigger(target_de_key, event_definition_key) {
  // If we have an eventDefinitionKey (DEAudience-{GUID}) from creating an event definition,
  // use EmailAudience trigger — MC JB canvas shows the DE name and it's the correct entry type.
  // Fallback to AutomationAudience when no event def (older deploys / missing permissions).
  if (event_definition_key) {
    return {
      key: 'trigger-1',
      name: 'Entry',
      type: 'EmailAudience',
      arguments: {},
      configurationArguments: {},
      metaData: {
        eventDefinitionId: null,
        eventDefinitionKey: event_definition_key,
        chainType: 'none',
        configurationRequired: false,
        iconUrl: '/images/icon-data-extension.svg',
        title: 'Data Extension',
        entrySourceGroupConfigUrl: 'jb:///data/entry/audience/entrysourcegroupconfig.json',
      },
    };
  }
  return {
    key: 'trigger-1',
    name: 'Entry',
    type: 'AutomationAudience',
    eventDefinitionKey: '',
    arguments: {},
    configurationArguments: { dataExtensionId: target_de_key },
    metaData: {
      eventDefinitionId: '',
      sourceInteractionId: '00000000-0000-0000-0000-000000000000',
    },
  };
}

function compileActivity(a, idToKey, nameById, translate) {
  const key = idToKey[a.id];
  const base = {
    key,
    name: humanName(a),
    outcomes: [],
    arguments: {},
    metaData: { isConfigured: true },
  };
  switch (a.type) {
    case 'wait_duration':
      return {
        ...base,
        type: 'WAIT',
        configurationArguments: {
          waitDuration: a.amount,
          waitUnit: unitToSfmc(a.unit),
          specifiedTime: '00:00',
          timeZone: 'Arabian Standard Time',
          description: '',
          waitEndDateAttributeExpression: '',
          specificDate: '',
          waitForEventKey: '',
        },
        metaData: { isConfigured: true, isExtended: false, waitType: 'duration', uiType: 'WAITBYDURATION' },
        outcomes: a.next
          ? [{ key: `${key}-out`, next: translate(a.next), arguments: {}, metaData: {} }]
          : [{ key: `${key}-out`, arguments: {}, metaData: {} }],
      };
    case 'decision_split':
      return {
        ...base,
        type: 'MULTICRITERIADECISION',
        configurationArguments: {},
        outcomes: [
          ...(a.branches || []).map((b, i) => ({
            key: `${key}-br-${i}`,
            next: translate(b.next),
            arguments: {},
            metaData: { label: b.label, criteriaDescription: b.condition },
          })),
          ...(a.default_next
            ? [{
                key: `${key}-default`,
                next: translate(a.default_next),
                arguments: {},
                metaData: { label: 'default' },
              }]
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
            isSalesforceTracking: false,
            isMultipart: false,
            isSendLogging: false,
            suppressTracking: false,
          },
          applicationExtensionKey: 'jb-email-activity',
          isModified: false,
          isSimulation: false,
        },
        outcomes: a.next
          ? [{ key: `${key}-out`, next: translate(a.next), arguments: {}, metaData: {} }]
          : [{ key: `${key}-out`, arguments: {}, metaData: {} }],
      };
    case 'wait_until_event':
      return {
        ...base,
        type: 'WAITBYEVENT',
        configurationArguments: {
          event: a.event,
          targetActivityKey: idToKey[a.target_activity] || a.target_activity,
          timeoutHours: a.timeout_hours,
        },
        outcomes: [
          ...(a.on_event_next
            ? [{ key: `${key}-event`, next: translate(a.on_event_next), arguments: {}, metaData: { label: 'event' } }]
            : []),
          ...(a.on_timeout_next
            ? [{ key: `${key}-timeout`, next: translate(a.on_timeout_next), arguments: {}, metaData: { label: 'timeout' } }]
            : []),
        ],
      };
    case 'engagement_split': {
      const refKey = idToKey[a.send_activity_id] || a.send_activity_id;
      const refName = nameById[a.send_activity_id] || refKey;
      return {
        ...base,
        type: 'ENGAGEMENTDECISION',
        configurationArguments: {
          refActivityCustomerKey: refKey,
          statsTypeId: metricToStatsTypeId(a.metric),
          engagementUrls: { urls: [] },
        },
        metaData: { isConfigured: true, refActivityName: refName },
        outcomes: [
          ...(a.yes_next
            ? [{ key: `${key}-yes`, next: translate(a.yes_next), arguments: {}, metaData: { label: 'Yes' } }]
            : []),
          ...(a.no_next
            ? [{ key: `${key}-no`, next: translate(a.no_next), arguments: {}, metaData: { label: 'No' } }]
            : []),
        ],
      };
    }
    default:
      throw new Error(`unknown activity type: ${a.type}`);
  }
}

function humanName(a) {
  if (a.type === 'email_send' && a.email_shell_name) return a.email_shell_name;
  return a.id;
}

function unitToSfmc(u) {
  return { minutes: 'MINUTES', hours: 'HOURS', days: 'DAYS', weeks: 'WEEKS' }[u];
}

// MC statsTypeId: 1=Sent, 2=Opened, 3=Clicked, 4=Unsubscribed
function metricToStatsTypeId(metric) {
  return { sent: 1, opened: 2, clicked: 3, unsubscribed: 4 }[metric] ?? 2;
}
