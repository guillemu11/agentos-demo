import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
    Brain,
    Database,
    FileText,
    Upload,
    Trash2,
    RefreshCw,
    Loader,
    Image,
    File,
    MessageSquare,
    FolderOpen,
    Layers,
    Activity,
    Megaphone,
    Mail,
    ImageIcon,
    TrendingUp,
    Search as SearchIcon,
    Palette,
} from 'lucide-react';
import KBChat from '../components/KBChat.jsx';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import HubSearch from '../components/ui/HubSearch.jsx';
import Button from '../components/ui/Button.jsx';
import FormField from '../components/ui/FormField.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import TabStrip from '../components/ui/TabStrip.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const NAMESPACES = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];

const NAMESPACE_META = {
    campaigns: { Icon: Megaphone, tone: 'emerald' },
    emails:    { Icon: Mail,      tone: 'info'    },
    images:    { Icon: ImageIcon, tone: 'amber'   },
    kpis:      { Icon: TrendingUp,tone: 'neutral' },
    research:  { Icon: SearchIcon,tone: 'info'    },
    brand:     { Icon: Palette,   tone: 'warning' },
};

export default function KnowledgeBase() {
    const { t } = useLanguage();
    const toast = useToast();
    const [tab, setTab] = useState('overview');
    const [status, setStatus] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [docTotal, setDocTotal] = useState(0);
    const [docsLoading, setDocsLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [docFilter, setDocFilter] = useState({ namespace: '', status: '' });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadNamespace, setUploadNamespace] = useState('research');
    const [uploading, setUploading] = useState(false);
    const [heroQuery, setHeroQuery] = useState('');

    useEffect(() => { loadStatus(); }, []);
    useEffect(() => { if (tab === 'documents') loadDocuments(); }, [tab, docFilter]);

    async function loadStatus() {
        try {
            const res = await fetch(`${API_URL}/knowledge/status`, { credentials: 'include' });
            if (res.ok) setStatus(await res.json());
        } catch { /* ignore */ }
    }

    async function loadDocuments() {
        setDocsLoading(true);
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
        } catch { /* ignore */ } finally {
            setDocsLoading(false);
        }
    }

    async function handleIngestCampaigns() {
        setIngesting(true);
        try {
            const res = await fetch(`${API_URL}/knowledge/ingest-campaigns`, { method: 'POST', credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                toast.success(`${t('knowledge.ingested')}: ${data.documentsCreated} docs, ${data.chunksCreated} chunks`);
                loadStatus();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Error');
            }
        } catch (err) {
            toast.error(err.message);
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
                toast.success(`${t('knowledge.uploaded')}: ${data.contentType} - ${data.chunksCreated} chunks`);
                setUploadFile(null);
                setUploadTitle('');
                loadStatus();
            } else {
                const err = await res.json();
                toast.error(err.error || t('knowledge.uploadError'));
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setUploading(false);
        }
    }

    function triggerUploadFlow() {
        setTab('overview');
        // Focus the hidden file input so the native picker opens.
        requestAnimationFrame(() => {
            document.getElementById('kb-file-input')?.click();
        });
    }

    function handleHeroSearchChange(val) {
        setHeroQuery(val);
        if (val && tab !== 'search') setTab('search');
    }

    const nsData = status?.namespaces
        ? Object.entries(status.namespaces).map(([name, data]) => ({ name, docs: data.indexed, chunks: data.chunks }))
        : [];

    const ready = status?.ready;

    const tabs = [
        { id: 'overview', label: t('knowledge.overview'), icon: <Database size={14} /> },
        { id: 'documents', label: t('knowledge.documents'), icon: <FileText size={14} /> },
        { id: 'search', label: t('knowledge.chat.title'), icon: <MessageSquare size={14} /> },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <HubHero
                eyebrow={<>
                    <Brain size={14} strokeWidth={2.5} />
                    <span>{t('knowledge.hero.eyebrow')}</span>
                </>}
                title={t('knowledge.hero.title')}
                subtitle={t('knowledge.hero.subtitle')}
                actions={
                    <Button variant="primary" onClick={triggerUploadFlow}>
                        <Upload size={14} strokeWidth={2.5} />
                        {t('knowledge.uploadCta')}
                    </Button>
                }
            />

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <HubSearch
                    value={heroQuery}
                    onChange={handleHeroSearchChange}
                    placeholder={t('knowledge.heroSearchPlaceholder')}
                    ariaLabel={t('knowledge.heroSearchPlaceholder')}
                />
            </div>

            <HubStats>
                <HubStatCard
                    icon={<FileText size={16} strokeWidth={2} />}
                    label={t('knowledge.stats.documents')}
                    value={status?.totalDocuments ?? '-'}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<Layers size={16} strokeWidth={2} />}
                    label={t('knowledge.stats.chunks')}
                    value={status?.totalChunks ?? '-'}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<Database size={16} strokeWidth={2} />}
                    label={t('knowledge.stats.namespaces')}
                    value={nsData.length}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<Activity size={16} strokeWidth={2} />}
                    label={t('knowledge.stats.status')}
                    value={
                        <span className={ready ? 'kb-status--online' : 'kb-status--offline'}>
                            {ready ? t('knowledge.stats.online') : t('knowledge.stats.offline')}
                        </span>
                    }
                    tone={ready ? 'emerald' : 'amber'}
                />
            </HubStats>

            <div style={{ margin: 'var(--space-4) 0 var(--space-3)' }}>
                <TabStrip
                    tabs={tabs}
                    active={tab}
                    onChange={setTab}
                    ariaLabel={t('knowledge.title')}
                />
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
                <div>
                    {/* Namespace tiles — "teach your agents" */}
                    <div className="kb-ns-section">
                        <div className="kb-ns-section-head">
                            <h3 className="kb-section-title">{t('knowledge.byNamespace')}</h3>
                            <p className="kb-ns-section-sub">{t('knowledge.nsTilesHint')}</p>
                        </div>
                        <div className="kb-ns-grid">
                            {NAMESPACES.map(ns => {
                                const meta = NAMESPACE_META[ns] || { Icon: FolderOpen, tone: 'neutral' };
                                const Icon = meta.Icon;
                                const data = status?.namespaces?.[ns];
                                const docs = data?.indexed || 0;
                                const chunks = data?.chunks || 0;
                                return (
                                    <button
                                        key={ns}
                                        type="button"
                                        className={`kb-ns-tile kb-ns-tile--${meta.tone}`}
                                        onClick={() => {
                                            setUploadNamespace(ns);
                                            document.getElementById('kb-file-input')?.click();
                                        }}
                                        title={t('knowledge.nsTeach').replace('{ns}', ns)}
                                    >
                                        <div className="kb-ns-tile-icon"><Icon size={20} strokeWidth={2} /></div>
                                        <div className="kb-ns-tile-body">
                                            <div className="kb-ns-tile-name">{ns}</div>
                                            <div className="kb-ns-tile-meta">
                                                <span>{docs} {t('knowledge.documents').toLowerCase()}</span>
                                                <span className="kb-ns-tile-sep">·</span>
                                                <span>{chunks} chunks</span>
                                            </div>
                                        </div>
                                        <div className="kb-ns-tile-cta">
                                            <Upload size={14} strokeWidth={2} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Upload */}
                    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
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
                                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'end' }}>
                                    <FormField label={t('knowledge.docTitle')} className="kb-upload-field">
                                        <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={t('knowledge.docTitle')} />
                                    </FormField>
                                    <FormField label={t('knowledge.namespaceLabel')}>
                                        <select value={uploadNamespace} onChange={e => setUploadNamespace(e.target.value)} className="kb-filter-select">
                                            {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                                        </select>
                                    </FormField>
                                    <Button variant="primary" onClick={handleUpload} disabled={uploading || !uploadTitle.trim()}>
                                        {uploading ? <Loader size={14} className="spin" /> : <Upload size={14} />}
                                        {uploading ? t('knowledge.uploading') : t('knowledge.uploadFile')}
                                    </Button>
                                </div>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--space-2)' }}>
                                {t('knowledge.maxFileSize')} - PDF, PNG, JPG, WebP, GIF
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <h3 className="kb-section-title">{t('knowledge.actions')}</h3>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <Button variant="secondary" onClick={handleIngestCampaigns} disabled={ingesting}>
                                {ingesting ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
                                {ingesting ? t('knowledge.ingesting') : t('knowledge.ingestAll')}
                            </Button>
                            <Button variant="secondary" onClick={loadStatus}>
                                <RefreshCw size={14} /> {t('knowledge.refresh')}
                            </Button>
                        </div>
                        {status?.lastIngestion && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 'var(--space-3)' }}>
                                {t('knowledge.lastIngestion')}: {new Date(status.lastIngestion).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Documents Tab */}
            {tab === 'documents' && (
                <div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <FormField label={t('knowledge.namespaceLabel')}>
                            <select
                                value={docFilter.namespace}
                                onChange={e => setDocFilter(p => ({ ...p, namespace: e.target.value }))}
                                className="kb-filter-select"
                            >
                                <option value="">{t('knowledge.allNamespaces')}</option>
                                {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                            </select>
                        </FormField>
                        <FormField label={t('knowledge.sourceType')}>
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
                        </FormField>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
                            {docTotal} {t('knowledge.documents').toLowerCase()}
                        </span>
                    </div>

                    {docsLoading && documents.length === 0 ? (
                        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <Skeleton height={20} />
                            <Skeleton height={20} width="80%" />
                            <Skeleton height={20} width="60%" />
                            <Skeleton height={20} width="90%" />
                        </div>
                    ) : documents.length === 0 ? (
                        <EmptyState
                            icon={<FolderOpen size={28} />}
                            title={t('knowledge.empty.title')}
                            description={t('knowledge.empty.description')}
                            action={
                                <Button variant="primary" onClick={triggerUploadFlow}>
                                    <Upload size={14} strokeWidth={2.5} />
                                    {t('knowledge.uploadCta')}
                                </Button>
                            }
                        />
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                            <table className="kb-docs-table">
                                <thead>
                                    <tr>
                                        <th>{t('knowledge.docTitle')}</th>
                                        <th>{t('knowledge.fileType')}</th>
                                        <th>{t('knowledge.namespaceLabel')}</th>
                                        <th>{t('knowledge.sourceType')}</th>
                                        <th>Chunks</th>
                                        <th>{t('knowledge.stats.status')}</th>
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
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* KB Chat Tab — heroQuery navigates users here; TODO: pipe into KBChat as initialQuery */}
            {tab === 'search' && <KBChat />}
        </div>
    );
}
