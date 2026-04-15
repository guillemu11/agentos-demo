import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import AgentChatSwitcher from '../components/agent-views/shared/AgentChatSwitcher.jsx';
import EmailBuilderPreview from '../components/EmailBuilderPreview.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';
import EmailBlocksPanel from '../components/EmailBlocksPanel.jsx';
import VariantPreviewModal from '../components/VariantPreviewModal.jsx';
import { injectIntoSlot, mergeAiHtmlIntoTemplate, fetchEmailTemplate, splitIntoBlocks } from '../utils/emailTemplate.js';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';
import { Pencil, FlaskConical, Star, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'html-developer';

function TemplateCard({ template, contentReady, contentVariants, projectId, deletingId, setDeletingId, onRefresh, onEdit, t }) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(template.variant_name || '');
  const [showModal, setShowModal] = useState(false);
  const isFinal = template.status === 'approved';

  async function saveName() {
    if (!nameValue.trim() || nameValue === template.variant_name) { setEditingName(false); return; }
    try {
      const res = await fetch(`${API_URL}/emails/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ variant_name: nameValue.trim() }),
      });
      setEditingName(false);
      if (res.ok) onRefresh();
    } catch { setEditingName(false); }
  }

  async function setAsFinal() {
    try {
      const res = await fetch(`${API_URL}/emails/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ set_final: true, project_id: projectId }),
      });
      if (res.ok) onRefresh();
    } catch {}
  }

  async function deleteTemplate() {
    try {
      const res = await fetch(`${API_URL}/emails/${template.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setDeletingId(null);
      if (res.ok) onRefresh();
    } catch { setDeletingId(null); }
  }

  const date = new Date(template.created_at).toLocaleDateString();

  return (
    <div className={`email-template-card${isFinal ? ' email-template-card--final' : ''}`}>
      {/* Thumbnail */}
      <div className="email-template-thumb">
        <iframe
          sandbox="allow-same-origin"
          srcDoc={substituteForPreview(template.html_content || '')}
          className="email-template-thumb-iframe"
          scrolling="no"
          tabIndex={-1}
        />
      </div>

      {/* Info */}
      <div className="email-template-info">
        <div className="email-template-name-row">
          {editingName ? (
            <input
              className="email-template-name-input"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
            />
          ) : (
            <span className="email-template-name" onClick={() => setEditingName(true)} title={t('studio.templateRenameHint')}>
              {template.variant_name || t('studio.templateNoName')}
            </span>
          )}
          <span className={`email-template-badge${isFinal ? ' email-template-badge--final' : ''}`}>
            {isFinal ? t('studio.templateFinal') : t('studio.templateDraft')}
          </span>
        </div>
        <span className="email-template-date">{date}</span>

        <div className="email-template-actions">
          <button
            className="email-template-btn email-template-btn--edit"
            onClick={() => onEdit(template)}
          >
            <Pencil size={13} style={{ verticalAlign: 'middle' }} /> {t('studio.templateEdit')}
          </button>
          <button
            className="email-template-btn email-template-btn--test"
            onClick={() => setShowModal(true)}
            disabled={!contentReady}
            title={!contentReady ? t('emailBuilder.waitingVariants') : t('emailBuilder.previewTest')}
          >
            <FlaskConical size={13} style={{ verticalAlign: 'middle' }} /> {t('emailBuilder.previewTest')}
          </button>
          {!isFinal ? (
            <button className="email-template-btn email-template-btn--use" onClick={setAsFinal}>
              <Star size={13} style={{ verticalAlign: 'middle' }} /> {t('studio.templateUseThis')}
            </button>
          ) : (
            <span className="email-template-btn email-template-btn--chosen">✓ {t('studio.templateUseThis')}</span>
          )}
          {deletingId === template.id ? (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('studio.templateDeleteConfirm')}</span>
              <button className="email-template-btn email-template-btn--danger" onClick={deleteTemplate}>{t('studio.templateDeleteYes')}</button>
              <button className="email-template-btn" onClick={() => setDeletingId(null)}>{t('studio.templateDeleteNo')}</button>
            </>
          ) : (
            <button className="email-template-btn email-template-btn--delete" onClick={() => setDeletingId(template.id)}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <VariantPreviewModal
          html={template.html_content}
          contentVariants={contentVariants}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

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
  const [editingTemplate, setEditingTemplate] = useState(null); // {id, name} when editing existing
  const [templateHtml, setTemplateHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [contentVariants, setContentVariants] = useState({});
  const [contentReady, setContentReady] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const pipeline = useAgentPipelineSession(AGENT_ID);
  const importFileRef = useRef(null);

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

  async function fetchTemplates() {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : (data.emails || []));
      }
    } catch {}
    setTemplatesLoading(false);
  }

  function loadTemplateIntoBuilder(template) {
    const parsed = splitIntoBlocks(template.html_content || '');
    if (parsed.length > 0) {
      setBlocks(parsed);
      setAiHtml('');
    } else {
      setAiHtml(template.html_content || '');
      setBlocks([]);
    }
    setEditingTemplate({ id: template.id, name: template.variant_name || '' });
    setActiveTab('chat');
    setBuilderStatus(`Cargado: ${template.variant_name || 'template'}`);
    setTimeout(() => setBuilderStatus(''), 3000);
  }

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

  useEffect(() => {
    if (activeTab === 'templates' && pipeline.selectedTicket?.project_id) {
      fetchTemplates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pipeline.selectedTicket?.project_id]);

  // Pre-select ticket from URL param once tickets are loaded
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const ticket = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (ticket) pipeline.selectTicket(ticket);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  const handleImportHtml = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    setBuilderStatus(t('studio.importHtmlHint'));
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/parse-html`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBuilderStatus(err.error || t('studio.importHtmlError'));
        setTimeout(() => setBuilderStatus(''), 4000);
        return;
      }

      const { html } = await res.json();
      const parsed = splitIntoBlocks(html);

      if (parsed.length > 0) {
        setBlocks(parsed);
        setAiHtml('');
        nameBlocksAsync(parsed);
        setBuilderStatus(t('studio.importHtmlSuccess').replace('{count}', parsed.length));
      } else {
        // No top-level <table> blocks found — show as monolithic HTML
        setAiHtml(html);
        setBlocks([]);
        setBuilderStatus(t('studio.importHtmlSuccess').replace('{count}', '0'));
      }
      setPatchedBlock(null);
      setEditingTemplate(null);
      setActiveTab('chat');
      setTimeout(() => setBuilderStatus(''), 3000);
    } catch (err) {
      console.error('[importHtml] error:', err);
      setBuilderStatus(t('studio.importHtmlError'));
      setTimeout(() => setBuilderStatus(''), 4000);
    }
  };

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
          <input
            ref={importFileRef}
            type="file"
            accept=".html,text/html"
            style={{ display: 'none' }}
            onChange={handleImportHtml}
          />
          <button
            className="studio-action-secondary"
            onClick={() => importFileRef.current?.click()}
            title={t('studio.importHtmlHint')}
          >
            {t('studio.importHtml')}
          </button>
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
              saveHtml={builderHtml}
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
              editingTemplate={editingTemplate}
              onTemplateSaved={() => { setEditingTemplate(null); fetchTemplates(); setActiveTab('templates'); }}
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
              completedTickets={pipeline.completedTickets}
              onReopenComplete={pipeline.onReopenComplete}
            />
          </div>
        )}
        {activeTab === 'blocks' && (
          <div className="studio-full-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 12 }}>Vuelve al agente para acceder a este panel.</p>
            <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
              {t('studio.backToAgent')}
            </button>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="studio-full-panel email-templates-panel">
            {templatesLoading && <p style={{ color: 'var(--text-muted)', padding: 24 }}>{t('studio.templatesLoading')}</p>}
            {!templatesLoading && templates.length === 0 && (
              <p className="email-templates-empty">{t('studio.noTemplates')}</p>
            )}
            {!templatesLoading && templates.length > 0 && (
              <div className="email-template-list">
                {templates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    contentReady={contentReady}
                    contentVariants={contentVariants}
                    projectId={pipeline.selectedTicket?.project_id}
                    deletingId={deletingId}
                    setDeletingId={setDeletingId}
                    onRefresh={fetchTemplates}
                    onEdit={loadTemplateIntoBuilder}
                    t={t}
                  />
                ))}
              </div>
            )}
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
          currentHtml={builderHtml}
          onComplete={(result) => {
            pipeline.onHandoffComplete(result);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}
