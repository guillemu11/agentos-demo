import { CAMPAIGN_TYPES, duplicateEmail as defaultDuplicateEmail } from '../campaign-builder/index.js';

export async function createEmailShells({ mc, dsl, folderId, duplicateEmail = defaultDuplicateEmail }) {
  const updated = { ...dsl, activities: [...dsl.activities] };
  const dateCode = fmtDate(new Date());

  for (let i = 0; i < updated.activities.length; i++) {
    const a = updated.activities[i];
    if (a.type !== 'email_send') continue;
    if (a.mc_email_id != null) continue;

    const type = CAMPAIGN_TYPES[a.campaign_type];
    if (!type) throw new Error(`campaign_type "${a.campaign_type}" not in CAMPAIGN_TYPES`);

    const { assetId } = await duplicateEmail(mc, {
      sourceAssetId: type.templates.noCugoCode,
      newName: a.email_shell_name,
      categoryId: folderId,
      attributes: {
        attr1: 'pr',
        attr2: 'ek',
        attr3: `${dsl.name}_deploydate_in`,
        attr4: 'xx',
        attr5: `${type.attr5Code}_${dateCode}`,
      },
    });
    updated.activities[i] = { ...a, mc_email_id: assetId };
  }
  return updated;
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}`;
}
