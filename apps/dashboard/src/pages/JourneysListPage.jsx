import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Workflow,
  Clock,
  Rocket,
  Archive,
  Sparkles,
  ArrowUpRight,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import CreateJourneyModal from '../components/journey/CreateJourneyModal.jsx';
import SuggestedJourneys from '../components/journey/SuggestedJourneys.jsx';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import HubSearch from '../components/ui/HubSearch.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneysListPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    fetch(`${API}/journeys`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (journey, seed) => {
    const url = seed
      ? `/app/journeys/${journey.id}?seed=${encodeURIComponent(seed)}`
      : `/app/journeys/${journey.id}`;
    nav(url);
  };

  const stats = useMemo(() => {
    const base = { total: items.length, drafting: 0, deployed_draft: 0, archived: 0 };
    for (const j of items) base[j.status] = (base[j.status] || 0) + 1;
    return base;
  }, [items]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((j) => j.name.toLowerCase().includes(q));
  }, [items, query]);

  const handleDelete = async (journey) => {
    if (!window.confirm(t('journeys.deleteConfirm').replace('{name}', journey.name))) return;
    const r = await fetch(`${API}/journeys/${journey.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (r.ok) setItems((prev) => prev.filter((x) => x.id !== journey.id));
  };

  return (
    <div className="jl">
      <HubHero
        eyebrow={<>
          <Sparkles size={14} strokeWidth={2.5} />
          <span>{t('journeys.hero.eyebrow')}</span>
        </>}
        title={t('journeys.title')}
        subtitle={t('journeys.hero.subtitle')}
        actions={
          <button className="jl__cta" onClick={() => setModalOpen(true)}>
            <Plus size={16} strokeWidth={2.5} />
            <span>{t('journeys.newJourney')}</span>
            <span className="jl__cta-shine" aria-hidden="true" />
          </button>
        }
        hint={<><kbd>↳</kbd> {t('journeys.hero.hint')}</>}
      />

      <HubStats>
        <HubStatCard icon={<Workflow size={16} strokeWidth={2} />} label={t('journeys.stats.total')} value={stats.total} tone="neutral" />
        <HubStatCard icon={<Clock size={16} strokeWidth={2} />} label={t('journeys.statusDrafting')} value={stats.drafting || 0} tone="amber" />
        <HubStatCard icon={<Rocket size={16} strokeWidth={2} />} label={t('journeys.statusDeployedDraft')} value={stats.deployed_draft || 0} tone="emerald" />
        <HubStatCard icon={<Archive size={16} strokeWidth={2} />} label={t('journeys.statusArchived')} value={stats.archived || 0} tone="muted" />
      </HubStats>

      {!loading && <SuggestedJourneys onCreated={handleCreated} />}

      {!loading && items.length > 0 && (
        <HubSearch
          value={query}
          onChange={setQuery}
          placeholder={t('journeys.searchPlaceholder')}
          count={filtered.length}
          total={items.length}
        />
      )}

      {loading ? (
        <div className="jl__grid">
          {[0, 1, 2].map((i) => (<div key={i} className="jl__card jl__card--skeleton" />))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="jl__no-results">
          <p>{t('journeys.noResults').replace('{query}', query)}</p>
          <button className="jl__btn-text" onClick={() => setQuery('')}>{t('journeys.clearSearch')}</button>
        </div>
      ) : (
        <div className="jl__grid">
          {filtered.map((j) => (
            <JourneyCard
              key={j.id}
              journey={j}
              onClick={() => nav(`/app/journeys/${j.id}`)}
              onDelete={() => handleDelete(j)}
            />
          ))}
        </div>
      )}

      <CreateJourneyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function JourneyCard({ journey, onClick, onDelete }) {
  const { t } = useLanguage();
  const statusMeta = STATUS_META[journey.status] || STATUS_META.drafting;
  return (
    <div className="jl__card-wrap">
      <button className="jl__card" onClick={onClick} type="button">
        <div className="jl__card-top">
          <div className={`jl__badge jl__badge--${journey.status}`}>
            <span className="jl__badge-dot" />
            {t(`journeys.status${pascal(journey.status)}`)}
          </div>
          <ArrowUpRight size={16} strokeWidth={2} className="jl__card-arrow" />
        </div>
        <h3 className="jl__card-title">{journey.name}</h3>
        <div className="jl__card-meta">
          <span className="jl__card-meta-item">
            <Clock size={12} strokeWidth={2} />
            {formatRelative(journey.updated_at, t)}
          </span>
          {journey.mc_interaction_id && (
            <span className="jl__card-meta-item jl__card-meta-item--mc">
              MC · {journey.mc_interaction_id.slice(0, 8)}
            </span>
          )}
        </div>
        {(() => {
          const count = AI_PROPOSALS.journeys.default.filter(p => p.priority === 'urgent' || p.priority === 'high').length;
          return count > 0 ? (
            <div className="jl__card-proposal-badge">
              <Sparkles size={12} strokeWidth={2} />
              {t('journeys.aiSuggestionsCount').replace('{n}', count)}
            </div>
          ) : null;
        })()}
        <div className="jl__card-footer">
          <div className={`jl__card-rail jl__card-rail--${statusMeta.rail}`} />
        </div>
      </button>
      <button
        className="jl__card-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        type="button"
        aria-label={t('journeys.delete')}
        title={t('journeys.delete')}
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }) {
  const { t } = useLanguage();
  return (
    <div className="jl__empty">
      <div className="jl__empty-art" aria-hidden="true">
        <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="jl-empty-g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D71921" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="jl-empty-g2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="20" y="30" width="60" height="38" rx="10" fill="url(#jl-empty-g1)" stroke="rgba(26,26,46,0.15)" />
          <rect x="95" y="18" width="55" height="32" rx="9" fill="rgba(30,58,138,0.35)" stroke="rgba(26,26,46,0.18)" />
          <rect x="95" y="62" width="55" height="32" rx="9" fill="rgba(12,74,110,0.4)" stroke="rgba(26,26,46,0.18)" />
          <rect x="165" y="40" width="55" height="38" rx="10" fill="url(#jl-empty-g1)" stroke="rgba(26,26,46,0.15)" />
          <path d="M80 49 L95 34" stroke="url(#jl-empty-g2)" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M80 49 L95 78" stroke="url(#jl-empty-g2)" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M150 34 L165 59" stroke="url(#jl-empty-g2)" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M150 78 L165 59" stroke="url(#jl-empty-g2)" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="50" cy="49" r="3" fill="#D71921" />
          <circle cx="192" cy="59" r="3" fill="#D4AF37" />
        </svg>
      </div>
      <h2 className="jl__empty-title">{t('journeys.empty.title')}</h2>
      <p className="jl__empty-subtitle">{t('journeys.empty.subtitle')}</p>
      <button className="jl__cta" onClick={onCreate}>
        <Plus size={16} strokeWidth={2.5} />
        <span>{t('journeys.empty.cta')}</span>
        <span className="jl__cta-shine" aria-hidden="true" />
      </button>
    </div>
  );
}

const STATUS_META = {
  drafting: { rail: 'amber' },
  deployed_draft: { rail: 'emerald' },
  archived: { rail: 'muted' },
};

function pascal(s) {
  return s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

function formatRelative(ts, t) {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('journeys.time.justNow');
  if (min < 60) return t('journeys.time.minutesAgo').replace('{n}', min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('journeys.time.hoursAgo').replace('{n}', hr);
  const d = Math.floor(hr / 24);
  if (d < 7) return t('journeys.time.daysAgo').replace('{n}', d);
  return new Date(ts).toLocaleDateString();
}
