import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Folder, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';
import Button from '../components/ui/Button.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import FormField from '../components/ui/FormField.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';
// Note: '#3b82f6' default below is required because <input type="color"> only accepts hex.

// ─── Workspace Tab ───────────────────────────────────────────────────────────

function WorkspaceTab({ t }) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/settings/workspace`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (data.workspace_name) setName(data.workspace_name);
                if (data.workspace_description) setDescription(data.workspace_description);
            })
            .catch(() => {});
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/settings/workspace`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ workspace_name: name, workspace_description: description }),
            });
            if (!res.ok) throw new Error('Failed to save');
            toast.success(t('settings.saved'));
        } catch {
            toast.error(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-section">
            <FormField label={t('settings.workspaceName')}>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('settings.workspaceNamePlaceholder')}
                />
            </FormField>
            <FormField label={t('settings.workspaceDescription')}>
                <textarea
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('settings.workspaceDescPlaceholder')}
                />
            </FormField>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? t('settings.saving') : t('settings.saveChanges')}
            </Button>
        </div>
    );
}

// ─── Departments Tab ─────────────────────────────────────────────────────────

function DepartmentsTab({ t }) {
    const toast = useToast();
    const [departments, setDepartments] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [confirmState, setConfirmState] = useState(null);
    const [newDept, setNewDept] = useState({ id: '', name: '', emoji: 'folder', color: '#3b82f6', description: '' });

    useEffect(() => {
        fetch(`${API_URL}/api/settings/departments`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => { setDepartments(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async (updated) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/settings/departments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updated),
            });
            if (!res.ok) throw new Error('Failed');
            setDepartments(updated);
            toast.success(t('settings.saved'));
        } catch {
            toast.error(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const performDelete = (deptId) => {
        const updated = { ...departments };
        delete updated[deptId];
        handleSave(updated);
    };

    const handleAdd = () => {
        if (!newDept.id || !newDept.name) return;
        const id = newDept.id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const updated = {
            ...departments,
            [id]: { name: newDept.name, emoji: newDept.emoji, color: newDept.color, description: newDept.description },
        };
        handleSave(updated);
        setNewDept({ id: '', name: '', emoji: 'folder', color: '#3b82f6', description: '' });
        setAdding(false);
    };

    const handleFieldChange = (deptId, field, value) => {
        setDepartments(prev => ({
            ...prev,
            [deptId]: { ...prev[deptId], [field]: value },
        }));
    };

    const handleBlurSave = () => {
        handleSave(departments);
    };

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="settings-section">
            <div className="dept-list">
                {Object.entries(departments).map(([id, dept]) => (
                    <div key={id} className="dept-card">
                        <div className="dept-card-header">
                            <span className="dept-color-swatch" style={{ backgroundColor: dept.color }} />
                            <span
                                className="dept-icon-slot"
                                title={t('settings.deptIcon')}
                                aria-label={t('settings.deptIcon')}
                            >
                                <Folder size={16} />
                            </span>
                            <input
                                className="dept-inline-input dept-name-input"
                                value={dept.name}
                                onChange={e => handleFieldChange(id, 'name', e.target.value)}
                                onBlur={handleBlurSave}
                            />
                            <span className="dept-id-badge">{id}</span>
                            <input
                                type="color"
                                className="dept-color-input"
                                value={dept.color}
                                onChange={e => handleFieldChange(id, 'color', e.target.value)}
                                onBlur={handleBlurSave}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmState({ id, name: dept.name })}
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                            >
                                <X size={16} />
                            </Button>
                        </div>
                        <input
                            className="dept-inline-input dept-desc-input"
                            value={dept.description}
                            onChange={e => handleFieldChange(id, 'description', e.target.value)}
                            onBlur={handleBlurSave}
                            placeholder={t('settings.deptDescription')}
                        />
                    </div>
                ))}
            </div>

            {adding ? (
                <div className="dept-add-form">
                    <div className="dept-add-row">
                        <FormField label={t('settings.deptId')} className="settings-form-grow">
                            <input
                                type="text"
                                value={newDept.id}
                                onChange={e => setNewDept({ ...newDept, id: e.target.value })}
                                placeholder={t('settings.deptIdPlaceholder')}
                            />
                        </FormField>
                        <FormField label={t('settings.deptName')} className="settings-form-grow">
                            <input
                                type="text"
                                value={newDept.name}
                                onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                            />
                        </FormField>
                        <FormField label={t('settings.deptIcon')} className="settings-form-icon">
                            <span className="dept-icon-slot" aria-label={t('settings.deptIcon')}>
                                <Folder size={16} />
                            </span>
                        </FormField>
                        <FormField label={t('settings.deptColor')} className="settings-form-color">
                            <input
                                type="color"
                                value={newDept.color}
                                onChange={e => setNewDept({ ...newDept, color: e.target.value })}
                            />
                        </FormField>
                    </div>
                    <FormField label={t('settings.deptDescription')}>
                        <input
                            type="text"
                            value={newDept.description}
                            onChange={e => setNewDept({ ...newDept, description: e.target.value })}
                        />
                    </FormField>
                    <div className="dept-add-actions">
                        <Button variant="primary" onClick={handleAdd} disabled={saving}>
                            {saving ? t('settings.saving') : t('common.save')}
                        </Button>
                        <Button variant="ghost" onClick={() => setAdding(false)}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            ) : (
                <Button variant="secondary" onClick={() => setAdding(true)}>
                    + {t('settings.addDepartment')}
                </Button>
            )}

            <ConfirmDialog
                open={!!confirmState}
                title={t('settings.confirmDelete')}
                message={t('settings.confirmDeleteDeptMsg').replace('{name}', confirmState?.name || '')}
                variant="danger"
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => { performDelete(confirmState.id); setConfirmState(null); }}
                onCancel={() => setConfirmState(null)}
            />
        </div>
    );
}

// ─── API Keys Tab ────────────────────────────────────────────────────────────

function ApiKeysTab({ t }) {
    const toast = useToast();
    const services = [
        { key: 'anthropic', label: t('settings.anthropicKey'), placeholder: t('settings.apiKeyPlaceholder'), hint: t('settings.apiKeyHint'), type: 'password' },
        { key: 'gemini', label: t('settings.geminiKey'), placeholder: 'AIza...', hint: t('settings.geminiKeyHint'), type: 'password' },
        { key: 'pinecone_api_key', label: t('settings.pineconeKey'), placeholder: 'pc-...', hint: t('settings.pineconeKeyHint'), type: 'password' },
        { key: 'pinecone_environment', label: t('settings.pineconeEnv'), placeholder: 'us-east-1', hint: t('settings.pineconeEnvHint'), type: 'text' },
        { key: 'pinecone_index', label: t('settings.pineconeIndex'), placeholder: 'agentos-kb', hint: t('settings.pineconeIndexHint'), type: 'text' },
        { key: 'confluence_url', label: t('settings.confluenceUrl'), placeholder: t('settings.confluenceUrlPlaceholder'), hint: t('settings.confluenceUrlHint'), type: 'text' },
        { key: 'confluence_token', label: t('settings.confluenceToken'), placeholder: t('settings.confluenceTokenPlaceholder'), hint: t('settings.confluenceTokenHint'), type: 'password' },
        { key: 'jira_url', label: t('settings.jiraUrl'), placeholder: t('settings.jiraUrlPlaceholder'), hint: t('settings.jiraUrlHint'), type: 'text' },
        { key: 'jira_email', label: t('settings.jiraEmail'), placeholder: t('settings.jiraEmailPlaceholder'), hint: t('settings.jiraEmailHint'), type: 'text' },
        { key: 'jira_token', label: t('settings.jiraToken'), placeholder: t('settings.jiraTokenPlaceholder'), hint: t('settings.jiraTokenHint'), type: 'password' },
        { key: 'jira_project_key', label: t('settings.jiraProjectKey'), placeholder: t('settings.jiraProjectKeyPlaceholder'), hint: t('settings.jiraProjectKeyHint'), type: 'text' },
    ];

    const [maskedKeys, setMaskedKeys] = useState({});
    const [newValues, setNewValues] = useState({});
    const [savingKey, setSavingKey] = useState(null);
    const [clearingKey, setClearingKey] = useState(null);
    const [confirmClear, setConfirmClear] = useState(null);

    useEffect(() => {
        fetch(`${API_URL}/api/settings/api-keys`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setMaskedKeys(data))
            .catch(() => {});
    }, []);

    const handleUpdate = async (serviceKey) => {
        const value = newValues[serviceKey];
        if (!value) return;
        setSavingKey(serviceKey);
        try {
            const res = await fetch(`${API_URL}/api/settings/api-keys`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ [serviceKey]: value }),
            });
            if (!res.ok) throw new Error('Failed');
            setMaskedKeys(prev => ({ ...prev, [serviceKey]: '••••' + value.slice(-4) }));
            setNewValues(prev => ({ ...prev, [serviceKey]: '' }));
            toast.success(t('settings.saved'));
        } catch {
            toast.error(t('common.error'));
        } finally {
            setSavingKey(null);
        }
    };

    const handleClear = async (serviceKey) => {
        setClearingKey(serviceKey);
        try {
            // TODO: backend endpoint added at DELETE /api/settings/api-keys/:service
            const res = await fetch(`${API_URL}/api/settings/api-keys/${serviceKey}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed');
            setMaskedKeys(prev => {
                const next = { ...prev };
                delete next[serviceKey];
                return next;
            });
            toast.success(t('settings.keyCleared'));
        } catch {
            toast.error(t('common.error'));
        } finally {
            setClearingKey(null);
            setConfirmClear(null);
        }
    };

    const isSavedKey = (val) => typeof val === 'string' && val.length > 0;

    return (
        <div className="settings-section">
            {services.map(({ key, label, placeholder, hint, type }) => {
                const masked = maskedKeys[key];
                const saved = isSavedKey(masked);
                return (
                    <div className="api-key-card" key={key}>
                        <div className="api-key-header">
                            <strong>{label}</strong>
                            <span className={`api-key-status ${saved ? 'set' : 'not-set'}`}>
                                {saved ? t('settings.apiKeySet') : t('settings.apiKeyNotSet')}
                            </span>
                        </div>
                        {saved && (
                            <div className="api-key-masked">{masked}</div>
                        )}
                        <p className="api-key-hint">{hint}</p>
                        <div className="api-key-form">
                            <input
                                type={type}
                                value={newValues[key] || ''}
                                onChange={e => setNewValues(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={placeholder}
                                aria-label={label}
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdate(key)}
                                disabled={savingKey === key || !newValues[key]}
                            >
                                {savingKey === key ? t('settings.saving') : t('settings.updateKey')}
                            </Button>
                            {saved && (
                                <Button
                                    variant="danger-outline"
                                    size="sm"
                                    onClick={() => setConfirmClear({ service: key, label })}
                                    disabled={clearingKey === key}
                                >
                                    {t('settings.clearKey')}
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}

            <ConfirmDialog
                open={!!confirmClear}
                title={t('settings.confirmClearKey')}
                message={t('settings.confirmClearKeyMsg').replace('{name}', confirmClear?.label || '')}
                variant="danger"
                confirmLabel={t('settings.clearKey')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => handleClear(confirmClear.service)}
                onCancel={() => setConfirmClear(null)}
            />
        </div>
    );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab({ t, currentUser }) {
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [confirmState, setConfirmState] = useState(null);
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'member' });

    const canManage = ['owner', 'admin'].includes(currentUser.role);

    useEffect(() => {
        if (!canManage) { setLoading(false); return; }
        fetch(`${API_URL}/api/settings/users`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => { setUsers(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [canManage]);

    if (!canManage) {
        return <div className="settings-section"><p className="settings-muted">{t('settings.noUsersTab')}</p></div>;
    }

    const handleAddUser = async () => {
        if (!newUser.email || !newUser.password) return;
        try {
            const res = await fetch(`${API_URL}/api/settings/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newUser),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error === 'Email already exists' ? t('settings.emailExists') : data.error);
                return;
            }
            setUsers(prev => [...prev, data]);
            setNewUser({ email: '', password: '', name: '', role: 'member' });
            setAdding(false);
            toast.success(t('settings.userCreated'));
        } catch {
            toast.error(t('common.error'));
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const res = await fetch(`${API_URL}/api/settings/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error); return; }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            toast.success(t('settings.roleChanged'));
        } catch {
            toast.error(t('common.error'));
        }
    };

    const performDelete = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/settings/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error);
                return;
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success(t('settings.userDeleted'));
        } catch {
            toast.error(t('common.error'));
        }
    };

    const requestDelete = (user) => {
        if (user.id === currentUser.id) {
            toast.warning(t('settings.cannotDeleteSelf'));
            return;
        }
        setConfirmState({ id: user.id, name: user.name || user.email });
    };

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="settings-section">
            <table className="settings-user-table">
                <thead>
                    <tr>
                        <th>{t('settings.userName')}</th>
                        <th>{t('settings.userEmail')}</th>
                        <th>{t('settings.userRole')}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id}>
                            <td>
                                {u.name || u.email.split('@')[0]}
                                {u.id === currentUser.id && <span className="user-you-badge">{t('settings.youBadge')}</span>}
                            </td>
                            <td>{u.email}</td>
                            <td>
                                <select
                                    value={u.role}
                                    onChange={e => handleRoleChange(u.id, e.target.value)}
                                    disabled={u.id === currentUser.id}
                                >
                                    <option value="owner">{t('settings.roleOwner')}</option>
                                    <option value="admin">{t('settings.roleAdmin')}</option>
                                    <option value="member">{t('settings.roleMember')}</option>
                                </select>
                            </td>
                            <td>
                                {u.id !== currentUser.id && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => requestDelete(u)}
                                        title={t('common.delete')}
                                        aria-label={t('common.delete')}
                                    >
                                        <X size={16} />
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {adding ? (
                <div className="dept-add-form" style={{ marginTop: 16 }}>
                    <div className="dept-add-row">
                        <FormField label={t('settings.userName')} className="settings-form-grow">
                            <input
                                type="text"
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            />
                        </FormField>
                        <FormField label={t('settings.userEmail')} className="settings-form-grow">
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            />
                        </FormField>
                        <FormField label={t('settings.userPassword')} className="settings-form-grow">
                            <input
                                type="password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            />
                        </FormField>
                        <FormField label={t('settings.userRole')} className="settings-form-role">
                            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option value="admin">{t('settings.roleAdmin')}</option>
                                <option value="member">{t('settings.roleMember')}</option>
                            </select>
                        </FormField>
                    </div>
                    <div className="dept-add-actions">
                        <Button variant="primary" onClick={handleAddUser}>
                            {t('common.save')}
                        </Button>
                        <Button variant="ghost" onClick={() => setAdding(false)}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            ) : (
                <Button variant="secondary" onClick={() => setAdding(true)} className="settings-add-spaced">
                    + {t('settings.addUser')}
                </Button>
            )}

            <ConfirmDialog
                open={!!confirmState}
                title={t('settings.confirmDelete')}
                message={t('settings.confirmDeleteUserMsg').replace('{name}', confirmState?.name || '')}
                variant="danger"
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => { performDelete(confirmState.id); setConfirmState(null); }}
                onCancel={() => setConfirmState(null)}
            />
        </div>
    );
}

// ─── Settings Page ───────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { user } = useOutletContext();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('workspace');

    const tabs = [
        { id: 'workspace', label: t('settings.tabWorkspace') },
        { id: 'departments', label: t('settings.tabDepartments') },
        { id: 'apikeys', label: t('settings.tabApiKeys') },
        { id: 'users', label: t('settings.tabUsers') },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: 24 }}>
                <h1>{t('settings.title')}</h1>
                <p className="subtitle" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    {t('settings.subtitle')}
                </p>
            </header>

            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'workspace' && <WorkspaceTab t={t} />}
            {activeTab === 'departments' && <DepartmentsTab t={t} />}
            {activeTab === 'apikeys' && <ApiKeysTab t={t} />}
            {activeTab === 'users' && <UsersTab t={t} currentUser={user} />}
        </div>
    );
}
