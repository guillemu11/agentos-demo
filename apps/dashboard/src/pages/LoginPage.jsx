import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function LoginPage({ onLogin }) {
    const { t } = useLanguage();
    const [needsSetup, setNeedsSetup] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/auth/setup-status`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setNeedsSetup(data.needsSetup))
            .catch(() => setNeedsSetup(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = needsSetup ? '/auth/setup' : '/auth/login';
            const body = needsSetup ? { email, password, name } : { email, password };

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || t('auth.invalidCredentials'));
                return;
            }

            onLogin(data.user);
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    if (needsSetup === null) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="login-loading">{t('common.loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <img src="/emirates-logo.png" alt="Emirates" className="login-logo-img" />
                </div>

                <h2 className="login-title">
                    {needsSetup ? t('auth.setupTitle') : t('auth.login')}
                </h2>
                {needsSetup && (
                    <p className="login-subtitle">{t('auth.setupSubtitle')}</p>
                )}

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {needsSetup && (
                        <div className="login-field">
                            <label>{t('auth.setupName')}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="John Doe"
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div className="login-field">
                        <label>{t('auth.email')}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label>{t('auth.password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            autoComplete={needsSetup ? 'new-password' : 'current-password'}
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading
                            ? (needsSetup ? t('auth.settingUp') : t('auth.loggingIn'))
                            : (needsSetup ? t('auth.setupBtn') : t('auth.loginBtn'))
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}
