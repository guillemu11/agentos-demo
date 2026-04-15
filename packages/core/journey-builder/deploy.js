import { validateDsl } from './dsl-schema.js';
import { BAU_MASTER_SCHEMA } from './bau-master-schema.js';
import { compileDslToInteraction } from './compiler.js';
import { createQueryActivity as _createQueryActivity } from './query-activity.js';
import { createEmailShells as _createEmailShells } from './shells.js';
import { ensureFolderHierarchy as _ensureFolderHierarchy } from '../campaign-builder/index.js';
import { createDataExtensionRaw, createInteraction, createEventDefinition as _createEventDefinition, ensureQueryFolder as _ensureQueryFolder } from '../mc-api/executor.js';

export async function deployJourney({ mc, dsl, config }, overrides = {}) {
  const {
    ensureFolderHierarchy = _ensureFolderHierarchy,
    createDataExtension = createDataExtensionRaw,
    createQueryActivity = _createQueryActivity,
    createEmailShells = _createEmailShells,
    createInteractionDraft = createInteraction,
    createEventDef = _createEventDefinition,
    ensureQueryFolder = _ensureQueryFolder,
    masterSchema, // optional: pass cached master DE columns for schema inference
  } = overrides;

  const { valid, errors } = validateDsl(dsl);
  if (!valid) throw new Error(`Invalid DSL: ${errors.join('; ')}`);

  // Build folder hierarchy args in the shape BAU ensureFolderHierarchy expects.
  // Journeys land under a year/month/journey-name folder tree (same as BAU campaigns).
  const now = new Date();
  const year = String(now.getFullYear());
  const yearMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const campaignFolderName = dsl.name;
  const { emailFolderId, deFolderId } = await ensureFolderHierarchy(mc, {
    year,
    yearMonth,
    campaignFolderName,
    variant: config?.variant || 'Ecommerce',
  });

  // Derive the target DE schema from the SELECT list of the entry SQL.
  // Types come from the master schema (if provided) — otherwise reasonable defaults.
  const selectedCols = parseSelectColumns(dsl.entry.source.sql);
  // BAU_MASTER_SCHEMA is the hardcoded fallback — fetchDeSchemaCompact may fail
  // silently (permissions, network) and return null. Without this fallback every
  // Text field would default to maxLength 254 and heuristics would mistype fields
  // like threshold_destination (Text 20) as Date.
  const fields = buildTargetDeFields(selectedCols, masterSchema || BAU_MASTER_SCHEMA);

  // Add a short timestamp suffix to the DE + Query names so retries after a
  // partial failure don't collide with half-created SFMC resources. Same suffix
  // across the two so they're visibly paired in MC UI.
  const stamp = buildStamp(new Date());
  const targetDeName = `${dsl.entry.source.target_de_name}_${stamp}`;
  const queryName = `${dsl.name}_Query_${stamp}`;

  const targetDe = await createDataExtension(mc, {
    name: targetDeName,
    folderId: deFolderId,
    fields,
    isSendable: true,
    sendableField: fields.find((f) => f.fieldType === 'EmailAddress')?.name || 'EmailAddress',
  });

  // SFMC requires a valid queryactivity folder categoryId.
  // Find/create "Journey Builder" under the Query root; cached after first call.
  const queryFolderId = await ensureQueryFolder(mc, 'Journey Builder');

  const query = await createQueryActivity(mc, {
    name: queryName,
    sql: dsl.entry.source.sql,
    target_de_key: targetDe.customerKey,
    target_update_type: 'Overwrite',
    categoryId: Number(queryFolderId),
  });
  // Intentionally NOT running the query here. Deploying a Draft = creating
  // structure (DE, query activity, email shells, Interaction). The query
  // executes later: either when an admin launches it manually in MC Automation
  // Studio, or when the journey is activated and its scheduled automation
  // runs the query to populate the entry DE. Running it during deploy
  // against a 14M-row master DE would block for minutes and isn't needed
  // to land a Draft in MC.

  // Pass the same stamp so DE / Query / email shells share a unified deploy timestamp.
  const withShells = await createEmailShells({ mc, dsl, folderId: emailFolderId, nameSuffix: stamp });

  // Create an event definition so the EmailAudience trigger can display the DE name
  // in JB canvas. Non-fatal: falls back to AutomationAudience trigger if it fails.
  const eventDefinitionKey = await createEventDef(mc, {
    name: `${targetDeName}_EventDef`,
    dataExtensionKey: targetDe.customerKey,
  });

  const interactionJson = compileDslToInteraction(withShells, {
    target_de_key: targetDe.customerKey,
    event_definition_key: eventDefinitionKey,
  });
  const interaction = await createInteractionDraft(mc, interactionJson);

  return {
    dsl: withShells,
    mc_interaction_id: interaction.id,
    mc_target_de_key: targetDe.customerKey,
    mc_query_activity_id: query.queryDefinitionId,
    folders: { emailFolderId, deFolderId },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract column names from the SELECT clause of a single-statement SQL string.
 * Handles TOP N, newlines, aliases (AS foo), and bracketed identifiers.
 * Returns a list of base column names (without alias) in order.
 */
export function parseSelectColumns(sql) {
  if (!sql) return [];
  // Find content between SELECT ... FROM
  const m = sql.match(/select\s+(?:top\s+\d+\s+)?([\s\S]+?)\s+from\b/i);
  if (!m) return [];
  const cols = m[1]
    .split(',')
    .map((c) => c.trim().replace(/\s+/g, ' '))
    .map((c) => {
      // Strip alias: "ContactKey AS ck" → "ContactKey"
      const aliased = c.match(/^(.+?)\s+as\s+[\w[\]]+$/i);
      const base = aliased ? aliased[1] : c.split(/\s+/)[0];
      // Strip brackets
      return base.replace(/^\[/, '').replace(/\]$/, '');
    })
    .filter(Boolean);
  return cols;
}

/**
 * Build target DE fields array. For each selected column, look up its type in
 * masterSchema (the cached schema from inspect_master_de). If not found,
 * fall back to sensible heuristics by column name.
 */
export function buildTargetDeFields(columns, masterSchema) {
  const byName = new Map();
  if (masterSchema?.columns) {
    for (const c of masterSchema.columns) byName.set(c.name.toLowerCase(), c);
  }

  return columns.map((colName, i) => {
    const match = byName.get(colName.toLowerCase());
    const type = match?.type || inferType(colName);
    const field = { name: colName, fieldType: type };
    if (type === 'Text') field.maxLength = match?.max || 254;
    if (type === 'Decimal' && match?.max) field.maxLength = match.max;
    // The first column is the primary key by default
    if (i === 0) {
      field.isPrimaryKey = true;
      field.isRequired = true;
    }
    if (type === 'EmailAddress') field.isRequired = true;
    return field;
  });
}

function buildStamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function inferType(name) {
  // Last-resort heuristic — only fires when both masterSchema AND BAU_MASTER_SCHEMA
  // miss the column. Keep rules narrow to avoid false positives.
  // Known false positive removed: endsWith('on') matched 'destination' → Date.
  const n = name.toLowerCase();
  if (n.includes('email')) return 'EmailAddress';
  if (n.includes('_date') || n.endsWith('date') || n.endsWith('_at')) return 'Date';
  if (n.includes('amount') || n.includes('price') || n.includes('spend')) return 'Decimal';
  if (n.startsWith('is_') || n.startsWith('has_') || n.endsWith('_flag') || n.endsWith('_yn')) return 'Boolean';
  return 'Text';
}
