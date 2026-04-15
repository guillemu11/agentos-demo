/**
 * Unified Studio → BAU Campaign Builder adapter.
 *
 * The Unified Studio produces an array of `Variant` objects with arbitrary
 * copy + HTML per market/tier. The BAU pipeline expects a compact brief
 * plus campaign metadata (type, name, date, market) from which Claude
 * re-generates variants.
 *
 * This adapter distills `Variant[]` into a brief string the BAU flow can
 * consume, preserving per-market/tier differentiation as structured notes.
 */

export function variantsToBauBrief(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return '';
    const lines = [];
    const byMarket = {};
    for (const v of variants) {
        const key = `${v.market || 'unknown'}:${v.tier || 'unknown'}`;
        (byMarket[key] ||= []).push(v);
    }
    for (const [key, list] of Object.entries(byMarket)) {
        lines.push(`## ${key}`);
        for (const v of list) {
            if (v.label) lines.push(`- **${v.label}**`);
            if (v.copy?.subject) lines.push(`  - Subject: ${v.copy.subject}`);
            if (v.copy?.preheader) lines.push(`  - Preheader: ${v.copy.preheader}`);
            if (v.mcLink?.emailId) lines.push(`  - MC asset: ${v.mcLink.emailId}`);
        }
        lines.push('');
    }
    return lines.join('\n').trim();
}

export function variantsToBauPayload(variants, meta = {}) {
    const markets = [...new Set(variants.map(v => v.market).filter(Boolean))];
    const tiers = [...new Set(variants.map(v => v.tier).filter(Boolean))];
    return {
        campaignType: meta.campaignType || 'product-offer',
        campaignName: meta.campaignName || 'Unified Studio Campaign',
        campaignDate: meta.campaignDate || new Date().toISOString().split('T')[0],
        market: markets[0] || 'global',
        variantStrategy: tiers.length > 1 ? 'tier' : 'single',
        languages: markets.length ? markets : ['en'],
        direction: meta.direction || 'in',
        cugoCode: !!meta.cugoCode,
        brief: variantsToBauBrief(variants),
    };
}
