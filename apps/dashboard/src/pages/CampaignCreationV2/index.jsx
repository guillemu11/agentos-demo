import React from 'react';
import { useSearchParams } from 'react-router-dom';
import BriefsBoard from './BriefsBoard.jsx';
import OverviewDashboard from './OverviewDashboard.jsx';
import CampaignsCalendar from './CampaignsCalendar.jsx';
import SetupChatView from './SetupChatView.jsx';
import ContentOptionsChat from './ContentOptionsChat.jsx';
import CampaignWizard from './CampaignWizard.jsx';
import './campaign-creation-v2.css';

const TABS = [
  { id: 'briefs',   label: 'Briefs'   },
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
];

export default function CampaignCreationV2Page() {
  const [params, setParams] = useSearchParams();
  const briefId = params.get('briefId');
  const mode    = params.get('mode');       // 'setup' | 'options' | 'wizard'
  const tab     = params.get('tab') || 'briefs';

  if (briefId && mode === 'setup')   return <SetupChatView     briefId={briefId} />;
  if (briefId && mode === 'options') return <ContentOptionsChat briefId={briefId} />;
  if (briefId && mode === 'wizard')  return <CampaignWizard     briefId={briefId} />;

  return (
    <div className="cc2-shell">
      <nav className="cc2-tabs" role="tablist" aria-label="Campaign creation sections">
        {TABS.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              className={`cc2-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setParams({ tab: t.id })}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
            >{t.label}</button>
          );
        })}
      </nav>
      <main className="cc2-main">
        {tab === 'briefs'   && <BriefsBoard />}
        {tab === 'overview' && <OverviewDashboard />}
        {tab === 'calendar' && <CampaignsCalendar />}
      </main>
    </div>
  );
}
