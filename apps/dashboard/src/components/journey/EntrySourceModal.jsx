import { useEffect, useState } from 'react';
import { Database, X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function EntrySourceModal({ open, journeyId, dsl, onClose, onSaved }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('description');
  const [description, setDescription] = useState('');
  const [sql, setSql] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const source = dsl?.entry?.source;
  const sqlInvalid = sql.trim().length > 0 && !/^\s*SELECT\b/i.test(sql);

  useEffect(() => {
    if (!open || !source) return;
    setSql(source.sql || '');
    setError(null);
    setValidationErrors([]);
    setActiveTab('description');

    if (source.description) {
      setDescription(source.description);
      return;
    }

    setDescription('');
    setGenerating(true);
    fetch(`${API}/journeys/${journeyId}/entry/describe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: source.sql,
        master_de_key: source.master_de_key,
        target_de_name: source.target_de_name,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ description: generated }) => setDescription(generated))
      .catch((err) => setError(t('journeys.entryModal.errorGenerate') + ': ' + err.message))
      .finally(() => setGenerating(false));
  }, [open, source?.sql, source?.description]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    try {
      const resp = await fetch(`${API}/journeys/${journeyId}/entry`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, sql }),
      });
      if (resp.status === 400) {
        const data = await resp.json();
        setValidationErrors(data.errors || [data.error]);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { dsl: newDsl } = await resp.json();
      onSaved(newDsl);
    } catch (err) {
      setError(t('journeys.entryModal.errorSave') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !source) return null;

  return (
    <div className="esm" role="dialog" aria-modal="true" aria-labelledby="esm-title">
      <button className="esm__scrim" onClick={onClose} aria-label={t('journeys.entryModal.close')} />
      <div className="esm__panel">

        <div className="esm__header">
          <h2 id="esm-title" className="esm__title">
            <Database size={15} strokeWidth={2} />
            {t('journeys.entryModal.title')}
          </h2>
          <button className="esm__close" onClick={onClose} aria-label={t('journeys.entryModal.close')}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="esm__tabs">
          <button
            className={`esm__tab${activeTab === 'description' ? ' esm__tab--active' : ''}`}
            onClick={() => setActiveTab('description')}
          >
            {t('journeys.entryModal.tabDescription')}
          </button>
          <button
            className={`esm__tab${activeTab === 'sql' ? ' esm__tab--active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            {t('journeys.entryModal.tabSql')}
          </button>
        </div>

        <div className="esm__body">
          {activeTab === 'description' && (
            <>
              {generating && (
                <div className="esm__generating">
                  <div className="esm__spinner" />
                  {t('journeys.entryModal.generatingDescription')}
                </div>
              )}
              <textarea
                className="esm__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={generating}
              />
            </>
          )}

          {activeTab === 'sql' && (
            <>
              <textarea
                className="esm__textarea esm__textarea--sql"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                spellCheck={false}
              />
              {sqlInvalid && (
                <div className="esm__sql-warning">
                  <AlertTriangle size={12} strokeWidth={2} />
                  {t('journeys.entryModal.sqlWarning')}
                </div>
              )}
            </>
          )}

          {validationErrors.length > 0 && (
            <div className="esm__error">{validationErrors.join(' \u00b7 ')}</div>
          )}
          {error && <div className="esm__error">{error}</div>}
        </div>

        <div className="esm__footer">
          <button className="esm__btn esm__btn--ghost" onClick={onClose} disabled={saving}>
            {t('journeys.entryModal.close')}
          </button>
          <button
            className="esm__btn esm__btn--primary"
            onClick={handleSave}
            disabled={saving || generating || sqlInvalid}
          >
            {saving ? '\u2026' : t('journeys.entryModal.saveBtn')}
          </button>
        </div>

      </div>
    </div>
  );
}
