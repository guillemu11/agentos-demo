import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, CheckCircle2, Rocket } from 'lucide-react';
import { variantsToBauPayload } from '../../../../packages/core/campaign-builder/unified-adapter.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import VariantTimeline from '../components/unified-studio/VariantTimeline.jsx';
import ActiveVariantEditor from '../components/unified-studio/ActiveVariantEditor.jsx';
import BlockBrowserMC from '../components/unified-studio/BlockBrowserMC.jsx';
import UnifiedChatPanel from '../components/unified-studio/UnifiedChatPanel.jsx';
import ConflictModal from '../components/unified-studio/ConflictModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'agentos.unifiedStudio.v1';
const MARKETS = ['en', 'es', 'ar', 'ru'];

function emptyVariant(overrides = {}) {
    return {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: '',
        market: 'en',
        tier: 'economy',
        copy: { subject: '', preheader: '', blocks: [] },
        html: { fullHtml: '', blockHtmlMap: {} },
        assets: { images: [], mcContentBlockIds: {} },
        mcLink: { emailId: null, templateId: null, lastFetchedAt: null, etag: null },
        dirty: { copy: false, html: false, assets: false },
        source: 'local',
        ...overrides,
    };
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.variants)) return null;
        return parsed;
    } catch {
        return null;
    }
}

export default function UnifiedStudioPage() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [variants, setVariants] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [marketFilter, setMarketFilter] = useState('all');
    const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
    const [saveError, setSaveError] = useState(null);
    const [conflict, setConflict] = useState(null); // { variantId, localHtml, remoteHtml, remoteEtag }
    const [templateShell, setTemplateShell] = useState('');
    const hydrated = useRef(false);

    useEffect(() => {
        const persisted = loadFromStorage();
        if (persisted) {
            setVariants(persisted.variants);
            setActiveId(persisted.activeId || persisted.variants[0]?.id || null);
        }
        hydrated.current = true;
        fetch(`${API_URL}/api/email-template`, { credentials: 'include' })
            .then(r => r.ok ? r.text() : '')
            .then(html => { if (html) setTemplateShell(html); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!hydrated.current) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ variants, activeId }));
    }, [variants, activeId]);

    const createVariant = () => {
        const base = variants[0];
        const fresh = emptyVariant(base ? { market: base.market, tier: base.tier } : {});
        setVariants(prev => [...prev, fresh]);
        setActiveId(fresh.id);
    };

    const duplicateVariant = (id) => {
        const source = variants.find(v => v.id === id);
        if (!source) return;
        const copy = {
            ...source,
            id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            label: source.label ? `${source.label} (copy)` : '',
            mcLink: { emailId: null, templateId: null, lastFetchedAt: null, etag: null },
            dirty: { copy: true, html: true, assets: true },
            source: 'local',
        };
        const idx = variants.findIndex(v => v.id === id);
        const next = [...variants];
        next.splice(idx + 1, 0, copy);
        setVariants(next);
        setActiveId(copy.id);
    };

    const removeVariant = (id) => {
        setVariants(prev => {
            const next = prev.filter(v => v.id !== id);
            if (activeId === id) setActiveId(next[0]?.id || null);
            return next;
        });
    };

    const updateActive = (patch) => {
        setVariants(prev => prev.map(v => {
            if (v.id !== activeId) return v;
            const next = { ...v, ...patch };
            const dirty = { ...v.dirty };
            if (patch.copy) dirty.copy = true;
            if (patch.html) dirty.html = true;
            if (patch.assets) dirty.assets = true;
            return { ...next, dirty };
        }));
    };

    const ensureActiveVariant = () => {
        if (activeId && variants.some(v => v.id === activeId)) return activeId;
        const fresh = emptyVariant();
        setVariants(prev => [...prev, fresh]);
        setActiveId(fresh.id);
        return fresh.id;
    };

    const applyChatPatch = (evt) => {
        const { op, args } = evt;
        const targetId = ensureActiveVariant();
        setVariants(prev => prev.map(v => {
            if (v.id !== targetId) return v;
            const next = { ...v, html: { ...v.html }, copy: { ...v.copy }, dirty: { ...v.dirty } };
            next.html.blockHtmlMap = { ...(next.html.blockHtmlMap || {}) };

            if (op === 'set_subject') {
                next.copy.subject = args.text || '';
                next.dirty.copy = true;
            } else if (op === 'set_preheader') {
                next.copy.preheader = args.text || '';
                next.dirty.copy = true;
            } else if (op === 'add_block') {
                const blockId = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
                next.html.blockHtmlMap[blockId] = {
                    type: args.type || 'body',
                    label: args.label || args.type || 'block',
                    html: args.html || '',
                };
                const blockWrap = `<div data-block-id="${blockId}" data-block-type="${args.type || 'body'}">${args.html || ''}</div>`;
                const pos = args.position || 'end';
                const current = next.html.fullHtml || '';
                next.html.fullHtml = pos === 'start' ? `${blockWrap}\n${current}` : `${current}\n${blockWrap}`;
                next.dirty.html = true;
            } else if (op === 'update_block') {
                const { blockId, html } = args;
                if (next.html.blockHtmlMap[blockId]) {
                    next.html.blockHtmlMap[blockId] = { ...next.html.blockHtmlMap[blockId], html };
                }
                // Best-effort in fullHtml: replace the wrapper content
                const re = new RegExp(`(<div data-block-id="${blockId}"[^>]*>)[\\s\\S]*?(</div>)`);
                next.html.fullHtml = (next.html.fullHtml || '').replace(re, `$1${html}$2`);
                next.dirty.html = true;
            } else if (op === 'remove_block') {
                const { blockId } = args;
                delete next.html.blockHtmlMap[blockId];
                const re = new RegExp(`<div data-block-id="${blockId}"[^>]*>[\\s\\S]*?</div>\\s*`, 'g');
                next.html.fullHtml = (next.html.fullHtml || '').replace(re, '');
                next.dirty.html = true;
            } else if (op === 'import_emirates_block') {
                const blockId = `b_em_${args.blockId}_${Date.now().toString(36)}`;
                next.html.blockHtmlMap[blockId] = {
                    type: 'emirates_library',
                    label: args.label || args.blockId,
                    html: args.html || '',
                    file: args.file,
                };
                const blockWrap = `<div data-block-id="${blockId}" data-block-type="emirates_library" data-block-source="${args.file || args.blockId}">${args.html || ''}</div>`;
                const pos = args.position || 'end';
                const current = next.html.fullHtml || '';
                next.html.fullHtml = pos === 'start' ? `${blockWrap}\n${current}` : `${current}\n${blockWrap}`;
                next.dirty.html = true;
            } else if (op === 'import_mc_asset') {
                const blockId = `b_mc_${args.assetId}`;
                next.html.blockHtmlMap[blockId] = {
                    type: 'mc_import',
                    label: args.label || args.name || `MC #${args.assetId}`,
                    html: args.html || '',
                    mcAssetId: args.assetId,
                };
                const blockWrap = `<div data-block-id="${blockId}" data-block-type="mc_import" data-mc-asset-id="${args.assetId}">${args.html || ''}</div>`;
                next.html.fullHtml = `${next.html.fullHtml || ''}\n${blockWrap}`;
                next.assets = { ...(next.assets || {}), mcContentBlockIds: { ...(next.assets?.mcContentBlockIds || {}), [blockId]: args.assetId } };
                if (!next.copy.subject && args.subject) next.copy.subject = args.subject;
                if (!next.label) next.label = args.name || next.label;
                next.dirty.html = true;
                next.dirty.assets = true;
            }
            return next;
        }));
    };

    const importFromMc = (asset) => {
        if (!asset) return;
        const patch = {
            label: asset.name || 'MC Import',
            copy: { subject: asset.subject || '', preheader: '', blocks: [] },
            html: { fullHtml: asset.html || '', blockHtmlMap: {} },
            mcLink: {
                emailId: asset.id,
                templateId: null,
                lastFetchedAt: new Date().toISOString(),
                etag: asset.etag,
            },
            dirty: { copy: false, html: false, assets: false },
            source: 'mc',
        };
        if (!activeId) {
            const fresh = emptyVariant({ ...patch });
            setVariants(prev => [...prev, fresh]);
            setActiveId(fresh.id);
        } else {
            setVariants(prev => prev.map(v => v.id === activeId ? { ...v, ...patch } : v));
        }
    };

    const saveActiveToMc = async (force = false) => {
        const v = variants.find(x => x.id === activeId);
        if (!v) return;
        if (!v.mcLink?.emailId) {
            setSaveState('error');
            setSaveError(t('unifiedStudio.notLinkedToMc'));
            return;
        }
        setSaveState('saving');
        setSaveError(null);
        try {
            const r = await fetch(`${API_URL}/api/mc/assets/${v.mcLink.emailId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: v.html?.fullHtml || '',
                    etag: v.mcLink.etag,
                    force,
                }),
            });
            if (r.status === 409) {
                const body = await r.json();
                setConflict({
                    variantId: v.id,
                    localHtml: v.html?.fullHtml || '',
                    remoteHtml: body.remoteHtml || '',
                    remoteEtag: body.currentEtag,
                });
                setSaveState('idle');
                return;
            }
            if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${r.status}`);
            }
            const updated = await r.json();
            setVariants(prev => prev.map(x => x.id === v.id ? {
                ...x,
                mcLink: { ...x.mcLink, etag: updated.etag, lastFetchedAt: new Date().toISOString() },
                dirty: { copy: false, html: false, assets: false },
            } : x));
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
        } catch (e) {
            setSaveState('error');
            setSaveError(e.message);
        }
    };

    const resolveConflictKeepLocal = (remoteEtag) => {
        setVariants(prev => prev.map(v => v.id === conflict.variantId ? {
            ...v,
            mcLink: { ...v.mcLink, etag: remoteEtag },
        } : v));
        setConflict(null);
        setTimeout(() => saveActiveToMc(true), 0);
    };

    const resolveConflictKeepRemote = (remoteHtml, remoteEtag) => {
        setVariants(prev => prev.map(v => v.id === conflict.variantId ? {
            ...v,
            html: { ...v.html, fullHtml: remoteHtml },
            mcLink: { ...v.mcLink, etag: remoteEtag, lastFetchedAt: new Date().toISOString() },
            dirty: { copy: false, html: false, assets: false },
        } : v));
        setConflict(null);
    };

    const visibleVariants = useMemo(() => (
        marketFilter === 'all' ? variants : variants.filter(v => v.market === marketFilter)
    ), [variants, marketFilter]);

    const active = variants.find(v => v.id === activeId) || null;
    const canSave = !!active?.mcLink?.emailId;

    return (
        <div className="us-page">
            <header className="us-header">
                <div>
                    <h1 className="us-title">{t('unifiedStudio.title')}</h1>
                    <p className="us-subtitle">{t('unifiedStudio.subtitle')}</p>
                </div>
                <div className="us-topbar-actions">
                    <div className="us-market-filter">
                        <span className="us-label">{t('unifiedStudio.marketFilter')}</span>
                        <select className="us-input" value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
                            <option value="all">{t('unifiedStudio.allMarkets')}</option>
                            {MARKETS.map(m => <option key={m} value={m}>{t(`unifiedStudio.markets.${m}`)}</option>)}
                        </select>
                    </div>
                    <button
                        className="us-btn us-btn-secondary"
                        onClick={() => {
                            const payload = variantsToBauPayload(variants);
                            localStorage.setItem('agentos.unifiedStudio.bauHandoff', JSON.stringify(payload));
                            navigate('/app/campaign-creation');
                        }}
                        disabled={variants.length === 0}
                        title={t('unifiedStudio.exportToBauHint')}
                    >
                        <Rocket size={14} />
                        <span>{t('unifiedStudio.exportToBau')}</span>
                    </button>
                    <button
                        className={`us-btn us-btn-primary ${saveState === 'saving' ? 'is-loading' : ''}`}
                        onClick={() => saveActiveToMc(false)}
                        disabled={!canSave || saveState === 'saving'}
                        title={canSave ? t('unifiedStudio.saveToMc') : t('unifiedStudio.notLinkedToMc')}
                    >
                        {saveState === 'saving' ? <Loader2 size={14} className="us-spin" /> : saveState === 'saved' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                        <span>{saveState === 'saving' ? t('unifiedStudio.saving') : saveState === 'saved' ? t('unifiedStudio.savedToMc') : t('unifiedStudio.saveToMc')}</span>
                    </button>
                </div>
            </header>

            {saveError && <div className="us-banner us-banner-error">{saveError}</div>}

            <div className="us-workspace">
                <BlockBrowserMC onImport={importFromMc} />

                <div className="us-main">
                    <VariantTimeline
                        variants={visibleVariants}
                        activeId={activeId}
                        onSelect={setActiveId}
                        onDuplicate={duplicateVariant}
                        onRemove={removeVariant}
                        onCreate={createVariant}
                    />
                    <ActiveVariantEditor variant={active} onChange={updateActive} templateShell={templateShell} />
                </div>

                <UnifiedChatPanel activeVariant={active} onApplyPatch={applyChatPatch} />
            </div>

            <ConflictModal
                open={!!conflict}
                localHtml={conflict?.localHtml}
                remoteHtml={conflict?.remoteHtml}
                remoteEtag={conflict?.remoteEtag}
                onKeepLocal={resolveConflictKeepLocal}
                onKeepRemote={resolveConflictKeepRemote}
                onClose={() => setConflict(null)}
            />
        </div>
    );
}
