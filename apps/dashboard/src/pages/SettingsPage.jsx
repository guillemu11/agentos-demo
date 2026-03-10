import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

function Toast({ message, onDone }) {
    useEffect(() => {
        const timer = setTimeout(onDone, 3000);
        return () => clearTimeout(timer);
    }, [onDone]);
    return <div className="settings-toast">{message}</div>;
}

// ─── Workspace Tab ───────────────────────────────────────────────────────────

function WorkspaceTab({ t }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

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
            setToast(t('settings.saved'));
        } catch {
            setToast(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-section">
            {toast && <Toast message={toast} onDone={() => setToast(null)} />}
            <div className="settings-form-group">
                <label>{t('settings.workspaceName')}</label>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('settings.workspaceNamePlaceholder')}
                />
            </div>
            <div className="settings-form-group">
                <label>{t('settings.workspaceDescription')}</label>
                <textarea
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('settings.workspaceDescPlaceholder')}
                />
            </div>
            <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? t('settings.saving') : t('settings.saveChanges')}
            </button>
        </div>
    );
}

// ─── Departments Tab ─────────────────────────────────────────────────────────

function DepartmentsTab({ t }) {
    const [departments, setDepartments] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newDept, setNewDept] = useState({ id: '', name: '', emoji: '📁', color: '#3b82f6', description: '' });

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
            setToast(t('settings.saved'));
        } catch {
            setToast(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (deptId) => {
        if (!confirm(t('settings.confirmDeleteDept'))) return;
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
        setNewDept({ id: '', name: '', emoji: '📁', color: '#3b82f6', description: '' });
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
            {toast && <Toast message={toast} onDone={() => setToast(null)} />}

            <div className="dept-list">
                {Object.entries(departments).map(([id, dept]) => (
                    <div key={id} className="dept-card">
                        <div className="dept-card-header">
                            <span className="dept-color-swatch" style={{ backgroundColor: dept.color }} />
                            <input
                                className="dept-inline-input dept-emoji-input"
                                value={dept.emoji}
                                onChange={e => handleFieldChange(id, 'emoji', e.target.value)}
                                onBlur={handleBlurSave}
                            />
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
                            <button className="dept-delete-btn" onClick={() => handleDelete(id)} title={t('common.delete')}>
                                &times;
                            </button>
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
                        <div className="settings-form-group" style={{ flex: 1 }}>
                            <label>{t('settings.deptId')}</label>
                            <input
                                type="text"
                                value={newDept.id}
                                onChange={e => setNewDept({ ...newDept, id: e.target.value })}
                                placeholder={t('settings.deptIdPlaceholder')}
                            />
                        </div>
                        <div className="settings-form-group" style={{ flex: 1 }}>
                            <label>{t('settings.deptName')}</label>
                            <input
                                type="text"
                                value={newDept.name}
                                onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                            />
                        </div>
                        <div className="settings-form-group" style={{ width: 70 }}>
                            <label>{t('settings.deptEmoji')}</label>
                            <input
                                type="text"
                                value={newDept.emoji}
                                onChange={e => setNewDept({ ...newDept, emoji: e.target.value })}
                            />
                        </div>
                        <div className="settings-form-group" style={{ width: 60 }}>
                            <label>{t('settings.deptColor')}</label>
                            <input
                                type="color"
                                value={newDept.color}
                                onChange={e => setNewDept({ ...newDept, color: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="settings-form-group">
                        <label>{t('settings.deptDescription')}</label>
                        <input
                            type="text"
                            value={newDept.description}
                            onChange={e => setNewDept({ ...newDept, description: e.target.value })}
                        />
                    </div>
                    <div className="dept-add-actions">
                        <button className="settings-save-btn" onClick={handleAdd} disabled={saving}>
                            {saving ? t('settings.saving') : t('common.save')}
                        </button>
                        <button className="settings-cancel-btn" onClick={() => setAdding(false)}>
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                <button className="settings-add-btn" onClick={() => setAdding(true)}>
                    + {t('settings.addDepartment')}
                </button>
            )}
        </div>
    );
}

// ─── API Keys Tab ────────────────────────────────────────────────────────────

function ApiKeysTab({ t }) {
    const services = [
        { key: 'anthropic', label: t('settings.anthropicKey'), placeholder: t('settings.apiKeyPlaceholder'), hint: t('settings.apiKeyHint'), type: 'password' },
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
    const [toast, setToast] = useState(null);

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
            setToast(t('settings.saved'));
        } catch {
            setToast(t('common.error'));
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className="settings-section">
            {toast && <Toast message={toast} onDone={() => setToast(null)} />}

            {services.map(({ key, label, placeholder, hint, type }) => (
                <div className="api-key-card" key={key}>
                    <div className="api-key-header">
                        <strong>{label}</strong>
                        <span className={`api-key-status ${maskedKeys[key] ? 'set' : 'not-set'}`}>
                            {maskedKeys[key] ? t('settings.apiKeySet') : t('settings.apiKeyNotSet')}
                        </span>
                    </div>
                    {maskedKeys[key] && (
                        <div className="api-key-masked">{maskedKeys[key]}</div>
                    )}
                    <p className="api-key-hint">{hint}</p>
                    <div className="api-key-form">
                        <input
                            type={type}
                            value={newValues[key] || ''}
                            onChange={e => setNewValues(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={placeholder}
                        />
                        <button className="settings-save-btn" onClick={() => handleUpdate(key)} disabled={savingKey === key || !newValues[key]}>
                            {savingKey === key ? t('settings.saving') : t('settings.updateKey')}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab({ t, currentUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [adding, setAdding] = useState(false);
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
                setToast(data.error === 'Email already exists' ? t('settings.emailExists') : data.error);
                return;
            }
            setUsers(prev => [...prev, data]);
            setNewUser({ email: '', password: '', name: '', role: 'member' });
            setAdding(false);
            setToast(t('settings.userCreated'));
        } catch {
            setToast(t('common.error'));
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
            if (!res.ok) { setToast(data.error); return; }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setToast(t('settings.roleChanged'));
        } catch {
            setToast(t('common.error'));
        }
    };

    const handleDelete = async (userId) => {
        if (userId === currentUser.id) { setToast(t('settings.cannotDeleteSelf')); return; }
        if (!confirm(t('settings.confirmDeleteUser'))) return;
        try {
            const res = await fetch(`${API_URL}/api/settings/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const data = await res.json();
                setToast(data.error);
                return;
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
            setToast(t('settings.userDeleted'));
        } catch {
            setToast(t('common.error'));
        }
    };

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="settings-section">
            {toast && <Toast message={toast} onDone={() => setToast(null)} />}

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
                                    <button className="dept-delete-btn" onClick={() => handleDelete(u.id)} title={t('common.delete')}>
                                        &times;
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {adding ? (
                <div className="dept-add-form" style={{ marginTop: 16 }}>
                    <div className="dept-add-row">
                        <div className="settings-form-group" style={{ flex: 1 }}>
                            <label>{t('settings.userName')}</label>
                            <input
                                type="text"
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            />
                        </div>
                        <div className="settings-form-group" style={{ flex: 1 }}>
                            <label>{t('settings.userEmail')}</label>
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            />
                        </div>
                        <div className="settings-form-group" style={{ flex: 1 }}>
                            <label>{t('settings.userPassword')}</label>
                            <input
                                type="password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            />
                        </div>
                        <div className="settings-form-group" style={{ width: 130 }}>
                            <label>{t('settings.userRole')}</label>
                            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option value="admin">{t('settings.roleAdmin')}</option>
                                <option value="member">{t('settings.roleMember')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="dept-add-actions">
                        <button className="settings-save-btn" onClick={handleAddUser}>
                            {t('common.save')}
                        </button>
                        <button className="settings-cancel-btn" onClick={() => setAdding(false)}>
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                <button className="settings-add-btn" onClick={() => setAdding(true)} style={{ marginTop: 16 }}>
                    + {t('settings.addUser')}
                </button>
            )}
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
