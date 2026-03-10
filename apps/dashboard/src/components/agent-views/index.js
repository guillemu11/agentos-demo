import GenericAgentView from './GenericAgentView.jsx';
import CrmAgentView from './CrmAgentView.jsx';
import CloudArchitectView from './CloudArchitectView.jsx';
import CampaignManagerView from './CampaignManagerView.jsx';
import HtmlDeveloperView from './HtmlDeveloperView.jsx';
import ContentAgentView from './ContentAgentView.jsx';
import SegmentationAgentView from './SegmentationAgentView.jsx';
import AutomationArchitectView from './AutomationArchitectView.jsx';
import CalendarAgentView from './CalendarAgentView.jsx';
import BrandGuardianView from './BrandGuardianView.jsx';
import LegalAgentView from './LegalAgentView.jsx';
import QaAgentView from './QaAgentView.jsx';
import AnalyticsAgentView from './AnalyticsAgentView.jsx';
import DocumentationAgentView from './DocumentationAgentView.jsx';
import CompetitiveIntelView from './CompetitiveIntelView.jsx';

export const viewMap = {
  'campaign-manager': CampaignManagerView,
  'raul': CampaignManagerView,  // Legacy DB id
  'crm-agent': CrmAgentView,
  'valentina': CrmAgentView,  // Legacy DB id → maps to same view
  'cloud-architect': CloudArchitectView,
  'guillermo': CloudArchitectView,  // Legacy DB id
  'html-developer': HtmlDeveloperView,
  // No legacy DB id for html-developer (new agent)
'content-agent': ContentAgentView,
  'lucia': ContentAgentView,  // Legacy DB id
  'segmentation-agent': SegmentationAgentView,
  'diego': SegmentationAgentView,  // Legacy DB id
  'automation-architect': AutomationArchitectView,
  'andres': AutomationArchitectView,  // Legacy DB id
  'calendar-agent': CalendarAgentView,
  'martina': CalendarAgentView,  // Legacy DB id
  'brand-guardian': BrandGuardianView,
  'sofia': BrandGuardianView,  // Legacy DB id
  'legal-agent': LegalAgentView,
  'javier': LegalAgentView,  // Legacy DB id
  'qa-agent': QaAgentView,
  'elena': QaAgentView,  // Legacy DB id
  'analytics-agent': AnalyticsAgentView,
  'carlos': AnalyticsAgentView,  // Legacy DB id
  'doc-agent': DocumentationAgentView,
  'marina': DocumentationAgentView,  // Legacy DB id
  'competitive-intel': CompetitiveIntelView,
};

export { GenericAgentView };

export function getViewForAgent(agentId) {
  return viewMap[agentId] || GenericAgentView;
}
