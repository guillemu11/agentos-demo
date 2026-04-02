import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import PIPELINE_TEMPLATES from '../data/pipelineTemplates.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function PipelineSelector({ projectId, onCreated }) {
    const { t } = useLanguage();
    const [step, setStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [stages, setStages] = useState([]);
    const [agents, setAgents] = useState([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/agents`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setAgents(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const selectTemplate = (key) => {
        const template = PIPELINE_TEMPLATES[key];
        setSelectedTemplate(key);
        setStages(template.stages.map(s => ({ ...s })));
        setStep(2);
    };

    const updateStageAgent = (index, agentId) => {
        setStages(prev => prev.map((s, i) => i === index ? { ...s, agent_id: agentId } : s));
    };

    const removeStage = (index) => {
        setStages(prev => {
            const updated = prev.filter((_, i) => i !== index);
            return updated.map(s => ({
                ...s,
                depends_on: (s.depends_on || [])
                    .filter(d => d !== index)
                    .map(d => d > index ? d - 1 : d)
            }));
        });
    };

    const moveStage = (index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === stages.length - 1)) return;
        setStages(prev => {
            const updated = [...prev];
            const swap = index + direction;
            [updated[index], updated[swap]] = [updated[swap], updated[index]];
            return updated;
        });
    };

    const createPipeline = async () => {
        if (stages.some(s => !s.agent_id)) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    template_id: selectedTemplate,
                    stages: stages.map(s => ({
                        name: s.name, agent_id: s.agent_id, department: s.department,
                        description: s.description, depends_on: s.depends_on || [],
                        gate_type: s.gate_type || 'none', namespaces: s.namespaces || [],
                    }))
                })
            });
            if (res.ok && onCreated) onCreated(await res.json());
        } catch (err) {
            console.error('Failed to create pipeline:', err);
        } finally {
            setCreating(false);
        }
    };

    const templateNames = {
        campaign: t('pipeline.templateCampaign'),
        flash_sale: t('pipeline.templateFlashSale'),
        seasonal: t('pipeline.templateSeasonal'),
        general: t('pipeline.templateGeneral'),
    };

    if (step === 1) {
        return (
            <div className="pipeline-container">
                <h3>{t('pipeline.selectTemplate')}</h3>
                <div className="pipeline-templates">
                    {Object.entries(PIPELINE_TEMPLATES).map(([key, tmpl]) => (
                        <div key={key} className="pipeline-template-card" onClick={() => selectTemplate(key)}>
                            <h3>{templateNames[key] || tmpl.name}</h3>
                            <span className="stage-count">{tmpl.stages.length} {t('pipeline.stages')}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="pipeline-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>{t('pipeline.reviewStages')}</h3>
                <button className="back-button" onClick={() => setStep(1)}>← {t('pipeline.selectTemplate')}</button>
            </div>
            <div className="pipeline-stage-editor">
                {stages.map((stage, i) => (
                    <div key={i} className="pipeline-stage-row">
                        <span className="stage-order">{i}</span>
                        <div className="stage-info">
                            <div className="stage-name">{stage.name}</div>
                            <div className="stage-dept">{stage.department}</div>
                        </div>
                        <select value={stage.agent_id || ''} onChange={e => updateStageAgent(i, e.target.value)}>
                            <option value="">{t('pipeline.assignAgent')}</option>
                            {agents
                                .filter(a => !stage.department || a.department === stage.department)
                                .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            {agents.filter(a => a.department === stage.department).length === 0 &&
                                agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.department})</option>)}
                        </select>
                        {stage.gate_type === 'human_approval' && <span className="gate-badge">🔒 Gate</span>}
                        <div className="stage-actions">
                            <button onClick={() => moveStage(i, -1)} disabled={i === 0}>↑</button>
                            <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1}>↓</button>
                            <button onClick={() => removeStage(i)}>×</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="back-button" onClick={() => { setSelectedTemplate(null); setStep(1); }}>
                    {t('pipeline.cancel')}
                </button>
                <button className="back-button save-btn" onClick={createPipeline}
                    disabled={creating || stages.some(s => !s.agent_id)}>
                    {creating ? '...' : t('pipeline.confirm')}
                </button>
            </div>
        </div>
    );
}
