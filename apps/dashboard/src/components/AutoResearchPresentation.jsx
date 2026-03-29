import { useLanguage } from '../i18n/LanguageContext.jsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Brain, Repeat, Target, BarChart3, BookOpen, ChevronRight } from 'lucide-react';

const OUTCOME_DATA = [
    { month: 'M1', without: 24.5, with: 24.5 },
    { month: 'M2', without: 24.3, with: 25.1 },
    { month: 'M3', without: 24.6, with: 26.4 },
    { month: 'M4', without: 24.4, with: 27.8 },
    { month: 'M5', without: 24.7, with: 29.5 },
    { month: 'M6', without: 24.5, with: 30.9 },
    { month: 'M7', without: 24.3, with: 32.1 },
    { month: 'M8', without: 24.6, with: 33.4 },
    { month: 'M9', without: 24.4, with: 34.2 },
    { month: 'M10', without: 24.5, with: 35.1 },
    { month: 'M11', without: 24.7, with: 35.8 },
    { month: 'M12', without: 24.5, with: 36.5 },
];

const USE_CASE_ICONS = ['✉️', '📝', '🕐', '🎯'];

export default function AutoResearchPresentation() {
    const { t } = useLanguage();

    return (
        <div className="ar-presentation animate-fade-in">
            {/* A) Hero */}
            <div className="card ar-hero">
                <div className="ar-hero-title">{t('autoExperiment.heroTitle')}</div>
                <div className="ar-hero-subtitle">{t('autoExperiment.heroSubtitle')}</div>
                <div className="ar-hero-credit">{t('autoExperiment.heroCredit')}</div>
            </div>

            {/* B) What is AutoExperiment */}
            <div className="ar-section">
                <div className="ar-section-title">
                    <Brain size={18} />
                    {t('autoExperiment.whatTitle')}
                </div>
                <div className="ar-two-col">
                    <div className="ar-bullets">
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} className="ar-bullet">
                                <div className="ar-bullet-icon">{n}</div>
                                <span>{t(`autoExperiment.whatBullet${n}`)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="ar-quote-card">
                        <div className="ar-quote-text">{t('autoExperiment.whatQuote')}</div>
                        <div className="ar-quote-author">{t('autoExperiment.whatQuoteAuthor')}</div>
                    </div>
                </div>
            </div>

            {/* C) The Loop */}
            <div className="ar-section">
                <div className="ar-section-title">
                    <Repeat size={18} />
                    {t('autoExperiment.loopTitle')}
                </div>
                <div className="card" style={{ padding: 24 }}>
                    <div className="ar-loop-flow">
                        {[1, 2, 3, 4, 5].map((n, i) => (
                            <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                                <div className="ar-loop-step">
                                    <div className="ar-loop-number">{n}</div>
                                    <div className="ar-loop-step-title">{t(`autoExperiment.loopStep${n}Title`)}</div>
                                    <div className="ar-loop-step-desc">{t(`autoExperiment.loopStep${n}Desc`)}</div>
                                </div>
                                {i < 4 && (
                                    <div className="ar-loop-arrow">
                                        <ChevronRight size={20} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="ar-loop-return">
                        {t('autoExperiment.loopContinuous')}
                    </div>
                </div>
            </div>

            {/* D) Use Cases */}
            <div className="ar-section">
                <div className="ar-section-title">
                    <Target size={18} />
                    {t('autoExperiment.useCasesTitle')}
                </div>
                <div className="ar-usecase-grid">
                    {[1, 2, 3, 4].map((n, i) => (
                        <div key={n} className="ar-usecase-card">
                            <div className="ar-usecase-icon">{USE_CASE_ICONS[i]}</div>
                            <div className="ar-usecase-title">{t(`autoExperiment.useCase${n}Title`)}</div>
                            <div className="ar-usecase-desc">{t(`autoExperiment.useCase${n}Desc`)}</div>
                            <span className="ar-usecase-target">{t(`autoExperiment.useCase${n}Target`)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* E) Expected Outcomes */}
            <div className="ar-section">
                <div className="ar-section-title">
                    <BarChart3 size={18} />
                    {t('autoExperiment.outcomesTitle')}
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={OUTCOME_DATA}>
                            <defs>
                                <linearGradient id="ar-gradient-with" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} domain={[20, 40]} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: '0.8rem' }}
                                labelStyle={{ color: 'var(--text-muted)' }}
                                formatter={(value, name) => [`${value.toFixed(1)}%`, name === 'with' ? t('autoExperiment.outcomesWith') : t('autoExperiment.outcomesWithout')]}
                            />
                            <Area
                                type="monotone"
                                dataKey="without"
                                stroke="var(--text-muted)"
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                                fill="none"
                                name="without"
                            />
                            <Area
                                type="monotone"
                                dataKey="with"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#ar-gradient-with)"
                                name="with"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, fontSize: '0.75rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <span style={{ width: 20, height: 2, background: 'var(--text-muted)', display: 'inline-block', borderTop: '1px dashed var(--text-muted)' }} />
                            {t('autoExperiment.outcomesWithout')}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                            <span style={{ width: 20, height: 2, background: '#10b981', display: 'inline-block' }} />
                            {t('autoExperiment.outcomesWith')}
                        </span>
                    </div>
                </div>
                <div className="ar-outcome-stats">
                    {[1, 2, 3].map(n => (
                        <div key={n} className="ar-stat-card">
                            <div className="ar-stat-value">{t(`autoExperiment.outcomeStat${n}`)}</div>
                            <div className="ar-stat-label">{t(`autoExperiment.outcomeStat${n}Label`)}</div>
                        </div>
                    ))}
                </div>
                <div className="ar-outcomes-note">{t('autoExperiment.outcomesNote')}</div>
            </div>

            {/* F) Knowledge Loop */}
            <div className="ar-section">
                <div className="ar-section-title">
                    <BookOpen size={18} />
                    {t('autoExperiment.knowledgeTitle')}
                </div>
                <div className="ar-knowledge-desc">{t('autoExperiment.knowledgeDesc')}</div>
                <div className="ar-knowledge-milestones">
                    {[
                        { n: 10, key: 'knowledge10' },
                        { n: 50, key: 'knowledge50' },
                        { n: 100, key: 'knowledge100' },
                    ].map(({ n, key }) => (
                        <div key={n} className="ar-knowledge-milestone">
                            <div className="ar-knowledge-milestone-icon">{n}</div>
                            <span>{t(`autoExperiment.${key}`)}</span>
                        </div>
                    ))}
                </div>
                <div className="ar-knowledge-samples">
                    {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className="ar-knowledge-sample">
                            {t(`autoExperiment.knowledgeSample${n}`)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
