// Phase B: commit approved content to Marketing Cloud.
// 1. Uploads locally-generated images and maps fake IDs → real MC asset IDs
// 2. Rewrites row values so the real asset IDs replace the fake IDs
// 3. Delegates to buildBAUCampaign which creates folders, email, DEs and fills rows

import { buildBAUCampaign, uploadImage } from './index.js';

export async function pushToMC({ mc, build, onProgress = () => {} }) {
  const emit = (msg) => onProgress('mc-step', { message: msg });

  const images = build.images_base64 || {};
  const fakeToReal = {};
  const fakeIds = Object.keys(images);

  if (fakeIds.length) {
    emit(`Uploading ${fakeIds.length} images to MC...`);
    for (const fakeId of fakeIds) {
      const dataUri = images[fakeId];
      const m = /^data:(image\/(png|jpe?g|gif));base64,(.+)$/i.exec(dataUri || '');
      if (!m) {
        throw new Error(`Invalid data URI for ${fakeId}`);
      }
      const fileType = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
      const base64 = m[3];
      const safeName = `${build.campaign_name}_${fakeId}`.replace(/[^A-Za-z0-9_\-]/g, '_');
      onProgress('mc-upload', { fakeId });
      const up = await uploadImage(mc, { name: safeName, base64, fileType });
      fakeToReal[fakeId] = up.assetId;
      emit(`  ${fakeId} → assetId=${up.assetId}`);
    }
  }

  const rows = (build.rows || []).map(row => {
    const out = { ...row };
    for (const [field, value] of Object.entries(out)) {
      if (typeof value === 'string' && fakeToReal[value]) {
        out[field] = String(fakeToReal[value]);
      }
    }
    return out;
  });

  const date = new Date(build.campaign_date);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const yearMonth = `${yyyy}-${mm}`;
  const dateDDMMYY = `${dd}${mm}${String(yyyy).slice(-2)}`;
  const dateYYYYMMDD = `${yyyy}${mm}${dd}`;

  const config = {
    campaignType: build.campaign_type,
    campaignName: build.campaign_name,
    description: build.campaign_name,
    market: build.market,
    variant: build.variant_strategy === 'skywards' ? 'Skywards' : 'Ecommerce',
    direction: build.direction || 'in',
    dateDDMMYY,
    dateYYYYMMDD,
    year: yyyy,
    yearMonth,
    cugoCode: build.cugo_code,
    contentRows: rows,
    secondaryRows: [],
  };

  const result = await buildBAUCampaign(mc, config, emit);

  onProgress('complete', {
    emailAssetId: result.email?.assetId,
    deKeys: result.des?.map(d => d.customerKey) || [],
    folderPath: result.folders?.cbCategoryPath || null,
    imagesUploaded: Object.keys(fakeToReal).length,
  });

  return result;
}
