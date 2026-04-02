import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { Plus, X, RotateCw, Save, Trash2, Globe, Mail, Link2, Cog, Webhook } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CONNECTION_TYPES = [
  { id: 'slack', label: 'Slack', icon: <Globe size={16} /> },
  { id: 'email', label: 'Email', icon: <Mail size={16} /> },
  { id: 'webhook', label: 'Webhook', icon: <Link2 size={16} /> },
  { id: 'api', label: 'API', icon: <Cog size={16} /> },
];

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

function normalizeSkill(s) {
  if (typeof s === 'string') return { name: s, description: '', level: 'intermediate' };
  return { name: s.name || '', description: s.description || '', level: s.level || 'intermediate' };
}

export default function AgentSettingsPanel({ agentId }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('personality');
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  // Editable state per section
  const [personality, setPersonality] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [voiceRules, setVoiceRules] = useState('');
  const [ragNamespaces, setRagNamespaces] = useState([]);
  const [newNamespace, setNewNamespace] = useState('');

  const [budgetMax, setBudgetMax] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState('monthly');

  const [connections, setConnections] = useState([]);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [newConn, setNewConn] = useState({ type: 'slack', name: '', url: '', token: '', channel: '', enabled: true });

  const [skills, setSkills] = useState([]);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', description: '', level: 'intermediate' });

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/agents/${agentId}/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        // Personality section: show DB override or default
        setPersonality(data.personality || data.default_personality || '');
        setVoiceName(data.voice_name || data.default_voice_name || '');
        setVoiceRules(data.voice_rules || data.default_voice_rules || '');
        setRagNamespaces(data.rag_namespaces || data.default_rag_namespaces || []);
        // Budget
        setBudgetMax(data.budget_max != null ? String(data.budget_max) : '');
        setBudgetPeriod(data.budget_period || 'monthly');
        // Connections
        setConnections(Array.isArray(data.connections) ? data.connections : []);
        // Skills
        setSkills((data.skills || []).map(normalizeSkill));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentId]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function saveSection(fields) {
    const sectionKey = subTab;
    setSaving(prev => ({ ...prev, [sectionKey]: true }));
    try {
      const res = await fetch(`${API_URL}/agents/${agentId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
      showToast(t('agentSettings.saved'));
    } catch {
      showToast(t('agentSettings.errorSaving'), 'error');
    } finally {
      setSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }

  async function resetPersonality() {
    if (!window.confirm(t('agentSettings.resetConfirm'))) return;
    try {
      await fetch(`${API_URL}/agents/${agentId}/settings/reset-personality`, {
        method: 'POST',
        credentials: 'include',
      });
      setPersonality(settings.default_personality || '');
      setVoiceName(settings.default_voice_name || '');
      setVoiceRules(settings.default_voice_rules || '');
      setRagNamespaces(settings.default_rag_namespaces || []);
      setSettings(prev => ({ ...prev, personality: null, voice_name: null, voice_rules: null, rag_namespaces: null }));
      showToast(t('agentSettings.saved'));
    } catch {
      showToast(t('agentSettings.errorSaving'), 'error');
    }
  }

  function isPersonalityCustom() {
    if (!settings) return false;
    return settings.personality != null || settings.voice_name != null || settings.voice_rules != null;
  }

  function addNamespace() {
    const ns = newNamespace.trim().toLowerCase();
    if (ns && !ragNamespaces.includes(ns)) {
      setRagNamespaces([...ragNamespaces, ns]);
      setNewNamespace('');
    }
  }

  function removeNamespace(ns) {
    setRagNamespaces(ragNamespaces.filter(n => n !== ns));
  }

  function addConnection() {
    if (!newConn.name.trim()) return;
    setConnections([...connections, { ...newConn, id: Date.now().toString() }]);
    setNewConn({ type: 'slack', name: '', url: '', token: '', channel: '', enabled: true });
    setShowAddConnection(false);
  }

  function toggleConnection(idx) {
    setConnections(connections.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c));
  }

  function removeConnection(idx) {
    if (!window.confirm(t('agentSettings.connectionDeleteConfirm'))) return;
    setConnections(connections.filter((_, i) => i !== idx));
  }

  function addSkill() {
    if (!newSkill.name.trim()) return;
    setSkills([...skills, { ...newSkill }]);
    setNewSkill({ name: '', description: '', level: 'intermediate' });
    setShowAddSkill(false);
  }

  function removeSkill(idx) {
    setSkills(skills.filter((_, i) => i !== idx));
  }

  if (loading) {
    return <div className="agent-settings-panel"><div className="empty-state">{t('agentDetail.loadingAgent')}</div></div>;
  }

  const subTabs = [
    { id: 'personality', label: t('agentSettings.personality') },
    { id: 'budget', label: t('agentSettings.budget') },
    { id: 'connections', label: t('agentSettings.connections') },
    { id: 'skills', label: t('agentSettings.skills') },
  ];

  const budgetSpent = parseFloat(settings?.budget_spent) || 0;
  const budgetMaxNum = parseFloat(budgetMax) || 0;
  const budgetPct = budgetMaxNum > 0 ? Math.min((budgetSpent / budgetMaxNum) * 100, 100) : 0;

  return (
    <div className="agent-settings-panel">
      {/* Toast */}
      {toast && (
        <div className={`agent-settings-toast ${toast.type}`}>{toast.msg}</div>
      )}

      {/* Sub-tabs */}
      <div className="agent-settings-subtabs">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            className={`agent-settings-subtab ${subTab === tab.id ? 'active' : ''}`}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Personality ───────────────────────────────────────────── */}
      {subTab === 'personality' && (
        <div className="agent-settings-section">
          <div className="agent-settings-section-header">
            <span className={`agent-settings-badge ${isPersonalityCustom() ? 'custom' : 'default'}`}>
              {isPersonalityCustom() ? t('agentSettings.personalityIsCustom') : t('agentSettings.personalityIsDefault')}
            </span>
            {isPersonalityCustom() && (
              <button className="agent-settings-reset-btn" onClick={resetPersonality}>
                <RotateCw size={14} /> {t('agentSettings.resetToDefault')}
              </button>
            )}
          </div>

          <div className="agent-settings-form-group">
            <label>{t('agentSettings.personalityLabel')}</label>
            <textarea
              className="agent-settings-personality-editor"
              value={personality}
              onChange={e => setPersonality(e.target.value)}
              placeholder={t('agentSettings.personalityPlaceholder')}
              rows={10}
            />
          </div>

          <div className="agent-settings-row">
            <div className="agent-settings-form-group" style={{ flex: 1 }}>
              <label>{t('agentSettings.voiceName')}</label>
              <input
                type="text"
                value={voiceName}
                onChange={e => setVoiceName(e.target.value)}
                placeholder="Orus, Aoede, Kore..."
              />
            </div>
          </div>

          <div className="agent-settings-form-group">
            <label>{t('agentSettings.voiceRules')}</label>
            <textarea
              value={voiceRules}
              onChange={e => setVoiceRules(e.target.value)}
              placeholder={t('agentSettings.voiceRulesPlaceholder')}
              rows={3}
            />
          </div>

          <div className="agent-settings-form-group">
            <label>{t('agentSettings.ragNamespaces')}</label>
            <div className="agent-settings-chips">
              {ragNamespaces.map(ns => (
                <span key={ns} className="agent-settings-chip">
                  {ns}
                  <button onClick={() => removeNamespace(ns)} className="agent-settings-chip-remove"><X size={12} /></button>
                </span>
              ))}
              <div className="agent-settings-chip-input">
                <input
                  type="text"
                  value={newNamespace}
                  onChange={e => setNewNamespace(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNamespace())}
                  placeholder={t('agentSettings.ragPlaceholder')}
                />
                <button onClick={addNamespace} className="agent-settings-chip-add"><Plus size={14} /></button>
              </div>
            </div>
          </div>

          <button
            className="agent-settings-save-btn"
            disabled={saving.personality}
            onClick={() => saveSection({
              personality: personality || null,
              voice_name: voiceName || null,
              voice_rules: voiceRules || null,
              rag_namespaces: ragNamespaces.length > 0 ? ragNamespaces : null,
            }).then(() => {
              setSettings(prev => ({
                ...prev,
                personality: personality || null,
                voice_name: voiceName || null,
                voice_rules: voiceRules || null,
                rag_namespaces: ragNamespaces.length > 0 ? ragNamespaces : null,
              }));
            })}
          >
            <Save size={14} /> {saving.personality ? t('agentSettings.saving') : t('agentSettings.save')}
          </button>
        </div>
      )}

      {/* ─── Budget ────────────────────────────────────────────────── */}
      {subTab === 'budget' && (
        <div className="agent-settings-section">
          <div className="agent-settings-row">
            <div className="agent-settings-form-group" style={{ flex: 2 }}>
              <label>{t('agentSettings.maxBudget')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="agent-settings-form-group" style={{ flex: 1 }}>
              <label>{t('agentSettings.budgetPeriod')}</label>
              <select value={budgetPeriod} onChange={e => setBudgetPeriod(e.target.value)}>
                <option value="daily">{t('agentSettings.budgetDaily')}</option>
                <option value="weekly">{t('agentSettings.budgetWeekly')}</option>
                <option value="monthly">{t('agentSettings.budgetMonthly')}</option>
              </select>
            </div>
          </div>

          {budgetMaxNum > 0 && (
            <div className="agent-settings-budget-display">
              <div className="agent-settings-budget-labels">
                <span>{t('agentSettings.budgetSpent')}: ${budgetSpent.toFixed(2)}</span>
                <span>{t('agentSettings.budgetRemaining')}: ${(budgetMaxNum - budgetSpent).toFixed(2)}</span>
              </div>
              <div className="agent-settings-budget-bar">
                <div
                  className="agent-settings-budget-fill"
                  style={{
                    width: `${budgetPct}%`,
                    background: budgetPct > 90 ? 'var(--accent-red, #ef4444)' : budgetPct > 70 ? 'var(--accent-yellow)' : 'var(--accent-green)',
                  }}
                />
              </div>
              <div className="agent-settings-budget-total">
                ${budgetSpent.toFixed(2)} {t('agentSettings.budgetOf')} ${budgetMaxNum.toFixed(2)}
              </div>
            </div>
          )}

          {!budgetMaxNum && (
            <div className="agent-settings-empty-hint">{t('agentSettings.noBudget')}</div>
          )}

          <button
            className="agent-settings-save-btn"
            disabled={saving.budget}
            onClick={() => saveSection({
              budget_max: budgetMax ? parseFloat(budgetMax) : null,
              budget_period: budgetPeriod,
            })}
          >
            <Save size={14} /> {saving.budget ? t('agentSettings.saving') : t('agentSettings.save')}
          </button>
        </div>
      )}

      {/* ─── Connections ───────────────────────────────────────────── */}
      {subTab === 'connections' && (
        <div className="agent-settings-section">
          {connections.length === 0 && !showAddConnection && (
            <div className="empty-state">{t('agentSettings.noConnections')}</div>
          )}

          {connections.map((conn, idx) => {
            const typeInfo = CONNECTION_TYPES.find(ct => ct.id === conn.type) || CONNECTION_TYPES[3];
            return (
              <div key={conn.id || idx} className="agent-settings-connection-card">
                <div className="agent-settings-connection-info">
                  <span className="agent-settings-connection-icon">{typeInfo.icon}</span>
                  <div>
                    <div className="agent-settings-connection-name">{conn.name || typeInfo.label}</div>
                    {conn.url && <div className="agent-settings-connection-url">{conn.url}</div>}
                  </div>
                </div>
                <div className="agent-settings-connection-actions">
                  <button
                    className={`agent-settings-toggle ${conn.enabled ? 'enabled' : ''}`}
                    onClick={() => toggleConnection(idx)}
                    title={conn.enabled ? t('agentSettings.connectionEnabled') : t('agentSettings.connectionDisabled')}
                  >
                    <div className="agent-settings-toggle-knob" />
                  </button>
                  <button className="agent-settings-icon-btn danger" onClick={() => removeConnection(idx)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {showAddConnection && (
            <div className="agent-settings-add-form card">
              <div className="agent-settings-row">
                <div className="agent-settings-form-group" style={{ flex: 1 }}>
                  <label>{t('agentSettings.connectionType')}</label>
                  <select value={newConn.type} onChange={e => setNewConn({ ...newConn, type: e.target.value })}>
                    {CONNECTION_TYPES.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.label}</option>
                    ))}
                  </select>
                </div>
                <div className="agent-settings-form-group" style={{ flex: 2 }}>
                  <label>{t('agentSettings.connectionName')}</label>
                  <input
                    type="text"
                    value={newConn.name}
                    onChange={e => setNewConn({ ...newConn, name: e.target.value })}
                    placeholder="My Slack Bot"
                  />
                </div>
              </div>
              <div className="agent-settings-form-group">
                <label>{t('agentSettings.connectionUrl')}</label>
                <input
                  type="text"
                  value={newConn.url}
                  onChange={e => setNewConn({ ...newConn, url: e.target.value })}
                  placeholder="https://hooks.slack.com/..."
                />
              </div>
              <div className="agent-settings-row">
                <div className="agent-settings-form-group" style={{ flex: 1 }}>
                  <label>{t('agentSettings.connectionToken')}</label>
                  <input
                    type="password"
                    value={newConn.token}
                    onChange={e => setNewConn({ ...newConn, token: e.target.value })}
                    placeholder="xoxb-..."
                  />
                </div>
                <div className="agent-settings-form-group" style={{ flex: 1 }}>
                  <label>{t('agentSettings.connectionChannel')}</label>
                  <input
                    type="text"
                    value={newConn.channel}
                    onChange={e => setNewConn({ ...newConn, channel: e.target.value })}
                    placeholder="#general"
                  />
                </div>
              </div>
              <div className="agent-settings-add-form-actions">
                <button className="agent-settings-cancel-btn" onClick={() => setShowAddConnection(false)}>
                  {t('agentDetail.cancel')}
                </button>
                <button className="agent-settings-save-btn small" onClick={addConnection}>
                  <Plus size={14} /> {t('agentSettings.addConnection')}
                </button>
              </div>
            </div>
          )}

          <div className="agent-settings-section-footer">
            {!showAddConnection && (
              <button className="agent-settings-add-btn" onClick={() => setShowAddConnection(true)}>
                <Plus size={14} /> {t('agentSettings.addConnection')}
              </button>
            )}
            <button
              className="agent-settings-save-btn"
              disabled={saving.connections}
              onClick={() => saveSection({ connections })}
            >
              <Save size={14} /> {saving.connections ? t('agentSettings.saving') : t('agentSettings.save')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Skills ────────────────────────────────────────────────── */}
      {subTab === 'skills' && (
        <div className="agent-settings-section">
          {skills.length === 0 && !showAddSkill && (
            <div className="empty-state">{t('agentSettings.noSkills')}</div>
          )}

          <div className="agent-settings-skills-list">
            {skills.map((skill, idx) => (
              <div key={idx} className="agent-settings-skill-chip">
                <div className="agent-settings-skill-info">
                  <span className="agent-settings-skill-name">{skill.name}</span>
                  <span className={`agent-settings-skill-level ${skill.level}`}>
                    {t(`agentSettings.skill${skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}`)}
                  </span>
                </div>
                {skill.description && (
                  <div className="agent-settings-skill-desc">{skill.description}</div>
                )}
                <button className="agent-settings-chip-remove" onClick={() => removeSkill(idx)} title={t('agentSettings.removeSkill')}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {showAddSkill && (
            <div className="agent-settings-add-form card">
              <div className="agent-settings-row">
                <div className="agent-settings-form-group" style={{ flex: 2 }}>
                  <label>{t('agentSettings.skillName')}</label>
                  <input
                    type="text"
                    value={newSkill.name}
                    onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                    placeholder="Copywriting"
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                  />
                </div>
                <div className="agent-settings-form-group" style={{ flex: 1 }}>
                  <label>{t('agentSettings.skillLevel')}</label>
                  <select value={newSkill.level} onChange={e => setNewSkill({ ...newSkill, level: e.target.value })}>
                    {SKILL_LEVELS.map(lv => (
                      <option key={lv} value={lv}>
                        {t(`agentSettings.skill${lv.charAt(0).toUpperCase() + lv.slice(1)}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="agent-settings-form-group">
                <label>{t('agentSettings.skillDescription')}</label>
                <input
                  type="text"
                  value={newSkill.description}
                  onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                  placeholder={t('agentSettings.skillDescription')}
                />
              </div>
              <div className="agent-settings-add-form-actions">
                <button className="agent-settings-cancel-btn" onClick={() => setShowAddSkill(false)}>
                  {t('agentDetail.cancel')}
                </button>
                <button className="agent-settings-save-btn small" onClick={addSkill}>
                  <Plus size={14} /> {t('agentSettings.addSkill')}
                </button>
              </div>
            </div>
          )}

          <div className="agent-settings-section-footer">
            {!showAddSkill && (
              <button className="agent-settings-add-btn" onClick={() => setShowAddSkill(true)}>
                <Plus size={14} /> {t('agentSettings.addSkill')}
              </button>
            )}
            <button
              className="agent-settings-save-btn"
              disabled={saving.skills}
              onClick={() => saveSection({ skills })}
            >
              <Save size={14} /> {saving.skills ? t('agentSettings.saving') : t('agentSettings.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
