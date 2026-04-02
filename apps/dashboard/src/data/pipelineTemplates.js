// Pipeline templates derived from workflows.js for consistency
// Each template defines a DAG of stages with agent assignments

const PIPELINE_TEMPLATES = {
  campaign: {
    name: 'Campaign Creation',
    source_workflow: 'campaign-creation',
    stages: [
      { name: 'Strategy & Brief', agent_id: 'raul', department: 'strategic',
        depends_on: [], gate_type: 'human_approval',
        namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Campaign brief, objectives, KPIs, markets, BAU type classification' },
      { name: 'Technical Feasibility', agent_id: 'guillermo', department: 'strategic',
        depends_on: [0], namespaces: ['campaigns', 'emails'],
        description: 'Data model validation, DE design, API requirements, capacity check' },
      { name: 'Calendar & Timing', agent_id: 'martina', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'],
        description: 'Send date, conflict detection, cadence validation, blackout check' },
      { name: 'Segmentation & Audience', agent_id: 'diego', department: 'execution',
        depends_on: [1, 2], namespaces: ['campaigns', 'kpis', 'emails'],
        description: 'Audience definition, suppression logic, SQL, estimated volumes per market' },
      { name: 'Content & Creative', agent_id: 'lucia', department: 'execution',
        depends_on: [1, 2], namespaces: ['campaigns', 'emails', 'images', 'brand'],
        description: 'Copy per market/language/tier variant, subject lines, preview text' },
      { name: 'Brand Review', agent_id: 'sofia', department: 'control',
        depends_on: [3, 4], namespaces: ['brand', 'campaigns', 'images', 'emails'],
        description: 'Emirates premium tone, visual compliance, terminology check' },
      { name: 'Legal Review', agent_id: 'javier', department: 'control',
        depends_on: [3, 4], gate_type: 'human_approval',
        namespaces: ['campaigns', 'brand', 'kpis'],
        description: 'GDPR, UAE regulations, disclaimers, consent validation, market-specific' },
      { name: 'Automation & Build', agent_id: 'andres', department: 'execution',
        depends_on: [5, 6], namespaces: ['campaigns', 'emails'],
        description: 'Journey Builder config, triggers, send classification, deployment runbook' },
      { name: 'QA & Testing', agent_id: 'elena', department: 'control',
        depends_on: [7], namespaces: ['campaigns', 'emails', 'brand', 'images'],
        description: 'Link validation, rendering, spam score, deliverability, seed list test' },
      { name: 'Analytics Setup', agent_id: 'carlos', department: 'control',
        depends_on: [7], namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Tracking config, attribution model, KPI baseline, dashboard prep' },
    ]
  },

  flash_sale: {
    name: 'Flash Sale Rapid Deploy',
    source_workflow: 'flash-sale-rapid-deploy',
    stages: [
      { name: 'Urgent Brief', agent_id: 'raul', department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis'],
        description: 'Urgent brief with product, discount & markets' },
      { name: 'Fast Content', agent_id: 'lucia', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Generate multilingual copy — fast track' },
      { name: 'Fast Brand', agent_id: 'sofia', department: 'control',
        depends_on: [1], namespaces: ['brand', 'campaigns'],
        description: 'Fast-track brand review' },
      { name: 'Expedited Legal', agent_id: 'javier', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'brand'],
        description: 'Expedited compliance check' },
      { name: 'Rapid QA', agent_id: 'elena', department: 'control',
        depends_on: [2, 3], gate_type: 'human_approval',
        namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Rapid QA: links, renders & spam score' },
    ]
  },

  seasonal: {
    name: 'Seasonal Campaign Planning',
    source_workflow: 'seasonal-campaign-planning',
    stages: [
      { name: 'Strategy', agent_id: 'raul', department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Seasonal strategy and planning' },
      { name: 'Calendar Planning', agent_id: 'martina', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'],
        description: 'Full calendar plan for the season' },
      { name: 'Pre-build Audiences', agent_id: 'diego', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'],
        description: 'Pre-build audience segments for planned campaigns' },
      { name: 'Brief Preparation', agent_id: 'lucia', department: 'execution',
        depends_on: [1, 2], namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Prepare creative briefs for each campaign' },
      { name: 'Capacity Reservation', agent_id: 'guillermo', department: 'strategic',
        depends_on: [1], namespaces: ['campaigns'],
        description: 'Reserve infrastructure capacity for peak periods' },
    ]
  },

  general: {
    name: 'General Project',
    stages: [
      { name: 'Planning', agent_id: null, department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Project planning and scoping' },
      { name: 'Execution', agent_id: null, department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails'],
        description: 'Execute planned work' },
      { name: 'Review', agent_id: 'elena', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'kpis', 'brand'],
        description: 'Quality review and validation' },
    ]
  }
};

export default PIPELINE_TEMPLATES;
