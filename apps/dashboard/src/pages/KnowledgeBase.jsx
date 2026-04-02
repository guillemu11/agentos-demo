import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, FileText, Upload, Trash2, RefreshCw, Loader, Image, File, MessageSquare } from 'lucide-react';
import KBChat from '../components/KBChat.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function KnowledgeBase() {
    const { t } = useLanguage();
    const [tab, setTab] = useState('overview');
    const [status, setStatus] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [docTotal, setDocTotal] = useState(0);
    const [ingesting, setIngesting] = useState(false);
    const [docFilter, setDocFilter] = useState({ namespace: '', status: '' });
    const [toast, setToast] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadNamespace, setUploadNamespace] = useState('research');
    const [uploading, setUploading] = useState(false);

    useEffect(() => { loadStatus(); }, []);
    useEffect(() => { if (tab === 'documents') loadDocuments(); }, [tab, docFilter]);

    async function loadStatus() {
        try {
            const res = await fetch(`${API_URL}/knowledge/status`, { credentials: 'include' });
            if (res.ok) setStatus(await res.json());
        } catch { /* ignore */ }
    }

    async function loadDocuments() {
        try {
            const params = new URLSearchParams({ page: '1', limit: '50' });
            if (docFilter.namespace) params.set('namespace', docFilter.namespace);
            if (docFilter.status) params.set('status', docFilter.status);
            const res = await fetch(`${API_URL}/knowledge/documents?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDocuments(data.documents);
                setDocTotal(data.total);
            }
        } catch { /* ignore */ }
    }

    async function handleIngestCampaigns() {
        setIngesting(true);
        try {
            const res = await fetch(`${API_URL}/knowledge/ingest-campaigns`, { method: 'POST', credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setToast(`${t('knowledge.ingested')}: ${data.documentsCreated} docs, ${data.chunksCreated} chunks`);
                loadStatus();
            } else {
                const err = await res.json();
                setToast(err.error || 'Error');
            }
        } catch (err) {
            setToast(err.message);
        } finally {
            setIngesting(false);
        }
    }

    async function handleDeleteDoc(id) {
        try {
            await fetch(`${API_URL}/knowledge/documents/${id}`, { method: 'DELETE', credentials: 'include' });
            loadDocuments();
            loadStatus();
        } catch { /* ignore */ }
    }

    async function handleUpload() {
        if (!uploadFile || !uploadTitle.trim()) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('title', uploadTitle);
            formData.append('namespace', uploadNamespace);
            const res = await fetch(`${API_URL}/knowledge/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setToast(`${t('knowledge.uploaded')}: ${data.contentType} — ${data.chunksCreated} chunks`);
                setUploadFile(null);
                setUploadTitle('');
                loadStatus();
            } else {
                const err = await res.json();
                setToast(err.error || t('knowledge.uploadError'));
            }
        } catch (err) {
            setToast(err.message);
        } finally {
            setUploading(false);
        }
    }

    const nsData = status?.namespaces
        ? Object.entries(status.namespaces).map(([name, data]) => ({ name, docs: data.indexed, chunks: data.chunks }))
        : [];

    const NAMESPACES = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];
    const tabs = [
        { id: 'overview', label: t('knowledge.overview'), icon: <Database size={14} /> },
        { id: 'documents', label: t('knowledge.documents'), icon: <FileText size={14} /> },
        { id: 'search', label: t('knowledge.chat.title'), icon: <MessageSquare size={14} /> },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            {toast && <div className="settings-toast" onClick={() => setToast(null)}>{toast}</div>}

            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>{t('knowledge.title')}</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>{t('knowledge.subtitle')}</p>
            </div>

            {/* Tabs */}
            <div className="kb-tabs">
                {tabs.map(tb => (
                    <button
                        key={tb.id}
                        className={`kb-tab ${tab === tb.id ? 'active' : ''}`}
                        onClick={() => setTab(tb.id)}
                    >
                        {tb.icon} {tb.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
                <div>
                    {/* Status cards */}
                    <div className="kb-stats-grid">
                        <div className="kb-stat-card">
                            <span className="kb-stat-value">{status?.totalDocuments ?? '—'}</span>
                            <span className="kb-stat-label">{t('knowledge.totalDocs')}</span>
                        </div>
                        <div className="kb-stat-card">
                            <span className="kb-stat-value">{status?.totalChunks ?? '—'}</span>
                            <span className="kb-stat-label">{t('knowledge.totalChunks')}</span>
                        </div>
                        <div className="kb-stat-card">
                            <span className="kb-stat-value">{nsData.length}</span>
                            <span className="kb-stat-label">{t('knowledge.namespaces')}</span>
                        </div>
                        <div className="kb-stat-card">
                            <span className={`kb-stat-value ${status?.ready ? 'text-green' : 'text-red'}`}>
                                {status?.ready ? 'Online' : 'Offline'}
                            </span>
                            <span className="kb-stat-label">Status</span>
                        </div>
                    </div>

                    {/* Namespace chart */}
                    {nsData.length > 0 && (
                        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                            <h3 className="kb-section-title">{t('knowledge.byNamespace')}</h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={nsData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: '0.8rem' }} />
                                    <Bar dataKey="docs" fill="var(--primary)" radius={[4, 4, 0, 0]} name={t('knowledge.documents')} />
                                    <Bar dataKey="chunks" fill="var(--text-muted)" radius={[4, 4, 0, 0]} name="Chunks" opacity={0.4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Upload */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 className="kb-section-title">{t('knowledge.uploadFile')}</h3>
                        <div className="kb-upload-zone">
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.html,.htm,.doc,.docx,.eml"
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                        setUploadFile(f);
                                        if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
                                    }
                                }}
                                id="kb-file-input"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="kb-file-input" className="kb-upload-label">
                                <Upload size={20} />
                                {uploadFile ? uploadFile.name : t('knowledge.dragDrop')}
                            </label>
                            {uploadFile && (
                                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('knowledge.docTitle')}</label>
                                        <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={t('knowledge.docTitle')} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Namespace</label>
                                        <select value={uploadNamespace} onChange={e => setUploadNamespace(e.target.value)} className="kb-filter-select">
                                            {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                                        </select>
                                    </div>
                                    <button className="kb-action-btn" onClick={handleUpload} disabled={uploading || !uploadTitle.trim()}>
                                        {uploading ? <Loader size={14} className="spin" /> : <Upload size={14} />}
                                        {uploading ? t('knowledge.uploading') : t('knowledge.uploadFile')}
                                    </button>
                                </div>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 8 }}>
                                {t('knowledge.maxFileSize')} — PDF, PNG, JPG, WebP, GIF
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 className="kb-section-title">{t('knowledge.actions')}</h3>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button className="kb-action-btn" onClick={handleIngestCampaigns} disabled={ingesting}>
                                {ingesting ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
                                {ingesting ? t('knowledge.ingesting') : t('knowledge.ingestAll')}
                            </button>
                            <button className="kb-action-btn secondary" onClick={loadStatus}>
                                <RefreshCw size={14} /> {t('knowledge.refresh')}
                            </button>
                        </div>
                        {status?.lastIngestion && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 12 }}>
                                {t('knowledge.lastIngestion')}: {new Date(status.lastIngestion).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Documents Tab */}
            {tab === 'documents' && (
                <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        <select
                            value={docFilter.namespace}
                            onChange={e => setDocFilter(p => ({ ...p, namespace: e.target.value }))}
                            className="kb-filter-select"
                        >
                            <option value="">{t('knowledge.allNamespaces')}</option>
                            {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                        </select>
                        <select
                            value={docFilter.status}
                            onChange={e => setDocFilter(p => ({ ...p, status: e.target.value }))}
                            className="kb-filter-select"
                        >
                            <option value="">{t('knowledge.allStatuses')}</option>
                            <option value="indexed">Indexed</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="error">Error</option>
                        </select>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
                            {docTotal} {t('knowledge.documents').toLowerCase()}
                        </span>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                        <table className="kb-docs-table">
                            <thead>
                                <tr>
                                    <th>{t('knowledge.docTitle')}</th>
                                    <th>{t('knowledge.fileType')}</th>
                                    <th>Namespace</th>
                                    <th>{t('knowledge.sourceType')}</th>
                                    <th>Chunks</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map(doc => (
                                    <tr key={doc.id}>
                                        <td style={{ fontWeight: 600, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</td>
                                        <td>
                                            <span className="kb-media-badge" title={doc.content_type || 'text'}>
                                                {doc.content_type === 'image' ? <Image size={13} /> : doc.content_type === 'pdf' ? <File size={13} /> : <FileText size={13} />}
                                            </span>
                                        </td>
                                        <td><span className="kb-namespace-tag">{doc.namespace}</span></td>
                                        <td style={{ color: 'var(--text-muted)' }}>{doc.source_type}</td>
                                        <td>{doc.chunk_count}</td>
                                        <td><span className={`kb-status-badge ${doc.status}`}>{doc.status}</span></td>
                                        <td>
                                            <button className="kb-icon-btn" onClick={() => handleDeleteDoc(doc.id)} title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {documents.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>{t('knowledge.noDocs')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* KB Chat Tab */}
            {tab === 'search' && <KBChat />}
        </div>
    );
}
