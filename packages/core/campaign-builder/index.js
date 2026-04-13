/**
 * BAU Campaign Builder — Emirates Campaign Creation Engine
 *
 * Creates complete BAU campaigns in Marketing Cloud:
 *   1. Create folder hierarchy (CB + DE)
 *   2. Duplicate email template with attributes
 *   3. Duplicate placeholder DEs with same schema
 *   4. Upload images to MC
 *   5. Fill DE rows with campaign content
 *
 * Usage:
 *   import { buildBAUCampaign } from '../packages/core/campaign-builder/index.js';
 *   const result = await buildBAUCampaign(mcClient, config);
 */

// ─── Campaign Type Registry ────────────────────────────────────────────────────
// Maps campaign type to: template IDs, DE placeholders, attribute codes, folder codes

export const CAMPAIGN_TYPES = {
  'holiday-offer': {
    name: 'Holiday Offer',
    code: 'HO',
    attr5Code: 'CCHOLIOFFR',
    templateFolder: 'Holiday Offer',
    templates: {
      noCugoCode: 44791,
      withCugoCode: 23856,
    },
    placeholderDEs: [
      { name: 'CampaignName_Date_HO_DynamicContent', key: 'BDD2553B-AC54-4EB1-9050-85216E1FED3E', suffix: '_HO_DynamicContent' },
      { name: 'CampaignName_Date_HO_Stories', key: '012C0FAC-84A7-45E9-A8D7-3292750ED97D', suffix: '_HO_Stories' },
    ],
    deFolder: 'Holiday Offer',
  },
  'product-offer-ecommerce': {
    name: 'Product Offer (Ecommerce)',
    code: 'PO',
    attr5Code: 'CCPRODOFFR',
    templateFolder: 'Product Offer > Ecommerce',
    templates: {
      noCugoCode: 44793,
      withCugoCode: 44794,
    },
    placeholderDEs: [
      { name: 'CampaignName_Date_PO_DynamicContent_ecommerce', key: 'ED36F7AC-B7C5-482A-A61F-3104DDE5D925', suffix: '_PO_DynamicContent' },
      { name: 'CampaignName_Date_PO_Products_ecommerce', key: 'FE157774-28BF-4F37-86F1-E591C7D19F2D', suffix: '_PO_Products' },
      { name: 'CampaignName_Date_PO_CashMiles_ecommerce', key: '39E51CD8-3022-4691-B0C4-7B7DF99C7782', suffix: '_PO_CashMiles' },
    ],
    deFolder: 'Product Offer',
  },
  'product-offer-skywards': {
    name: 'Product Offer (Skywards)',
    code: 'PO',
    attr5Code: 'CCPRODOFFR',
    templateFolder: 'Product Offer > Skywards',
    templates: {
      noCugoCode: 44803,
      withCugoCode: 44802,
    },
    placeholderDEs: [
      { name: 'CampaignName_Date_PO_DynamicContent_Skywards', key: '09219995-56E1-4809-968F-ECCD4ED9B7FF', suffix: '_PO_DynamicContent' },
      { name: 'CampaignName_Date_PO_Products_Skywards', key: '0B51A81D-0400-414C-B031-BD88BCBB1142', suffix: '_PO_Products' },
      { name: 'CampaignName_Date_PO_CashMiles_Skywards', key: '76765D13-6F07-4C6D-9E8D-B87FE2BF879C', suffix: '_PO_CashMiles' },
    ],
    deFolder: 'Product Offer',
  },
  'partner-offer': {
    name: 'Partner Offer',
    code: 'PR',
    attr5Code: 'CCPARTOFFR',
    templateFolder: 'Partner Offer',
    templates: {
      noCugoCode: 23867,
      withCugoCode: 23868,
      withOfferCode: 32100,
    },
    placeholderDEs: [
      { name: 'CampaignName_Date_PR_DynamicContent', key: 'CampaignName_Date_PR_DynamicContent', suffix: '_PR_DynamicContent' },
      { name: 'CampaignName_Date_PR_Products', key: 'CampaignName_Date_PR_Products', suffix: '_PR_Products' },
    ],
    deFolder: 'Partner Offer',
  },
  'partner-launch': {
    name: 'Partner Launch',
    code: 'PL',
    attr5Code: 'CCPARTLAUN',
    templateFolder: 'Partner Launch',
    templates: {
      noCugoCode: 23876,
      withCugoCode: 23875,
    },
    placeholderDEs: [
      { name: 'CampaignName_Date_PL_DynamicContent', key: '3110FE8A-9FA3-4A1A-9F5B-ECA3C8F9C165', suffix: '_PL_DynamicContent' },
    ],
    deFolder: 'Partner Launch',
  },
  'route-launch': {
    name: 'Route Launch',
    code: 'RL',
    attr5Code: 'CCROUTELCH',
    templateFolder: 'Route Launch (new)',
    templates: { default: 44801 },
    placeholderDEs: [
      { name: 'CampaignName_Date_RL_DynamicContent', key: '2A26390E-7719-4B7B-A2FA-59379EE26E04', suffix: '_RL_DynamicContent' },
    ],
    deFolder: 'Route Launch',
  },
  'route-launch-inbound': {
    name: 'Route Launch Inbound',
    code: 'RLIB',
    attr5Code: 'CCROUTELCH',
    templateFolder: 'Route Launch Inbound',
    templates: { default: 23858 },
    placeholderDEs: [
      { name: 'CampaignName_Date_RLIB_DynamicContent', key: '2CD91DAF-628C-401A-B1B3-2AFA9947D014', suffix: '_RLIB_DynamicContent' },
    ],
    deFolder: 'Route Launch in Bound',
  },
  'route-launch-outbound': {
    name: 'Route Launch Outbound',
    code: 'RLOB',
    attr5Code: 'CCROUTELCH',
    templateFolder: 'Route Launch Outbound',
    templates: { default: 23855 },
    placeholderDEs: [
      { name: 'CampaignName_Date_RLOB_DynamicContent', key: '161B1F20-E45C-42DE-9C7F-807D42FCDCEC', suffix: '_RLOB_DynamicContent' },
    ],
    deFolder: 'Route Launch out Bound',
  },
  'broadcast-emirates': {
    name: 'BroadCast Emirates',
    code: 'BCE',
    attr5Code: 'CCBRDCASTE',
    templateFolder: 'BroadCast Emirates',
    templates: { noCugoCode: 27111, withCugoCode: 27132 },
    placeholderDEs: [
      { name: 'CampaignName_Date_BCE_DynamicContent', key: 'FAE338E2-D936-4052-88E6-0A10927C3B26', suffix: '_BCE_DynamicContent' },
      { name: 'CampaignName_Date_BCE_Products', key: 'A2812230-3091-4DA6-B188-A93E8AF020F6', suffix: '_BCE_Products' },
    ],
    deFolder: 'BroadCast Emirates',
  },
  'event-offer': {
    name: 'Event Offer',
    code: 'EO',
    attr5Code: 'CCEVENTOFF',
    templateFolder: 'Event Offer',
    templates: { noCugoCode: 23863, withCugoCode: 23864 },
    placeholderDEs: [
      { name: 'CampaignName_Date_EO_DynamicContent', key: 'F9F043B8-55C2-4717-95C6-5DF8830B0002', suffix: '_EO_DynamicContent' },
    ],
    deFolder: 'Event Offer',
  },
  'product-update': {
    name: 'Product Update',
    code: 'PU',
    attr5Code: 'CCPRODUPDT',
    templateFolder: 'Product Update',
    templates: { noCugoCode: 44798, withCugoCode: 23869 },
    placeholderDEs: [
      { name: 'CampaignName_Date_PU_DynamicContent', key: 'D69C4826-EDF3-42A9-9FD6-4FA23EFCD98D', suffix: '_PU_DynamicContent' },
    ],
    deFolder: 'Product Update',
  },
  'single-region': {
    name: 'Single Region',
    code: 'SR',
    attr5Code: 'CCSINGREGI',
    templateFolder: 'Single Region',
    templates: { noCugoCode: 29043, withCugoCode: 29042 },
    placeholderDEs: [
      { name: 'CampaignName_Date_SR_DynamicContent', key: '462D8E09-98C0-47E4-A2D2-1E20B504C676', suffix: '_SR_DynamicContent' },
      { name: 'CampaignName_Date_SR_Products', key: 'CDFA915B-552B-49E0-95C4-6833330D4FD7', suffix: '_SR_Products' },
    ],
    deFolder: 'Single Region',
  },
  'newsletter': {
    name: 'Newsletter',
    code: 'NL',
    attr5Code: 'CCNEWSLETR',
    templateFolder: 'Newsletter',
    templates: { default: 23860 },
    placeholderDEs: [
      { name: 'CampaignName_Date_NL_DynamicContent', key: 'A815786C-7DF7-4704-89A2-15120156E2BB', suffix: '_NL_DynamicContent' },
      { name: 'CampaignName_Date_NL_Stories', key: '28448B95-6862-4779-A9F4-6404E77DE515', suffix: '_NL_Stories' },
    ],
    deFolder: 'NewsLetter',
  },
  'occasional-announcement': {
    name: 'Occasional Announcement',
    code: 'OA',
    attr5Code: 'CCOCCANNCE',
    templateFolder: 'Occasional Announcement',
    templates: { noCugoCode: 28826, withCugoCode: 28825 },
    placeholderDEs: [
      { name: 'CampaignName_Date_OA_DynamicContent', key: 'BAABE31D-788D-48F3-83C5-F0717BF12D77', suffix: '_OA_DynamicContent' },
      { name: 'CampaignName_Date_OA_Products', key: 'E2F23BA0-9928-49D0-9C16-8F37A83D5FD8', suffix: '_OA_Products' },
    ],
    deFolder: 'Occasional Announcement',
  },
  'partner-acquisition': {
    name: 'Partner Acquisition',
    code: 'PA',
    attr5Code: 'CCPARTACQS',
    templateFolder: 'Partner Acquisition',
    templates: { noCugoCode: 44818, withCugoCode: 23853 },
    placeholderDEs: [
      { name: 'CampaignName_Date_PA_DynamicContent', key: '65A51273-1C14-422F-B5F2-21C1B3ADFF2E', suffix: '_PA_DynamicContent' },
      { name: 'CampaignName_Date_PA_Products', key: 'CB1A9FFC-783F-47CC-9710-8EA503A5D95E', suffix: '_PA_Products' },
    ],
    deFolder: 'Partner Acquisition',
  },
  'partner-offer-promotion': {
    name: 'Partner Offer Promotion',
    code: 'PRP',
    attr5Code: 'CCPARTPRMO',
    templateFolder: 'Partner Offer Promotion',
    templates: { noCugoCode: 26816, withCugoCode: 26817 },
    placeholderDEs: [
      { name: 'CampaignName_Date_PRP_DynamicContent', key: 'B7D87FAC-F310-4635-B40A-528C9804CAE7', suffix: '_PRP_DynamicContent' },
      { name: 'CampaignName_Date_PRP_Products', key: 'D618CECF-115C-4638-9C18-9DE0D71A1FEB', suffix: '_PRP_Products' },
    ],
    deFolder: 'Partner Offer Promotions',
  },
  'special-announcement': {
    name: 'Special Announcement',
    code: 'SA',
    attr5Code: 'CCSPECANNO',
    templateFolder: 'Special Announcement',
    templates: { default: 26498 },
    placeholderDEs: [
      { name: 'CampaignName_Date_SA_DynamicContent', key: '96DB2FDF-A03E-426A-B14B-291CA91C8408', suffix: '_SA_DynamicContent' },
    ],
    deFolder: 'Special Announcement',
  },
  'survey': {
    name: 'Survey',
    code: 'SS',
    attr5Code: 'CCSURVEYSS',
    templateFolder: 'Survey',
    templates: { default: 37124 },
    placeholderDEs: [
      { name: 'CampaignName_Date_SS_DynamicContent', key: 'D4E13299-9998-4FA5-8219-7DA716B89D76', suffix: '_SS_DynamicContent' },
    ],
    deFolder: 'Survey',
  },
  'new-language-pref': {
    name: 'New Language Pref',
    code: 'NLP',
    attr5Code: 'CCNEWLANGP',
    templateFolder: 'New Language Pref',
    templates: { noCugoCode: 23861, withCugoCode: 23862 },
    placeholderDEs: [
      { name: 'CampaignName_Date_NLP_DynamicContent', key: 'D64F1D86-971E-4931-9CE2-985133ADE758', suffix: '_NLP_DynamicContent' },
    ],
    deFolder: 'New Language Pref',
  },
};

// ─── Helper: SOAP folder operations ────────────────────────────────────────────

function parseSOAPFolders(xml) {
  const results = xml.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];
  return results.map(r => ({
    id: r.match(/<ID>([^<]+)/)?.[1],
    name: r.match(/<Name>([^<]+)/)?.[1],
    parentId: r.match(/<ParentFolder>[\s\S]*?<ID>([^<]+)/)?.[1],
    contentType: r.match(/<ContentType>([^<]+)/)?.[1],
  }));
}

async function findSubfolders(mc, parentId) {
  const xml = await mc.soap('Retrieve', `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataFolder</ObjectType>
      <Properties>ID</Properties>
      <Properties>Name</Properties>
      <Properties>ContentType</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>ParentFolder.ID</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>${parentId}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`);
  return parseSOAPFolders(xml);
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── SOAP shared_dataextension folder creation ─────────────────────────────────
// Key: CustomerKey MUST be included in the SOAP request, otherwise MC returns
// "unknown error". This was discovered empirically — the MC docs don't mention it.

async function createDEFolder(mc, name, parentId) {
  const xml = await mc.soap('Create', `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <Objects xsi:type="DataFolder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <CustomerKey>${escapeXml(name)}</CustomerKey>
      <Name>${escapeXml(name)}</Name>
      <Description></Description>
      <ParentFolder><ID>${parentId}</ID></ParentFolder>
      <ContentType>shared_dataextension</ContentType>
      <IsActive>true</IsActive>
      <IsEditable>true</IsEditable>
      <AllowChildren>true</AllowChildren>
    </Objects>
  </CreateRequest>`);
  const status = xml.match(/<StatusCode>([^<]+)/)?.[1];
  const newId = xml.match(/<NewID>([^<]+)/)?.[1];
  const msg = xml.match(/<StatusMessage>([^<]+)/)?.[1] || '';
  if (status !== 'OK') {
    // Check if duplicate
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      const existing = await findSubfolders(mc, parentId);
      const match = existing.find(f => f.name === name);
      if (match) return match.id;
    }
    throw new Error(`Failed to create DE folder "${name}": ${msg}`);
  }
  return newId;
}

// ─── REST Content Builder category (folder) helpers ────────────────────────────

async function findOrCreateCBCategory(mc, parentId, name, log) {
  // Search existing
  const search = await mc.rest('GET', `/asset/v1/content/categories?$filter=${encodeURIComponent(`parentId eq ${parentId}`)}&$pageSize=50`);
  const existing = (search?.items || []).find(c => c.name === name);
  if (existing) {
    log(`  Found CB: ${name} (ID:${existing.id})`);
    return existing.id;
  }
  // Create new
  log(`  Creating CB: ${name} under ${parentId}...`);
  const created = await mc.rest('POST', '/asset/v1/content/categories', { name, parentId });
  if (!created?.id) throw new Error(`Failed to create CB folder "${name}": ${JSON.stringify(created).substring(0, 300)}`);
  log(`  Created CB: ${name} (ID:${created.id})`);
  return created.id;
}

// ─── Step 1: Ensure folder hierarchy ───────────────────────────────────────────

// Known root IDs discovered via API exploration (tracing real campaign assets)
const CB_ECOMMERCE_ROOT = 307785; // Content Builder > 1. Tier 4 Campaign setups > Ecommerce (ACTIVE, not Archive 287542)
const CB_SKYWARDS_ROOT = 4309;    // Content Builder > 1. Tier 4 Campaign setups > Skywards
const DE_ECOMMERCE_ROOT = 307790; // Shared DE > 1. BAU Tier 4 > Ecommerce
const DE_SKYWARDS_ROOT = 4317;    // Shared DE > 1. BAU Tier 4 > Skywards

/**
 * Create the full folder hierarchy for a campaign in both CB and DE trees.
 * Returns { cbFolderId, deFolderId } — folder IDs for placing assets.
 *
 * CB folders are created via REST (full hierarchy).
 * DE folders use existing hierarchy (SOAP folder creation requires elevated permissions).
 */
export async function ensureFolderHierarchy(mc, config, onProgress) {
  const log = onProgress || (() => {});
  const variant = config.variant || 'Ecommerce';

  // ── CB hierarchy via REST (full creation supported) ───────────────
  log('Creating CB folder hierarchy (REST)...');
  const cbVariantRoot = variant === 'Skywards' ? CB_SKYWARDS_ROOT : CB_ECOMMERCE_ROOT;
  const cbYear = await findOrCreateCBCategory(mc, cbVariantRoot, config.year, log);
  const cbMonth = await findOrCreateCBCategory(mc, cbYear, config.yearMonth, log);
  const cbCampaign = await findOrCreateCBCategory(mc, cbMonth, config.campaignFolderName, log);

  // ── DE hierarchy via SOAP (find or create year > month > campaign) ──
  log('Creating DE folder hierarchy (SOAP)...');
  const deVariantRoot = variant === 'Skywards' ? DE_SKYWARDS_ROOT : DE_ECOMMERCE_ROOT;

  // Year
  const yearFolders = await findSubfolders(mc, deVariantRoot);
  let yearFolder = yearFolders.find(f => f.name === config.year);
  if (yearFolder) {
    log(`  Found DE year: ${yearFolder.name} (ID:${yearFolder.id})`);
  } else {
    log(`  Creating DE year: ${config.year}...`);
    const yearId = await createDEFolder(mc, config.year, deVariantRoot);
    log(`  Created DE year: ${config.year} (ID:${yearId})`);
    yearFolder = { id: yearId, name: config.year };
  }

  // Month
  const monthFolders = await findSubfolders(mc, yearFolder.id);
  let monthFolder = monthFolders.find(f => f.name === config.yearMonth);
  if (monthFolder) {
    log(`  Found DE month: ${monthFolder.name} (ID:${monthFolder.id})`);
  } else {
    log(`  Creating DE month: ${config.yearMonth}...`);
    const monthId = await createDEFolder(mc, config.yearMonth, yearFolder.id);
    log(`  Created DE month: ${config.yearMonth} (ID:${monthId})`);
    monthFolder = { id: monthId, name: config.yearMonth };
  }

  // Campaign
  const campFolders = await findSubfolders(mc, monthFolder.id);
  let campFolder = campFolders.find(f => f.name === config.campaignFolderName);
  if (campFolder) {
    log(`  Found DE campaign: ${campFolder.name} (ID:${campFolder.id})`);
  } else {
    log(`  Creating DE campaign: ${config.campaignFolderName}...`);
    const campId = await createDEFolder(mc, config.campaignFolderName, monthFolder.id);
    log(`  Created DE campaign: ${config.campaignFolderName} (ID:${campId})`);
    campFolder = { id: campId, name: config.campaignFolderName };
  }

  return { cbFolderId: cbCampaign, deFolderId: campFolder.id };
}

// ─── Step 2: Duplicate email template ──────────────────────────────────────────

/**
 * Duplicate an email template with new name, folder, and attributes.
 *
 * @param {object} mc - MC client
 * @param {object} config
 * @param {number} config.sourceAssetId - Template to duplicate
 * @param {string} config.newName - New email name
 * @param {number} config.categoryId - Target CB folder ID
 * @param {object} config.attributes - { attr1, attr2, attr3, attr4, attr5 }
 * @param {function} [onProgress]
 * @returns {{ assetId: number, name: string, customerKey: string }}
 */
export async function duplicateEmail(mc, config, onProgress) {
  const log = onProgress || (() => {});

  log(`Fetching template ${config.sourceAssetId}...`);
  const source = await mc.rest('GET', `/asset/v1/content/assets/${config.sourceAssetId}`);

  // Build the new asset — copy everything except identity fields
  const newAsset = {
    name: config.newName,
    assetType: source.assetType,
    category: { id: config.categoryId },
    views: source.views,
    content: source.content,
    data: {
      ...source.data,
      email: {
        ...source.data?.email,
        attributes: [
          { displayName: '__AdditionalEmailAttribute1', name: '__AdditionalEmailAttribute1', value: config.attributes.attr1 || 'pr', order: 1, channel: 'email', attributeType: 'AdditionalEmailAttribute' },
          { displayName: '__AdditionalEmailAttribute2', name: '__AdditionalEmailAttribute2', value: config.attributes.attr2 || 'ek', order: 2, channel: 'email', attributeType: 'AdditionalEmailAttribute' },
          { displayName: '__AdditionalEmailAttribute3', name: '__AdditionalEmailAttribute3', value: config.attributes.attr3, order: 3, channel: 'email', attributeType: 'AdditionalEmailAttribute' },
          { displayName: '__AdditionalEmailAttribute4', name: '__AdditionalEmailAttribute4', value: config.attributes.attr4 || 'xx', order: 4, channel: 'email', attributeType: 'AdditionalEmailAttribute' },
          { displayName: '__AdditionalEmailAttribute5', name: '__AdditionalEmailAttribute5', value: config.attributes.attr5, order: 5, channel: 'email', attributeType: 'AdditionalEmailAttribute' },
        ],
      },
    },
  };

  // Remove identity fields that would conflict
  delete newAsset.id;
  delete newAsset.customerKey;
  delete newAsset.objectID;

  log(`Creating new email: "${config.newName}"...`);
  const created = await mc.rest('POST', '/asset/v1/content/assets', newAsset);

  if (!created.id) {
    throw new Error(`Failed to create email: ${JSON.stringify(created).substring(0, 300)}`);
  }

  log(`Email created: ID ${created.id}, key ${created.customerKey}`);
  return { assetId: created.id, name: created.name, customerKey: created.customerKey };
}

// ─── Step 3: Duplicate Data Extensions ─────────────────────────────────────────

/**
 * Get the field schema of a placeholder DE via SOAP.
 */
async function getDEFields(mc, customerKey) {
  const xml = await mc.soap('Retrieve', `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtensionField</ObjectType>
      <Properties>Name</Properties>
      <Properties>FieldType</Properties>
      <Properties>MaxLength</Properties>
      <Properties>IsPrimaryKey</Properties>
      <Properties>IsRequired</Properties>
      <Properties>DefaultValue</Properties>
      <Properties>Ordinal</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>DataExtension.CustomerKey</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>${escapeXml(customerKey)}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`);

  const results = xml.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];
  return results.map(r => ({
    name: r.match(/<Name>([^<]+)/)?.[1],
    fieldType: r.match(/<FieldType>([^<]+)/)?.[1],
    maxLength: r.match(/<MaxLength>([^<]+)/)?.[1] ? Number(r.match(/<MaxLength>([^<]+)/)[1]) : undefined,
    isPrimaryKey: r.match(/<IsPrimaryKey>([^<]+)/)?.[1] === 'true',
    isRequired: r.match(/<IsRequired>([^<]+)/)?.[1] === 'true',
    defaultValue: r.match(/<DefaultValue>([^<]+)/)?.[1] || undefined,
    ordinal: Number(r.match(/<Ordinal>([^<]+)/)?.[1] || 0),
  })).sort((a, b) => a.ordinal - b.ordinal);
}

/**
 * Create a new DE with the same schema as a placeholder.
 *
 * @param {object} mc - MC client
 * @param {object} config
 * @param {string} config.sourceDEKey - CustomerKey of the placeholder DE
 * @param {string} config.newName - Name for the new DE
 * @param {string} config.newKey - CustomerKey for the new DE (usually same as name)
 * @param {number} config.categoryId - Target DE folder ID
 * @param {function} [onProgress]
 * @returns {{ name: string, customerKey: string }}
 */
export async function duplicateDE(mc, config, onProgress) {
  const log = onProgress || (() => {});

  log(`Reading schema of placeholder DE: ${config.sourceDEKey}...`);
  const fields = await getDEFields(mc, config.sourceDEKey);
  if (fields.length === 0) {
    throw new Error(`No fields found for DE key "${config.sourceDEKey}"`);
  }
  log(`  Found ${fields.length} fields`);

  // Build SOAP field XML
  const fieldsXml = fields.map(f => {
    let xml = `<Field>
          <Name>${escapeXml(f.name)}</Name>
          <FieldType>${f.fieldType}</FieldType>`;
    if (f.fieldType === 'Text' && f.maxLength) xml += `\n          <MaxLength>${f.maxLength}</MaxLength>`;
    if (f.fieldType === 'Decimal' && f.maxLength) xml += `\n          <MaxLength>${f.maxLength}</MaxLength>`;
    if (f.isPrimaryKey) xml += `\n          <IsPrimaryKey>true</IsPrimaryKey>`;
    if (f.isRequired) xml += `\n          <IsRequired>true</IsRequired>`;
    if (f.defaultValue) xml += `\n          <DefaultValue>${escapeXml(f.defaultValue)}</DefaultValue>`;
    xml += '\n        </Field>';
    return xml;
  }).join('\n        ');

  const customerKey = config.newKey || config.newName;

  log(`Creating DE: "${config.newName}"...`);
  const soapXml = await mc.soap('Create', `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <Objects xsi:type="DataExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <Name>${escapeXml(config.newName)}</Name>
      <CustomerKey>${escapeXml(customerKey)}</CustomerKey>
      ${config.categoryId ? `<CategoryID>${config.categoryId}</CategoryID>` : ''}
      <Fields>
        ${fieldsXml}
      </Fields>
    </Objects>
  </CreateRequest>`);

  const status = soapXml.match(/<StatusCode>([^<]+)/)?.[1];
  const statusMsg = soapXml.match(/<StatusMessage>([^<]+)/)?.[1] || '';
  if (status !== 'OK') {
    throw new Error(`Failed to create DE "${config.newName}": ${statusMsg}`);
  }

  log(`DE created: "${config.newName}"`);
  return { name: config.newName, customerKey };
}

/**
 * Duplicate all placeholder DEs for a campaign type.
 */
export async function duplicateAllDEs(mc, campaignType, campaignName, dateDDMMYY, deFolderId, onProgress) {
  const log = onProgress || (() => {});
  const typeDef = CAMPAIGN_TYPES[campaignType];
  if (!typeDef) throw new Error(`Unknown campaign type: ${campaignType}`);

  const results = [];
  for (const placeholder of typeDef.placeholderDEs) {
    const newName = `${campaignName}_${dateDDMMYY}${placeholder.suffix}`;
    const de = await duplicateDE(mc, {
      sourceDEKey: placeholder.key,
      newName,
      newKey: newName,
      categoryId: deFolderId,
    }, log);
    results.push({ ...de, suffix: placeholder.suffix, originalName: placeholder.name });
  }

  return results;
}

// ─── Step 4: Upload image to MC ────────────────────────────────────────────────

/**
 * Upload a base64 image to Marketing Cloud Content Builder.
 *
 * @param {object} mc - MC client
 * @param {object} config
 * @param {string} config.name - Asset name
 * @param {string} config.base64 - Base64-encoded image data (without data URI prefix)
 * @param {string} config.fileType - 'png', 'jpg', 'gif'
 * @param {number} [config.categoryId] - Target folder ID (optional)
 * @returns {{ assetId: number, publishedURL: string }}
 */
export async function uploadImage(mc, config) {
  const body = {
    name: config.name,
    assetType: { id: 28, name: 'image' },
    fileProperties: {
      fileName: `${config.name}.${config.fileType || 'png'}`,
    },
    file: config.base64,
  };
  if (config.categoryId) body.category = { id: config.categoryId };

  const result = await mc.rest('POST', '/asset/v1/content/assets', body);

  if (!result.id) {
    throw new Error(`Failed to upload image: ${JSON.stringify(result).substring(0, 300)}`);
  }

  return {
    assetId: result.id,
    publishedURL: result.fileProperties?.publishedURL || null,
    name: result.name,
  };
}

// ─── Step 5: Fill DE rows ──────────────────────────────────────────────────────

/**
 * Upsert rows into a Data Extension.
 * Automatically discovers primary keys via SOAP and splits row data accordingly.
 *
 * @param {object} mc - MC client
 * @param {string} deKey - CustomerKey / external key of the DE
 * @param {object[]} rows - Array of { fieldName: value } objects
 * @returns {number} Number of rows upserted
 */
export async function fillDERows(mc, deKey, rows) {
  if (!rows || rows.length === 0) return 0;

  // Discover primary key fields
  const fields = await getDEFields(mc, deKey);
  const pkFields = fields.filter(f => f.isPrimaryKey).map(f => f.name);
  if (pkFields.length === 0) throw new Error(`No primary keys found for DE "${deKey}"`);

  // MC API max 50 rows per call
  const batches = [];
  for (let i = 0; i < rows.length; i += 50) {
    batches.push(rows.slice(i, i + 50));
  }

  let total = 0;
  for (const batch of batches) {
    const items = batch.map(row => {
      const keys = {};
      const values = {};
      for (const [k, v] of Object.entries(row)) {
        if (pkFields.includes(k)) keys[k] = v;
        else values[k] = v;
      }
      return { keys, values };
    });
    await mc.rest('POST', `/hub/v1/dataevents/key:${encodeURIComponent(deKey)}/rowset`, items);
    total += batch.length;
  }

  return total;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Build a complete BAU campaign end-to-end.
 *
 * @param {object} mc - MC client
 * @param {object} config
 * @param {string} config.campaignType - Key from CAMPAIGN_TYPES
 * @param {string} config.campaignName - Lowercase campaign identifier (e.g. 'gcceksummerdubai2026')
 * @param {string} config.dateDDMMYY - Date string (e.g. '130426')
 * @param {string} config.dateYYYYMMDD - Date string (e.g. '20260413')
 * @param {string} config.year - e.g. '2026'
 * @param {string} config.yearMonth - e.g. '2026-04'
 * @param {string} config.market - Market code (e.g. 'GCC', 'UK', 'IN')
 * @param {string} config.description - Campaign description for folder name
 * @param {string} config.direction - 'in' or 'ou' (default 'in')
 * @param {string} config.variant - 'Ecommerce' or 'Skywards' (default 'Ecommerce')
 * @param {boolean} [config.cugoCode] - Use CugoCode template (default false)
 * @param {object[]} config.contentRows - Array of DE row data for DynamicContent
 * @param {object[]} [config.secondaryRows] - Array of row data for secondary DE (Products/Stories)
 * @param {function} [onProgress]
 * @returns {object} Full result with all created assets
 */
export async function buildBAUCampaign(mc, config, onProgress) {
  const log = onProgress || console.log;
  const typeDef = CAMPAIGN_TYPES[config.campaignType];
  if (!typeDef) throw new Error(`Unknown campaign type: ${config.campaignType}`);

  const direction = config.direction || 'in';
  const variant = config.variant || 'Ecommerce';
  const campaignFolderName = `${config.dateYYYYMMDD}_${config.market}_${config.description}_${typeDef.code}_${direction}`;

  log(`\n═══ Building ${typeDef.name} Campaign ═══`);
  log(`Campaign: ${config.campaignName}`);
  log(`Folder: ${campaignFolderName}`);
  log(`Variant: ${variant}`);

  // 1. Folder hierarchy
  log('\n── Step 1: Folder Hierarchy ──');
  const folders = await ensureFolderHierarchy(mc, {
    variant,
    year: config.year,
    yearMonth: config.yearMonth,
    campaignFolderName,
  }, log);

  // 2. Duplicate email
  log('\n── Step 2: Duplicate Email ──');
  const templateKey = config.cugoCode ? 'withCugoCode' : 'noCugoCode';
  const sourceAssetId = typeDef.templates[templateKey] || typeDef.templates.default;
  if (!sourceAssetId) throw new Error(`No template found for type ${config.campaignType} (${templateKey})`);

  const attr2 = variant === 'Skywards' ? 'sk' : 'ek';
  const attr3 = `${config.campaignName}_deploydate_${direction}`;
  const attr5 = `${typeDef.attr5Code}_${config.dateDDMMYY}`;

  const email = await duplicateEmail(mc, {
    sourceAssetId,
    newName: campaignFolderName,
    categoryId: folders.cbFolderId,
    attributes: { attr1: 'pr', attr2, attr3, attr4: 'xx', attr5 },
  }, log);

  // 3. Duplicate DEs
  log('\n── Step 3: Duplicate DEs ──');
  const des = await duplicateAllDEs(mc, config.campaignType, config.campaignName, config.dateDDMMYY, folders.deFolderId, log);

  // 4. Fill content rows
  log('\n── Step 4: Fill DE Content ──');
  const primaryDE = des.find(d => d.suffix.includes('DynamicContent'));
  if (primaryDE && config.contentRows?.length > 0) {
    const count = await fillDERows(mc, primaryDE.customerKey, config.contentRows);
    log(`  Filled ${count} row(s) in ${primaryDE.name}`);
  }

  const secondaryDE = des.find(d => d.suffix.includes('Stories') || d.suffix.includes('Products'));
  if (secondaryDE && config.secondaryRows?.length > 0) {
    const count = await fillDERows(mc, secondaryDE.customerKey, config.secondaryRows);
    log(`  Filled ${count} row(s) in ${secondaryDE.name}`);
  }

  // Done
  log('\n═══ Campaign Created Successfully ═══');
  const result = {
    campaignType: typeDef.name,
    campaignName: config.campaignName,
    variant,
    email,
    des,
    folders,
    attributes: { attr1: 'pr', attr2, attr3, attr4: 'xx', attr5 },
  };
  log(JSON.stringify(result, null, 2));
  return result;
}
