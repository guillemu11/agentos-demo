import { CAMPAIGN_TYPES, duplicateEmail as defaultDuplicateEmail } from '../campaign-builder/index.js';

export async function createEmailShells({ mc, dsl, folderId, nameSuffix, duplicateEmail = defaultDuplicateEmail }) {
  const updated = { ...dsl, activities: [...dsl.activities] };
  const now = new Date();
  const dateCode = fmtDate(now);
  // SFMC enforces unique asset names within a category & type — including
  // soft-deleted assets in the recycle bin. Stamp shell names so retries
  // never collide. If caller passes nameSuffix, use that (so DE/query/shells
  // share one stamp per deploy); otherwise build one here.
  const stamp = nameSuffix || fmtStamp(now);

  for (let i = 0; i < updated.activities.length; i++) {
    const a = updated.activities[i];
    if (a.type !== 'email_send') continue;
    if (a.mc_email_id != null) continue;

    const type = CAMPAIGN_TYPES[a.campaign_type];
    if (!type) throw new Error(`campaign_type "${a.campaign_type}" not in CAMPAIGN_TYPES`);

    const stampedName = `${a.email_shell_name}_${stamp}`;
    const { assetId } = await duplicateEmail(mc, {
      sourceAssetId: type.templates.noCugoCode,
      newName: stampedName,
      categoryId: folderId,
      attributes: {
        attr1: 'pr',
        attr2: 'ek',
        attr3: `${dsl.name}_deploydate_in`,
        attr4: 'xx',
        attr5: `${type.attr5Code}_${dateCode}`,
      },
    });
    // Persist the stamped name + assetId on the activity so the compiler
    // emits the correct triggeredSend.name and the user sees the real shell name
    updated.activities[i] = { ...a, mc_email_id: assetId, email_shell_name: stampedName };
  }
  return updated;
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}`;
}

function fmtStamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
