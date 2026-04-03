import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import AgentChatSwitcher from '../components/agent-views/shared/AgentChatSwitcher.jsx';
import EmailBuilderPreview from '../components/EmailBuilderPreview.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';
import EmailBlocksPanel from '../components/EmailBlocksPanel.jsx';
import { injectIntoSlot, mergeAiHtmlIntoTemplate, fetchEmailTemplate, splitIntoBlocks } from '../utils/emailTemplate.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'html-developer';

export default function EmailStudioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [leftTab, setLeftTab] = useState('chat');

  // Builder state — blocks[] tracks manual blocks; aiHtml holds AI-generated full doc
  const [blocks, setBlocks] = useState([]); // [{id, name, html}]
  const [aiHtml, setAiHtml] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [contentVariants, setContentVariants] = useState({});
  const [contentReady, setContentReady] = useState(false);

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent data on mount
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Load Emirates master template once
  useEffect(() => {
    fetchEmailTemplate().then(html => { if (html) setTemplateHtml(html); });
  }, []);

  // Computed — always up-to-date, no stale state
  const builderHtml = useMemo(() => {
    if (aiHtml) return aiHtml;
    const blocksHtml = blocks.map(b => b.html).join('');
    if (!blocks.length) return templateHtml || '';
    if (!templateHtml) return blocksHtml; // show blocks even if template not loaded
    return injectIntoSlot(templateHtml, blocksHtml);
  }, [blocks, templateHtml, aiHtml]);

  // Block management
  const addBlock = (name, html) => {
    setBlocks(prev => [...prev, { id: Date.now() + Math.random(), name, html }]);
    setAiHtml('');
  };
  const reorderBlock = (from, to) => {
    if (from === null || from === to) return;
    setBlocks(prev => {
      const a = [...prev];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
  };
  const removeBlock = (i) => setBlocks(prev => prev.filter((_, idx) => idx !== i));

  // Fetch content variants when project changes
  useEffect(() => {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) return;
    fetch(`${API_URL}/projects/${projectId}/content-variants`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setContentVariants(data.variants || {});
          setContentReady(data.ready || false);
        }
      })
      .catch(() => {});
  }, [pipeline.selectedTicket?.project_id]);

  // Pre-select ticket from URL param once tickets are loaded
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const ticket = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (ticket) pipeline.selectTicket(ticket);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  const handleExportHtml = () => {
    if (!builderHtml) return;
    const blob = new Blob([builderHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'chat',      label: t('studio.chat') },
    { id: 'blocks',    label: t('studio.blockLibrary') },
    { id: 'templates', label: t('studio.templates') },
    { id: 'tickets',   label: t('tickets.tab'), count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
  ];

  async function nameBlocksAsync(parsedBlocks) {
    try {
      const res = await fetch(`${API_URL}/ai/name-email-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocks: parsedBlocks.map(b => ({ id: b.id, html: b.html })) }),
      });
      if (!res.ok) return;
      const { named } = await res.json();
      setBlocks(prev => prev.map(b => {
        const match = named.find(n => n.id === b.id);
        if (!match) return b;
        const updatedHtml = b.html.replace(
          /data-block-name="[^"]*"/,
          `data-block-name="${match.name}"`
        );
        return { ...b, name: match.name, html: updatedHtml };
      }));
    } catch {}
  }

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
          {t('studio.backToAgent')}
        </button>
        {pipeline.selectedTicket && (
          <span className="studio-campaign-badge">{pipeline.selectedTicket.project_name}</span>
        )}
        <span className="studio-status-chip studio-status-building">● {t('studio.building')}</span>
        <div className="studio-topbar-actions">
          <button className="studio-action-primary" onClick={handleExportHtml} disabled={!builderHtml}>
            {t('studio.exportHtml')}
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`studio-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`studio-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="studio-body">
        {activeTab === 'chat' && (
          <div className="email-studio-split">
            <div className="email-builder-chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="email-left-panel-tabs">
                <button
                  className={`email-left-tab ${leftTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setLeftTab('chat')}
                >{t('emailBlocks.tabChat')}</button>
                <button
                  className={`email-left-tab ${leftTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setLeftTab('blocks')}
                >{t('emailBlocks.tabBlocks')}</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: leftTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
                <AgentChatSwitcher
                  agent={agent}
                  selectedTicket={pipeline.selectedTicket}
                  pipelineData={pipeline.pipelineData}
                  currentSession={pipeline.currentSession}
                  completedSessions={pipeline.completedSessions}
                  agents={pipeline.agents}
                  onClearTicket={pipeline.clearTicket}
                  onHandoffRequest={pipeline.setHandoffSession}
                  externalInput={chatInput}
                  onExternalInputConsumed={() => setChatInput('')}
                  currentHtml={builderHtml}
                  onHtmlGenerated={(html) => {
                    const merged = mergeAiHtmlIntoTemplate(templateHtml, html);
                    const parsed = splitIntoBlocks(merged);
                    if (parsed.length > 0) {
                      setBlocks(parsed);
                      setAiHtml('');
                      nameBlocksAsync(parsed);
                    } else {
                      setAiHtml(merged);
                      setBlocks([]);
                    }
                    setPatchedBlock(null);
                    setBuilderStatus('Email generado');
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                  onHtmlPatched={(blockName, fullPatchedHtml) => {
                    setBlocks(prev => {
                      const newBlocks = splitIntoBlocks(fullPatchedHtml);
                      if (newBlocks.length === 0) return prev;
                      return newBlocks.map((nb, i) => {
                        const patchedBlock = prev.find(b =>
                          b.name === blockName &&
                          nb.html.includes(`data-block-name="${blockName}"`)
                        );
                        if (patchedBlock) return { ...patchedBlock, html: nb.html };
                        const byPos = prev[i];
                        return byPos ? { ...byPos, html: nb.html } : nb;
                      });
                    });
                    setPatchedBlock(blockName);
                    setBuilderStatus(`${blockName} actualizado`);
                    setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                  }}
                  onHtmlBlock={(block) => {
                    addBlock(block.title, block.htmlSource);
                    setBuilderStatus(`${block.title} añadido`);
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                />
              </div>
              {leftTab === 'blocks' && <EmailBlocksPanel />}
            </div>
            <EmailBuilderPreview
              html={blocks.length ? null : builderHtml}
              blocks={blocks.length ? blocks : null}
              templateHtml={templateHtml}
              onReorderBlocks={reorderBlock}
              onRemoveBlock={removeBlock}
              patchedBlock={patchedBlock}
              statusMessage={builderStatus}
              projectId={pipeline.selectedTicket?.project_id}
              contentVariants={contentVariants}
              contentReady={contentReady}
              onBlockClick={(blockName) => setChatInput(`[bloque: ${blockName}] `)}
              onBlockDrop={(block) => {
                addBlock(block.name, block.html);
                setBuilderStatus(t('emailBlocks.added').replace('{name}', block.name));
                setTimeout(() => setBuilderStatus(''), 3000);
              }}
            />
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="studio-full-panel">
            <AgentTicketsPanel
              tickets={pipeline.tickets}
              selectedTicket={pipeline.selectedTicket}
              onSelectTicket={pipeline.selectTicket}
              onClearTicket={pipeline.clearTicket}
              agentId={AGENT_ID}
            />
          </div>
        )}
        {(activeTab === 'blocks' || activeTab === 'templates') && (
          <div className="studio-full-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 12 }}>Vuelve al agente para acceder a este panel.</p>
            <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
              {t('studio.backToAgent')}
            </button>
          </div>
        )}
      </div>

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
