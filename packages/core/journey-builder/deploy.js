import { validateDsl } from './dsl-schema.js';
import { compileDslToInteraction } from './compiler.js';
import {
  createQueryActivity as _createQueryActivity,
  startQueryActivity as _startQueryActivity,
  pollQueryActivity as _pollQueryActivity,
} from './query-activity.js';
import { createEmailShells as _createEmailShells } from './shells.js';
import { ensureFolderHierarchy as _ensureFolderHierarchy } from '../campaign-builder/index.js';
import { createDataExtensionRaw, createInteraction } from '../mc-api/executor.js';

export async function deployJourney({ mc, dsl, config }, overrides = {}) {
  const {
    ensureFolderHierarchy = _ensureFolderHierarchy,
    createDataExtension = createDataExtensionRaw,
    createQueryActivity = _createQueryActivity,
    startQueryActivity = _startQueryActivity,
    pollQueryActivity = _pollQueryActivity,
    createEmailShells = _createEmailShells,
    createInteractionDraft = createInteraction,
  } = overrides;

  const { valid, errors } = validateDsl(dsl);
  if (!valid) throw new Error(`Invalid DSL: ${errors.join('; ')}`);

  const { emailFolderId, deFolderId } = await ensureFolderHierarchy(mc, { ...config, name: dsl.name });

  const targetDe = await createDataExtension(mc, {
    name: dsl.entry.source.target_de_name,
    folderId: deFolderId,
    fields: defaultEntrySchema(),
  });

  const query = await createQueryActivity(mc, {
    name: `${dsl.name}_Query`,
    sql: dsl.entry.source.sql,
    target_de_key: targetDe.customerKey,
    target_update_type: 'Overwrite',
  });
  await startQueryActivity(mc, query.queryDefinitionId);
  await pollQueryActivity(mc, query.queryDefinitionId, { intervalMs: 2000, timeoutMs: 180000 });

  const withShells = await createEmailShells({ mc, dsl, folderId: emailFolderId });

  const interactionJson = compileDslToInteraction(withShells, { target_de_key: targetDe.customerKey });
  const interaction = await createInteractionDraft(mc, interactionJson);

  return {
    dsl: withShells,
    mc_interaction_id: interaction.id,
    mc_target_de_key: targetDe.customerKey,
    mc_query_activity_id: query.queryDefinitionId,
  };
}

function defaultEntrySchema() {
  return [
    { name: 'contact_key', fieldType: 'Text', maxLength: 254, isPrimaryKey: true, isRequired: true },
    { name: 'email', fieldType: 'EmailAddress', isRequired: true },
    { name: 'tier', fieldType: 'Text', maxLength: 50 },
    { name: 'language', fieldType: 'Text', maxLength: 20 },
  ];
}
