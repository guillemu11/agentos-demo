import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Loader, Mail, Send } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEFAULT_MARKETS = ['UAE', 'UK', 'DE', 'FR', 'KSA', 'IN', 'AU'];
const DEFAULT_LANGUAGES = ['en', 'ar', 'de', 'fr'];
const DEFAULT_TIERS = ['Blue', 'Silver', 'Gold', 'Platinum'];

export default function EmailProposalGenerator({ campaignId, onGenerated }) {
    const { t } = useLanguage();
    const [markets, setMarkets] = useState(['UAE']);
    const [languages, setLanguages] = useState(['en']);
    const [tiers, setTiers] = useState([null]); // null = all tiers
    const [instructions, setInstructions] = useState('');
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState({ variant: '', percent: 0 });

    const toggleItem = (arr, setArr, item) => {
        setArr(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const variantCount = markets.length * languages.length * (tiers.includes(null) ? 1 : tiers.length);

    async function handleGenerate() {
        if (markets.length === 0 || languages.length === 0) return;
        setGenerating(true);
        setProgress({ variant: '', percent: 0 });

        try {
            const res = await fetch(`${API_URL}/campaigns/${campaignId}/emails/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    markets,
                    languages,
                    tiers: tiers.includes(null) ? [null] : tiers,
                    instructions: instructions.trim() || undefined,
                }),
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.phase === 'generating') {
                            setProgress({ variant: parsed.variant, percent: parsed.progress });
                        } else if (parsed.phase === 'complete') {
                            onGenerated?.(parsed.proposals);
                        }
                    } catch { /* ignore */ }
                }
            }
        } catch (err) {
            console.error('Generation error:', err);
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div className="email-generator">
            {/* Markets */}
            <div className="email-gen-section">
                <label className="email-gen-label">{t('emails.markets')}</label>
                <div className="email-gen-chips">
                    {DEFAULT_MARKETS.map(m => (
                        <button
                            key={m}
                            className={`email-gen-chip ${markets.includes(m) ? 'active' : ''}`}
                            onClick={() => toggleItem(markets, setMarkets, m)}
                            disabled={generating}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Languages */}
            <div className="email-gen-section">
                <label className="email-gen-label">{t('emails.languages')}</label>
                <div className="email-gen-chips">
                    {DEFAULT_LANGUAGES.map(l => (
                        <button
                            key={l}
                            className={`email-gen-chip ${languages.includes(l) ? 'active' : ''}`}
                            onClick={() => toggleItem(languages, setLanguages, l)}
                            disabled={generating}
                        >
                            {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tiers */}
            <div className="email-gen-section">
                <label className="email-gen-label">{t('emails.tiers')}</label>
                <div className="email-gen-chips">
                    <button
                        className={`email-gen-chip ${tiers.includes(null) ? 'active' : ''}`}
                        onClick={() => setTiers([null])}
                        disabled={generating}
                    >
                        {t('emails.allTiers')}
                    </button>
                    {DEFAULT_TIERS.map(tier => (
                        <button
                            key={tier}
                            className={`email-gen-chip ${tiers.includes(tier) ? 'active' : ''}`}
                            onClick={() => {
                                const without = tiers.filter(t => t !== null);
                                if (without.includes(tier)) {
                                    const next = without.filter(t => t !== tier);
                                    setTiers(next.length === 0 ? [null] : next);
                                } else {
                                    setTiers([...without, tier]);
                                }
                            }}
                            disabled={generating}
                        >
                            {tier}
                        </button>
                    ))}
                </div>
            </div>

            {/* Instructions */}
            <div className="email-gen-section">
                <label className="email-gen-label">{t('emails.instructions')}</label>
                <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder={t('emails.instructionsPlaceholder')}
                    rows={2}
                    disabled={generating}
                    style={{ width: '100%', resize: 'vertical' }}
                />
            </div>

            {/* Generate button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button className="kb-action-btn" onClick={handleGenerate} disabled={generating || markets.length === 0 || languages.length === 0}>
                    {generating ? <Loader size={14} className="spin" /> : <Send size={14} />}
                    {generating ? t('emails.generating') : t('emails.generate')}
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {variantCount} {t('emails.variants')}
                </span>
            </div>

            {/* Progress */}
            {generating && (
                <div className="email-gen-progress">
                    <div className="email-gen-progress-bar" style={{ width: `${progress.percent}%` }} />
                    <span className="email-gen-progress-label">{progress.variant}</span>
                </div>
            )}
        </div>
    );
}
