import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import TimeToFirstTouch from './components/TimeToFirstTouch.jsx';
import LifecycleHeatmap from './components/LifecycleHeatmap.jsx';
import SubNav from './components/SubNav.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Comparative() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    async function load() {
        const r = await fetch(`${API}/competitor-intel/investigations/${id}/comparative`);
        setData(await r.json());
    }
    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [id]);

    if (!data) return <div className="ci-loading">Loading…</div>;

    return (
        <div className="ci-page ci-fade-in">
            <SubNav />
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">
                        <Link to={`/app/competitor-intel/${id}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}>
                            ← Overview
                        </Link>
                        &nbsp;·&nbsp; Comparative
                    </p>
                    <h1>Lifecycle comparison</h1>
                </div>
                <div className="ci-header-meta">
                    {data.ttft.length} brands &nbsp;·&nbsp; {data.stages.length} lifecycle stages
                </div>
            </header>

            <section className="ci-compare-section">
                <h2 className="ci-compare-title">Time to first useful email</h2>
                <p className="ci-compare-lead">
                    From newsletter signup to first non-transactional email. Lower is better.
                </p>
                <TimeToFirstTouch rows={data.ttft} />
            </section>

            <section className="ci-compare-section">
                <h2 className="ci-compare-title">Lifecycle depth</h2>
                <p className="ci-compare-lead">
                    Emails ingested per lifecycle stage. Darker cells mean no coverage; denser fill means richer programme.
                </p>
                <LifecycleHeatmap rows={data.heatmap} stages={data.stages} />
            </section>
        </div>
    );
}
