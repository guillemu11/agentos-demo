import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CHART_DATA } from '../data/autoResearchData.js';

export default function ResearchChart() {
  const { t } = useLanguage();

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const color = payload.promoted ? '#25d366' : '#f87171';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="none" />;
  };

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
        {t('researchLab.metricImprovement')} — Miles Expiry
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('researchLab.chartSub')}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={CHART_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="researchGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#25d366" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="run"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}
            formatter={(v) => [`${v}%`, 'Response Rate']}
            labelFormatter={(l) => `Run ${l}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#25d366"
            strokeWidth={2}
            fill="url(#researchGradient)"
            dot={<CustomDot />}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[
          { color: '#25d366', label: 'Challenger promoted' },
          { color: '#f87171', label: 'Baseline kept' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
