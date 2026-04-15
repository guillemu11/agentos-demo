import { CAMPAIGN_TYPES } from '../campaign-builder/index.js';

export const JOURNEY_TOOLS = [
  {
    name: 'inspect_master_de',
    description: 'Fetch schema (columns + types) and 5 sample rows from a Master Data Extension. Required BEFORE writing SQL for the entry source.',
    input_schema: {
      type: 'object',
      properties: { de_name: { type: 'string' } },
      required: ['de_name'],
    },
  },
  {
    name: 'set_entry_source',
    description: 'Define the entry of the journey: Master DE + SQL query + target DE name.',
    input_schema: {
      type: 'object',
      properties: {
        master_de: { type: 'string' },
        sql: { type: 'string', description: 'SELECT query over master_de. No DROP/UPDATE/DELETE.' },
        target_de_name: { type: 'string' },
      },
      required: ['master_de', 'sql', 'target_de_name'],
    },
  },
  {
    name: 'add_activity',
    description: 'Append a new activity to the journey. Valid types: wait_duration, decision_split, email_send, wait_until_event, engagement_split.',
    input_schema: {
      type: 'object',
      properties: {
        activity: { type: 'object' },
        after_id: { type: ['string', 'null'], description: 'The id of the activity after which to insert. null to append at the entry.' },
      },
      required: ['activity'],
    },
  },
  {
    name: 'update_activity',
    description: 'Patch an existing activity by id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, patch: { type: 'object' } },
      required: ['id', 'patch'],
    },
  },
  {
    name: 'remove_activity',
    description: 'Remove an activity by id and relink neighbors.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'validate_journey',
    description: 'Run validation and return human-readable errors without mutating.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'deploy_journey_draft',
    description: 'Deploy the journey to Marketing Cloud as a Draft. Runs: folder → target DE → SQL query → email shells → Interaction POST. Always Draft, never Active.',
    input_schema: { type: 'object', properties: {} },
  },
];

export const CAMPAIGN_TYPE_KEYS = Object.keys(CAMPAIGN_TYPES);
