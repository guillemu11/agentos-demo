import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ProjectEmailsTab({ projectId }) {
  const { t } = useLanguage();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [versionIndex, setVersionIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setEmails(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  // Derive available options from data
  const allMarkets = useMemo(() => [...new Set(emails.map(e => e.market))].sort(), [emails]);
  const allLanguages = useMemo(() => [...new Set(emails.map(e => e.language))].sort(), [emails]);
  const allTiers = useMemo(() => [...new Set(emails.map(e => e.tier).filter(Boolean))].sort(), [emails]);

  // Valid languages for selected market
  const validLanguages = useMemo(() => {
    if (!selectedMarket) return allLanguages;
    return [...new Set(emails.filter(e => e.market === selectedMarket).map(e => e.language))].sort();
  }, [emails, selectedMarket, allLanguages]);

  // Valid tiers for selected market + language
  const validTiers = useMemo(() => {
    if (!selectedMarket && !selectedLanguage) return allTiers;
    return [...new Set(
      emails
        .filter(e => (!selectedMarket || e.market === selectedMarket) && (!selectedLanguage || e.language === selectedLanguage))
        .map(e => e.tier).filter(Boolean)
    )].sort();
  }, [emails, selectedMarket, selectedLanguage, allTiers]);

  // Auto-select first valid option when market changes
  useEffect(() => {
    if (selectedMarket && !validLanguages.includes(selectedLanguage)) {
      setSelectedLanguage(validLanguages[0] || null);
    }
  }, [selectedMarket, validLanguages]);

  useEffect(() => {
    if ((selectedMarket || selectedLanguage) && selectedTier && !validTiers.includes(selectedTier)) {
      setSelectedTier(validTiers[0] || null);
    }
  }, [selectedMarket, selectedLanguage, validTiers]);

  // Auto-select first market on load
  useEffect(() => {
    if (allMarkets.length > 0 && !selectedMarket) setSelectedMarket(allMarkets[0]);
  }, [allMarkets]);

  // Reset version index when filters change
  useEffect(() => { setVersionIndex(0); }, [selectedMarket, selectedLanguage, selectedTier]);

  // Filtered versions matching current selection
  const matchingVersions = useMemo(() => {
    return emails.filter(e =>
      (!selectedMarket   || e.market    === selectedMarket) &&
      (!selectedLanguage || e.language  === selectedLanguage) &&
      (!selectedTier     || e.tier      === selectedTier)
    ).sort((a, b) => b.version - a.version);
  }, [emails, selectedMarket, selectedLanguage, selectedTier]);

  const currentEmail = matchingVersions[versionIndex] || null;

  function handleExport() {
    if (!currentEmail?.html_content) return;
    const blob = new Blob([currentEmail.html_content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${currentEmail.market}-${currentEmail.language}-v${currentEmail.version}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const invalidLanguages = allLanguages.filter(l => !validLanguages.includes(l));
  const invalidTiers = allTiers.filter(t => !validTiers.includes(t));

  if (loading) return <div className="empty-state">Cargando emails...</div>;
  if (emails.length === 0) return <div className="empty-state">{t('emailBuilder.noEmailVersions')}</div>;

  return (
    <div className="project-emails-tab">
      {/* Filtros dependientes */}
      <div className="email-filters-bar">
        {/* Mercado */}
        <div className="email-filter-section">
          <div className="email-filter-label">{t('emailBuilder.filterMarket')}</div>
          <div className="email-filter-pills">
            {allMarkets.map(m => (
              <button
                key={m}
                className={`email-filter-pill ${selectedMarket === m ? 'active' : ''}`}
                onClick={() => setSelectedMarket(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {/* Idioma */}
        <div className="email-filter-section">
          <div className="email-filter-label">{t('emailBuilder.filterLanguage')}</div>
          <div className="email-filter-pills">
            {allLanguages.map(l => {
              const isInvalid = invalidLanguages.includes(l);
              return (
                <button
                  key={l}
                  className={`email-filter-pill ${selectedLanguage === l ? 'active' : ''} ${isInvalid ? 'disabled' : ''}`}
                  onClick={() => !isInvalid && setSelectedLanguage(l)}
                  disabled={isInvalid}
                >
                  {l}
                </button>
              );
            })}
          </div>
          {invalidLanguages.length > 0 && selectedMarket && (
            <div className="email-filter-invalid-hint">
              ⚠ {invalidLanguages.join(', ')} — {t('emailBuilder.notAvailableFor')} {selectedMarket}
            </div>
          )}
        </div>
        {/* Tier */}
        {allTiers.length > 0 && (
          <div className="email-filter-section">
            <div className="email-filter-label">{t('emailBuilder.filterTier')}</div>
            <div className="email-filter-pills">
              {allTiers.map(tier => {
                const isInvalid = invalidTiers.includes(tier);
                return (
                  <button
                    key={tier}
                    className={`email-filter-pill ${selectedTier === tier ? 'active' : ''} ${isInvalid ? 'disabled' : ''}`}
                    onClick={() => !isInvalid && setSelectedTier(tier)}
                    disabled={isInvalid}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>
            {invalidTiers.length > 0 && (
              <div className="email-filter-invalid-hint">
                ⚠ {invalidTiers.join(', ')} — {t('emailBuilder.notAvailableFor')} {[selectedMarket, selectedLanguage].filter(Boolean).join('·')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de resultado */}
      {currentEmail && (
        <div className="email-result-bar">
          <span>
            {[selectedMarket, selectedLanguage, selectedTier].filter(Boolean).join(' · ')} —{' '}
            {t('emailBuilder.versionLabel')} <strong>v{currentEmail.version}</strong>
          </span>
          <div className="version-nav">
            <button
              onClick={() => setVersionIndex(i => Math.min(i + 1, matchingVersions.length - 1))}
              disabled={versionIndex >= matchingVersions.length - 1}
            >‹ anterior</button>
            <button
              onClick={() => setVersionIndex(i => Math.max(i - 1, 0))}
              disabled={versionIndex === 0}
            >siguiente ›</button>
          </div>
        </div>
      )}

      {/* Preview + metadata */}
      {currentEmail ? (
        <div className="email-version-content">
          <div className="email-version-preview-panel">
            <div className="email-preview-toolbar">
              <span className="email-preview-tab active">{t('emailBuilder.tabPreview')}</span>
            </div>
            <div className="email-preview-body">
              <div className="email-preview-iframe-wrapper desktop">
                <iframe
                  sandbox="allow-same-origin"
                  srcDoc={currentEmail.html_content}
                  title={`Email v${currentEmail.version}`}
                  className="email-preview-iframe"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </div>
          </div>
          <div className="email-version-meta-panel">
            <div className="email-meta-row">
              <span className="email-meta-label">{t('emailBuilder.versionLabel')}</span>
              <span className="email-meta-value">v{currentEmail.version}</span>
            </div>
            <div className="email-meta-row">
              <span className="email-meta-label">Estado</span>
              <span className={`email-status-badge ${currentEmail.status}`}>
                ● {t(`emailBuilder.status${currentEmail.status.charAt(0).toUpperCase() + currentEmail.status.slice(1)}`) || currentEmail.status}
              </span>
            </div>
            <div className="email-meta-row">
              <span className="email-meta-label">Creado</span>
              <span className="email-meta-value" style={{ fontSize: '0.75rem' }}>
                {new Date(currentEmail.created_at).toLocaleString()}
              </span>
            </div>
            <div className="email-meta-row">
              <span className="email-meta-label">Por</span>
              <span className="email-meta-value" style={{ fontSize: '0.75rem' }}>
                {currentEmail.generated_by || 'HTML Agent'}
              </span>
            </div>
            <div className="email-meta-row">
              <span className="email-meta-label">Variantes</span>
              <span className="email-meta-value" style={{ fontSize: '0.75rem' }}>
                {matchingVersions.length} versión{matchingVersions.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button className="html-dev-action-btn primary" style={{ width: '100%' }} onClick={handleExport}>
                <Download size={12} style={{ marginRight: 4 }} />
                {t('emailBuilder.exportHtml')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">No hay versiones para esta combinación</div>
      )}
    </div>
  );
}
