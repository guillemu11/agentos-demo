// apps/dashboard/src/pages/ContentStudioPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import HandoffModal from '../components/HandoffModal.jsx';
import StudioTopBar from '../components/studio/StudioTopBar.jsx';
import StudioChatPanel from '../components/studio/StudioChatPanel.jsx';
import StudioVariantsPanel from '../components/studio/StudioVariantsPanel.jsx';
import StudioLivePreview from '../components/studio/StudioLivePreview.jsx';
import VariantPreviewModal from '../components/studio/VariantPreviewModal.jsx';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'lucia';
const ALL_MARKETS = ['en', 'es', 'ar', 'ru'];
const DEFAULT_TIER = 'economy';
const FIELD_TO_VAR = {
  subject:      '@subject',
  preheader:    '@preheader',
  heroHeadline: '@hero_title',
  bodyCopy:     '@body_copy',
  cta:          '@cta_text',
};
const ALL_VARIANT_FIELDS = Object.keys(FIELD_TO_VAR);
// Handoff requires at least one complete variant (all 5 fields approved)
const MIN_APPROVED_FOR_HANDOFF = 5;

function emptyVariant() {
  return {
    subject:      { status: 'pending', value: null },
    preheader:    { status: 'pending', value: null },
    heroHeadline: { status: 'pending', value: null },
    bodyCopy:     { status: 'pending', value: null },
    cta:          { status: 'pending', value: null },
  };
}

export default function ContentStudioPage() {
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [projectEmails, setProjectEmails] = useState([]);
  const [variants, setVariants] = useState({});
  const [imageSlots, setImageSlots] = useState({});
  const [ampVarValues, setAmpVarValues] = useState({});
  const [blockVarMap, setBlockVarMap] = useState({});
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);
  const [activeMarket, setActiveMarket] = useState('en');
  const [activeTier, setActiveTier] = useState(DEFAULT_TIER);
  const [previewMarket, setPreviewMarket] = useState('en');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [chatPreload, setChatPreload] = useState('');

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Auto-select ticket from URL
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const t = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (t) pipeline.selectTicket(t);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  // Load emails + variables when ticket changes
  useEffect(() => {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) { setProjectEmails([]); setBlockVarMap({}); setAmpVarValues({}); return; }

    Promise.all([
      fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/projects/${projectId}/email-variables`, { credentials: 'include' }).then(r => r.ok ? r.json() : { variables: {} }),
    ]).then(([emailsData, varsData]) => {
      const emails = Array.isArray(emailsData) ? emailsData : [];
      setProjectEmails(emails);
      const html = (emails.find(e => e.status === 'approved') || emails[0])?.html_content || '';
      if (html) {
        const map = {};
        html.split(/(?=data-block-name="/)/).slice(1).forEach(part => {
          const nm = part.match(/data-block-name="([^"]+)"/);
          if (!nm) return;
          const vars = [...part.substring(0, 3000).matchAll(/%%=v\(@(\w+)\)=%%/g)].map(m => m[1]);
          if (vars.length) map[nm[1]] = [...new Set(vars)];
        });
        setBlockVarMap(map);
      }
      setAmpVarValues(varsData.variables || {});
    }).catch(() => {});
  }, [pipeline.selectedTicket?.project_id]);

  // Reset state on ticket change
  useEffect(() => {
    const raw = pipeline.selectedTicket?.project_markets || pipeline.selectedTicket?.metadata?.markets || ALL_MARKETS;
    const resolved = Array.isArray(raw) && raw.every(m => ALL_MARKETS.includes(m)) ? raw : ALL_MARKETS;
    setAvailableMarkets(resolved);
    setActiveMarket(resolved[0] || 'en');
    setPreviewMarket(resolved[0] || 'en');
    setVariants({});
    setImageSlots({});
  }, [pipeline.selectedTicket?.id]);

  // Computed: live HTML for preview
  const baseHtml = useMemo(() => {
    const email = projectEmails.find(e => e.status === 'approved') || projectEmails[0];
    return email?.html_content || '';
  }, [projectEmails]);

  const liveHtml = useMemo(() => {
    if (!baseHtml) return '';
    const merged = { ...ampVarValues };
    // Inject active preview market's variants
    const variantKey = `${previewMarket}:${activeTier}`;
    const variantData = variants[variantKey];
    if (variantData) {
      Object.entries(FIELD_TO_VAR).forEach(([field, varName]) => {
        if (variantData[field]?.value) merged[varName] = variantData[field].value;
      });
    }
    // Inject image slots for preview market
    const slots = imageSlots[previewMarket] || {};
    Object.entries(slots).forEach(([slotName, slot]) => {
      if (slot?.url) merged[`@${slotName}`] = slot.url;
    });
    let html = baseHtml;
    for (const [key, value] of Object.entries(merged)) {
      const varName = key.startsWith('@') ? key.slice(1) : key;
      const safe = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`%%=v\\(@${safe}\\)=%%`, 'g'), value);
    }
    return html;
  }, [baseHtml, ampVarValues, variants, imageSlots, previewMarket, activeTier]);

  // Computed: progress stats
  const progressStats = useMemo(() => {
    let approved = 0;
    let total = 0;
    availableMarkets.forEach(market => {
      const key = `${market}:${activeTier}`;
      const vd = variants[key];
      ALL_VARIANT_FIELDS.forEach(field => {
        total++;
        if (vd?.[field]?.status === 'approved') approved++;
      });
    });
    return { approved, total };
  }, [variants, availableMarkets, activeTier]);

  const canHandoff = progressStats.approved >= MIN_APPROVED_FOR_HANDOFF;

  // Handlers
  const handleBriefUpdate = useCallback(({ variant, block, status, value }) => {
    setVariants(prev => ({
      ...prev,
      [variant]: { ...(prev[variant] || emptyVariant()), [block]: { status, value } },
    }));
    // If approved, also update ampVarValues for live preview
    if (status === 'approved' && value != null) {
      const varName = FIELD_TO_VAR[block];
      if (varName) setAmpVarValues(prev => ({ ...prev, [varName]: value }));
    }
  }, []);

  const handleImageAssigned = useCallback((market, slotName, url, prompt) => {
    setImageSlots(prev => ({
      ...prev,
      [market]: { ...(prev[market] || {}), [slotName]: { url, prompt, status: 'ready' } },
    }));
    // Also update ampVarValues so live preview shows the image
    setAmpVarValues(prev => ({ ...prev, [`@${slotName}`]: url }));
  }, []);

  const handleVarChange = useCallback((varName, value) => {
    setAmpVarValues(prev => ({ ...prev, [varName]: value }));
  }, []);

  const handleHandoff = useCallback(() => {
    pipeline.setHandoffSession({
      id: pipeline.selectedTicket?.id || 'content-brief',
      stage_order: pipeline.currentSession?.stage_order,
      variants,
      activeVariant: `${activeMarket}:${activeTier}`,
    });
    setShowPreviewModal(false);
  }, [pipeline, variants, activeMarket, activeTier]);

  if (!agent) return <div style={{ color: 'var(--studio-text)', padding: 32 }}>Cargando…</div>;

  return (
    <div className="content-studio-page">
      <StudioTopBar
        ticket={pipeline.selectedTicket}
        progressStats={progressStats}
        onShowPreviewModal={() => setShowPreviewModal(true)}
        onHandoff={handleHandoff}
        canHandoff={canHandoff}
      />

      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        {/* LEFT: Chat */}
        <Panel defaultSize={38} minSize={25} maxSize={55}>
          <StudioChatPanel
            agent={agent}
            ticket={pipeline.selectedTicket}
            activeMarket={activeMarket}
            onBriefUpdate={handleBriefUpdate}
            onImageAssigned={handleImageAssigned}
            externalInput={chatPreload}
            onExternalInputConsumed={() => setChatPreload('')}
          />
        </Panel>

        <PanelResizeHandle className="studio-resize-handle" />

        {/* RIGHT: Variants + Preview */}
        <Panel minSize={35}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel defaultSize={50} minSize={30}>
              <StudioVariantsPanel
                markets={availableMarkets}
                variants={variants}
                activeMarket={activeMarket}
                activeTier={activeTier}
                onMarketSelect={setActiveMarket}
                onTierSelect={setActiveTier}
                imageSlots={imageSlots}
                onSlotsChange={setImageSlots}
                blockVarMap={blockVarMap}
                ampVarValues={ampVarValues}
                onVarChange={handleVarChange}
              />
            </Panel>

            <PanelResizeHandle className="studio-resize-handle-vertical" />

            <Panel minSize={25}>
              <StudioLivePreview
                liveHtml={liveHtml}
                baseHtml={baseHtml}
                markets={availableMarkets}
                previewMarket={previewMarket}
                onMarketSelect={setPreviewMarket}
                onShowModal={() => setShowPreviewModal(true)}
              />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {showPreviewModal && (
        <VariantPreviewModal
          ticket={pipeline.selectedTicket}
          markets={availableMarkets}
          activeTier={activeTier}
          variants={variants}
          imageSlots={imageSlots}
          ampVarValues={ampVarValues}
          baseHtml={baseHtml}
          progressStats={progressStats}
          onHandoff={handleHandoff}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {pipeline.handoffSession && (
        <HandoffModal
          projectId={pipeline.selectedTicket?.project_id}
          session={pipeline.handoffSession}
          stages={pipeline.stages}
          agents={pipeline.agents}
          onClose={() => pipeline.setHandoffSession(null)}
          onComplete={pipeline.onHandoffComplete}
        />
      )}
    </div>
  );
}
