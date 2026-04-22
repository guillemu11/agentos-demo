// Delegates to the full-featured wizard inherited from master. The only wiring
// this shell adds is the briefId prop — the wizard loads the brief and
// pre-fills its state via stateFromBrief(). All the Content Studio richness
// (autopilot, live preview, blocks, AI copilot, image library) is preserved.

import React from 'react';
import CampaignCreationV2Page from '../CampaignCreationV2Page.jsx';

export default function CampaignWizard({ briefId }) {
  return <CampaignCreationV2Page briefId={briefId} />;
}
