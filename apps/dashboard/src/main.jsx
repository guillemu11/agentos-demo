import React, { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import Layout from './components/Layout.jsx'
import App from './App.jsx'
import WorkspaceOverview from './pages/WorkspaceOverview.jsx'
import DepartmentDetail from './pages/DepartmentDetail.jsx'
import AgentDetail from './pages/AgentDetail.jsx'
import WeeklyBoard from './pages/WeeklyBoard.jsx'
import DailyStandup from './pages/DailyStandup.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'

import AuditLog from './pages/AuditLog.jsx'
import IntelligenceHub from './pages/IntelligenceHub.jsx'
import PmReports from './pages/PmReports.jsx'
import Inbox from './pages/Inbox.jsx'
import WorkflowsHub from './pages/WorkflowsHub.jsx'
import CampaignsHub from './pages/CampaignsHub.jsx'
import CampaignDetail from './pages/CampaignDetail.jsx'
import BauTypeDetail from './pages/BauTypeDetail.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ToolDetail from './pages/ToolDetail.jsx'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import AutoResearch from './pages/AutoResearch.jsx'
import ContentStudioPage from './pages/ContentStudioPage.jsx';
import ImageStudioPage from './pages/ImageStudioPage.jsx';
import EmailStudioPage from './pages/EmailStudioPage.jsx';
import BlockStudioPage from './pages/BlockStudioPage.jsx';
import UnifiedStudioPage from './pages/UnifiedStudioPage.jsx';
import CampaignCreationPage from './pages/CampaignCreationPage.jsx';
import PreviewTestPage from './pages/PreviewTestPage.jsx';
import CompetitorAnalysisPage from './pages/CompetitorAnalysisPage.jsx';
import BrandAuditPage from './pages/BrandAuditPage.jsx';
import JourneysListPage from './pages/JourneysListPage.jsx';
import JourneyBuilderPage from './pages/JourneyBuilderPage.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#0f172a' }}>Something went wrong</h2>
          <pre style={{ color: '#ef4444', fontSize: '0.85rem' }}>{this.state.error?.message}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '8px 24px', borderRadius: '9999px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#64748b' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return children({ user, onLogout: handleLogout });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/app" replace />} />

            {/* Protected dashboard routes */}
            <Route path="/app/*" element={
              <AuthGate>
                {({ user, onLogout }) => (
                  <Routes>
                    <Route element={<Layout user={user} onLogout={onLogout} />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/projects" element={<App />} />
                      <Route path="/workspace" element={<WorkspaceOverview />} />
                      <Route path="/workspace/:deptId" element={<DepartmentDetail />} />
                      <Route path="/workspace/:deptId/weekly" element={<WeeklyBoard />} />
                      <Route path="/workspace/:deptId/daily" element={<DailyStandup />} />
                      <Route path="/workflows" element={<WorkflowsHub />} />
                      <Route path="/campaigns" element={<CampaignsHub />} />
                      <Route path="/campaigns/bau/:bauTypeId" element={<BauTypeDetail />} />
                      <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
                      <Route path="/workspace/audit" element={<AuditLog />} />
                      <Route path="/workspace/intelligence" element={<IntelligenceHub />} />
                      <Route path="/workspace/agent/:agentId" element={<AgentDetail />} />
                      <Route path="/workspace/tool/:toolId" element={<ToolDetail />} />
                      <Route path="/inbox" element={<Inbox />} />
                      <Route path="/pm-reports" element={<PmReports />} />
                      <Route path="/knowledge" element={<KnowledgeBase />} />
                      <Route path="/research" element={<AutoResearch />} />
                      <Route path="/research/:sessionId" element={<AutoResearch />} />
                      <Route path="/studio" element={<UnifiedStudioPage />} />
                      <Route path="/image-studio" element={<ImageStudioPage />} />
                      <Route path="/email-studio" element={<EmailStudioPage />} />
                      <Route path="/content-studio" element={<ContentStudioPage />} />
                      <Route path="/campaign-creation" element={<CampaignCreationPage />} />
                      <Route path="/preview-test" element={<PreviewTestPage />} />
                      <Route path="/competitor-analysis" element={<CompetitorAnalysisPage />} />
                      <Route path="/brand-audit" element={<BrandAuditPage />} />
                      <Route path="/journeys" element={<JourneysListPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                    {/* Journey builder — full-screen */}
                    <Route path="/journeys/:id" element={<JourneyBuilderPage />} />
                    {/* Studio routes — full-screen, no sidebar */}
                    <Route path="/workspace/agent/content-agent/studio" element={<ContentStudioPage />} />
                    <Route path="/workspace/agent/html-developer/studio" element={<EmailStudioPage />} />
                    <Route path="/workspace/agent/html-developer/block-studio" element={<BlockStudioPage />} />
                  </Routes>
                )}
              </AuthGate>
            } />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
