import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Search, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Reusable semantic search component for the knowledge base.
 * Embeddable in any page or chat panel.
 *
 * @param {{ namespace?: string, onSelect?: (result) => void, placeholder?: string }} props
 */
export default function KnowledgeSearch({ namespace, onSelect, placeholder }) {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef(null);
    const containerRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const search = useCallback(async (q) => {
        if (!q.trim() || q.length < 3) { setResults([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/knowledge/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ query: q, namespace: namespace || undefined, topK: 5 }),
            });
            if (res.ok) {
                const data = await res.json();
                setResults(data.results);
                setOpen(data.results.length > 0);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [namespace]);

    function handleChange(e) {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(val), 300);
    }

    function handleSelect(result) {
        setOpen(false);
        if (onSelect) onSelect(result);
    }

    return (
        <div className="kb-search-container" ref={containerRef}>
            <div className="kb-search-input-wrap">
                {loading ? <Loader size={14} className="spin" /> : <Search size={14} />}
                <input
                    value={query}
                    onChange={handleChange}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder={placeholder || t('knowledge.searchPlaceholder')}
                    className="kb-search-input"
                />
            </div>
            {open && results.length > 0 && (
                <div className="kb-search-dropdown">
                    {results.map((r, i) => (
                        <div key={i} className="kb-search-item" onClick={() => handleSelect(r)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.documentTitle}</span>
                                <span className="kb-score-badge">{(r.score * 100).toFixed(0)}%</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {r.content?.slice(0, 150)}{r.content?.length > 150 ? '...' : ''}
                            </p>
                            {r.metadata?.namespace && (
                                <span className="kb-namespace-tag" style={{ marginTop: 4 }}>{r.metadata.namespace}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
