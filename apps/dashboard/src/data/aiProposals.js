// apps/dashboard/src/data/aiProposals.js
// Emirates-specific AI proposals mock data — April 2026 context
// (Iran airspace restrictions ~6 weeks, negotiations underway Apr 14)

export const AI_PROPOSALS = {
  campaignCreation: [
    {
      id: 'reassurance-broadcast',
      priority: 'urgent',
      title: 'Reassurance broadcast — negotiation window now open',
      reasoning: 'Negotiations entered active phase Apr 14. Prime window to send proactive reassurance to affected-route passengers before competitor messaging arrives. Broadcast Operational type — T3 Lounge notice got 42.3% OR with purely informational content. Tone: confident, not alarming.',
      kpiContext: [
        { label: 'Broadcast Operational OR', value: '42.3%' },
        { label: 'Affected audience', value: '~340K' },
      ],
      primaryCta: { label: 'Create brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'miles-expiry-q2',
      priority: 'high',
      title: 'Miles Expiry urgency — Q2 window + travel uncertainty combo',
      reasoning: 'Miles Expiry 7-day urgency holds 60.3% OR (highest in portfolio). Many members with expiring miles are holding off booking due to airspace uncertainty. A redemption offer framed as "use miles, fly when routes reopen" reduces booking friction now.',
      kpiContext: [
        { label: '7-day urgency OR', value: '60.3%' },
        { label: 'Conv. rate', value: '7.3%' },
      ],
      primaryCta: { label: 'Create brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'route-recovery-dxb-man',
      priority: 'medium',
      title: 'Route recovery campaign — DXB-MAN pre-load',
      reasoning: 'DXB-Prague launch hit 44.8% OR and 7.8% CTR. DXB-MAN outbound is in QA now. If airspace reopens in the negotiation window (est. 2–4 weeks), first-mover recovery campaign on this route will capture the demand spike. Brief now, activate on trigger.',
      kpiContext: [
        { label: 'DXB-Prague OR', value: '44.8%' },
        { label: 'CTR', value: '7.8%' },
      ],
      primaryCta: { label: 'Draft brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'spring-flash-sale-hold',
      priority: 'low',
      title: 'Spring Flash Sale — 11 days in brief, hold or redirect?',
      reasoning: 'Spring Flash Sale created Apr 5, still in brief. Given current passenger sentiment, a fare discount on affected routes could read as panic pricing. Recommend holding until negotiation outcome is clearer, or redirecting to non-affected route set.',
      kpiContext: null,
      primaryCta: { label: 'Review routes →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
  ],

  competitorAnalysis: [
    {
      id: 'flydubai-trust-gap',
      priority: 'high',
      title: 'Flydubai silent on reassurance — trust gap in low-cost segment',
      reasoning: 'Spy network: Flydubai sent 0 operational comms in past 6 weeks on airspace. Their overlap with Emirates on DXB-short-haul is ~22% of audience. Passengers on shared routes have received no reassurance. Emirates Incident Solution template (82.3% OR) can capture this trust gap.',
      kpiContext: [
        { label: 'Incident Solution OR', value: '82.3%' },
        { label: 'Audience overlap', value: '~22%' },
      ],
      primaryCta: { label: 'Create campaign →', action: 'dismiss' },
      secondaryCta: { label: 'View detail', action: 'dismiss' },
    },
    {
      id: 'qatar-luxury-counter',
      priority: 'medium',
      title: 'Qatar Airways pushed luxury narrative during crisis — counter-position opportunity',
      reasoning: 'QR sent 3 campaigns in past 2 weeks emphasising Business Class comfort during "longer journeys." Emirates Preflight Experience (71.5% OR for premium) + Preflight Ancillary "Seat upgrade focus" (54.1% OR) can counter-position the extended routing as a premium experience.',
      kpiContext: [
        { label: 'Preflight Experience OR', value: '71.5%' },
        { label: 'Seat upgrade CTR', value: '21.3%' },
      ],
      primaryCta: { label: 'Create counter campaign →', action: 'dismiss' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'lufthansa-newsletter-gap',
      priority: 'low',
      title: 'Lufthansa newsletter frequency dropped 40% — inbox opening',
      reasoning: 'LH went from weekly to bi-weekly newsletter during crisis period. European route newsletters from LH reduced inbox competition. Emirates Newsletter trending up (30.2 → 32.4% OR in 3 months) — capitalise with an EU-targeted frequency bump this week.',
      kpiContext: [
        { label: 'Newsletter OR trend', value: '+2.2pp' },
      ],
      primaryCta: { label: 'Schedule send →', action: 'dismiss' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
  ],

  studio: {
    proposals: [
      {
        id: 'studio-subject-ar',
        priority: 'high',
        title: 'Shorten AR subject line — pattern confirmed across portfolio',
        reasoning: 'Statement Centralized AR with subject <30 chars has 41.3% OR vs 38.9% for longer versions. Onboarding Centralized AR (52.4% OR) vs EN (55.2% OR) confirms shorter copy wins in Arabic market. Suggested: condense to <32 chars.',
        kpiContext: [
          { label: 'Statement AR short OR', value: '41.3%' },
          { label: 'vs long version', value: '+2.4pp' },
        ],
        primaryCta: { label: 'Apply suggestion →', action: 'dismiss' },
        secondaryCta: { label: 'Edit manually', action: 'dismiss' },
      },
      {
        id: 'studio-preheader-sync',
        priority: 'medium',
        title: 'EN preheader updated but AR/ES not synced',
        reasoning: 'Variant EN has updated preheader with "Updated routing information." AR and ES still carry the original generic copy from 6 days ago. Broadcast Operational pattern shows consistent preheader across markets improves OR by ~3pp.',
        kpiContext: null,
        primaryCta: { label: 'Sync all preheaders →', action: 'dismiss' },
        secondaryCta: { label: 'Ignore', action: 'dismiss' },
      },
      {
        id: 'studio-cta-text',
        priority: 'low',
        title: '"Book now" CTA may increase unsubscribes in current climate',
        reasoning: 'Operational emails with transactional CTAs ("View your itinerary", "Check route status") outperform "Book now" by 2.1x CTR in disruption scenarios. Recommend swapping primary CTA for this campaign type.',
        kpiContext: null,
        primaryCta: { label: 'Change CTA text →', action: 'dismiss' },
        secondaryCta: { label: 'Keep as-is', action: 'dismiss' },
      },
    ],
    inlineTips: [
      {
        id: 'tip-ar-subject-length',
        marketFilter: 'ar',
        message: 'AR subject line >35 chars — portfolio data shows 12–15% lower OR in Arabic market at this length.',
      },
      {
        id: 'tip-ru-flight-keywords',
        marketFilter: 'ru',
        message: 'RU variant contains flight-related keywords with elevated sensitivity in current regional context. Consider neutral framing.',
      },
    ],
  },

  journeys: {
    preflight: [
      {
        id: 'journey-beflyoufly-outdated',
        priority: 'urgent',
        title: 'BeforeYouFly content outdated for 23 affected routes',
        reasoning: 'BeforeYouFly (68.2% OR — 2nd highest in portfolio) sends a travel checklist 7 days before departure. The content block for affected routes still shows original flight times. Extended routings add 40–90 min — passenger arrives at gate with wrong timing. Legal + operational risk.',
        kpiContext: [
          { label: 'BeforeYouFly OR', value: '68.2%' },
          { label: 'Affected routes', value: '23' },
        ],
        primaryCta: { label: 'Update content block →', action: 'dismiss' },
        secondaryCta: { label: 'View in canvas', action: 'dismiss' },
      },
      {
        id: 'journey-route-split',
        priority: 'medium',
        title: 'Add conditional branch — affected route vs normal routing',
        reasoning: 'Current Pre-Flight journey has no routing-based split. A decision node on route_group = "iran_diversion" would let you serve updated content to 23 routes without touching the other 180+ routes in the same journey.',
        kpiContext: null,
        primaryCta: { label: 'Add split node →', action: 'dismiss' },
        secondaryCta: { label: 'Keep single path', action: 'dismiss' },
      },
      {
        id: 'journey-ancillary-timing',
        priority: 'low',
        title: 'Preflight Ancillary — reduce upsell pressure on diverted routes',
        reasoning: 'Preflight Ancillary currently fires 72h before departure regardless of context. For passengers on diverted routes, seat upgrade upsell at 72h may feel tone-deaf. Consider extending to 48h or suppressing for affected routes until situation stabilises.',
        kpiContext: null,
        primaryCta: { label: 'Adjust timing →', action: 'dismiss' },
        secondaryCta: { label: 'Keep 72h', action: 'dismiss' },
      },
    ],
    milesExpiry: [
      {
        id: 'journey-miles-no-exit',
        priority: 'urgent',
        title: 'Branch "no open 7d" has no exit — contacts loop indefinitely',
        reasoning: 'Miles Expiry 7-day urgency has 60.3% OR — meaning ~40% do not open. Without an exit path, those contacts stay active in the journey forever. Risk of spam complaint on subsequent sends.',
        kpiContext: [
          { label: '7-day urgency OR', value: '60.3%' },
          { label: 'Non-openers at risk', value: '~40%' },
        ],
        primaryCta: { label: 'Add exit node →', action: 'dismiss' },
        secondaryCta: { label: 'View in canvas', action: 'dismiss' },
      },
      {
        id: 'journey-miles-wait-node',
        priority: 'medium',
        title: 'Wait node between touchpoints configured as 1h — should be 30d',
        reasoning: 'The multi-touch sequence (90d → 30d → 7d warning) has a Wait node set to 1h between the trigger and the first email. The gap between the 90d and 30d touchpoints should be 30 days, not 1 hour.',
        kpiContext: null,
        primaryCta: { label: 'Change to 30d →', action: 'dismiss' },
        secondaryCta: { label: 'Keep', action: 'dismiss' },
      },
      {
        id: 'journey-miles-tier-split',
        priority: 'low',
        title: 'Add tier split before Email 1 — high-OR pattern in portfolio',
        reasoning: 'Miles Abandon (premium segment) has 42.1% OR vs 28.6% for Search Abandon (general). A tier split before Email 1 would allow personalising the redemption offer by Gold/Silver/Blue tier.',
        kpiContext: null,
        primaryCta: { label: 'Add tier split →', action: 'dismiss' },
        secondaryCta: { label: 'Dismiss', action: 'dismiss' },
      },
    ],
    default: [
      {
        id: 'journey-default-exit',
        priority: 'high',
        title: 'No exit path for non-engagers detected',
        reasoning: 'This journey has at least one branch where contacts with no engagement have no defined exit. They will remain active indefinitely, inflating active contact counts and risking deliverability.',
        kpiContext: null,
        primaryCta: { label: 'Add exit node →', action: 'dismiss' },
        secondaryCta: { label: 'View canvas', action: 'dismiss' },
      },
    ],
  },
};

export const CHAT_PROMPT_CHIPS = {
  campaignCreation: [
    'What campaigns should I prioritise this week?',
    'Suggest a brief for an urgency-based offer',
    "What's underperforming in our BAU portfolio?",
  ],
  competitorAnalysis: [
    'What are competitors doing differently this month?',
    'Find gaps in competitor email calendar',
    'How should we counter their latest loyalty push?',
  ],
  studio: [
    'Review this subject line for all markets',
    'Which variant is most likely to underperform?',
    'Suggest a shorter AR subject line',
  ],
  journeyBuilder: [
    "What's missing in this journey?",
    'Check for exit path issues',
    'Suggest a split node for this audience',
  ],
};

// Proposed journeys — shown on JourneysListPage hero area.
// Each proposal launches the canvas + seed conversation on click.
// Focus: airline-specific patterns Emirates actually runs but aren't in the
// current template set (cart_abandon / welcome / tier_upgrade / scratch).
export const PROPOSED_JOURNEYS = [
  {
    id: 'flight-disruption-care',
    priority: 'urgent',
    icon: '⚠',
    title: 'Flight Disruption Care',
    description: 'Auto-trigger on IROPS events. Empathy note + 1-click rebook + lounge voucher for delayed premium pax.',
    context: 'Timely — Iran airspace diversions affect ~23 routes',
    suggestedName: 'Flight Disruption Care',
    seed: "Build a journey triggered on an IROPS event (flight_status in ['cancelled','diverted','delayed_3h+']). Start with an empathy + information email immediately after the trigger. Wait 30 minutes, then split by cabin class: Business and First Class get a rebook + complimentary lounge access offer; Economy gets a self-service rebook link with a $50 travel voucher. Wait 24 hours, exit contacts who completed rebook. For the rest, send one follow-up with live agent chat link. Validate at the end so I can review before deploying.",
  },
  {
    id: 'miles-expiry-rescue',
    priority: 'high',
    icon: '◈',
    title: 'Miles Expiry Rescue (3-touch)',
    description: '90d / 30d / 7d multi-touch. Portfolio 7-day urgency holds 60.3% OR — highest in Emirates lifecycle.',
    context: 'Proven: 60.3% OR on 7-day warning',
    suggestedName: 'Miles Expiry Rescue',
    seed: "Build a journey targeting Skywards members with miles expiring in 90 days. Start with a soft reminder email showing their balance and 3 suggested redemptions. Wait 60 days, then split on engagement — members who redeemed exit the journey; non-redeemers get a 30-day warning with a bonus-miles-if-you-redeem-now offer. Wait 23 days, exit anyone who redeemed; send the remaining contacts a 7-day urgency email with a countdown and single high-value redemption option. Validate at the end so I can review before deploying.",
  },
  {
    id: 'birthday-bonus-miles',
    priority: 'medium',
    icon: '✦',
    title: 'Birthday Bonus Miles',
    description: 'Fire on member birthday. 1,000 bonus miles + personalised destination recommendation from search history.',
    context: 'Airline-standard loyalty moment',
    suggestedName: 'Birthday Bonus Miles',
    seed: "Build a birthday journey for Skywards members. Trigger on date_of_birth match (run daily). Send a personalised happy-birthday email with 1,000 bonus miles automatically credited and one destination recommendation pulled from the member's recent search activity. Wait 7 days, and split on whether they booked — bookers exit; non-bookers get a gentle follow-up with a flash redemption offer valid for 14 days. Validate at the end so I can review before deploying.",
  },
  {
    id: 'premium-upgrade-72h',
    priority: 'medium',
    icon: '◆',
    title: '72h Premium Upgrade Nudge',
    description: 'Pre-flight 72h window — bid-based upgrade offer. Portfolio shows bid-based beats fixed (48.4% vs 43.2% OR).',
    context: 'Proven: bid-based 48.4% OR',
    suggestedName: 'Premium Upgrade 72h',
    seed: "Build a pre-flight upgrade journey firing 72 hours before departure for Economy passengers on flights with premium inventory available. Send an email offering a bid-based upgrade to Business Class with the member's suggested bid range. Wait 24 hours, split on whether they placed a bid — bidders exit; non-bidders get a second email at 48h pre-flight with a fixed-price last-minute offer (smaller price, limited time). Validate at the end so I can review before deploying.",
  },
  {
    id: 'dormant-winback-365d',
    priority: 'medium',
    icon: '◐',
    title: 'Dormant Winback (365d)',
    description: 'Reactivate Skywards members inactive 365 days. 2,500 bonus miles + destination inspiration from profile.',
    context: 'Airline winback playbook',
    suggestedName: 'Dormant Winback 365d',
    seed: "Build a winback journey for Skywards members with no booking or engagement for 365 days. Start with a 'we miss you' email offering 2,500 bonus miles credited instantly, plus three destination ideas based on their profile. Wait 14 days, split on engagement — openers get a follow-up with a fare sale matching those destinations; non-openers get one final SMS/email combo with a generic last-call offer before exiting into an 'inactive' segment for suppression. Validate at the end so I can review before deploying.",
  },
  {
    id: 'postflight-nps-partner',
    priority: 'low',
    icon: '◎',
    title: 'Post-Flight NPS → Partner Upsell',
    description: 'NPS survey 24h after landing. Promoters (9-10) → partner hotel/car offer; detractors (0-6) → service recovery.',
    context: 'Dual-purpose: feedback + revenue',
    suggestedName: 'Post-Flight NPS + Partner',
    seed: "Build a post-flight journey firing 24 hours after landing. Start with a short NPS survey email (1 question). Wait 3 days and split on the response: promoters (score 9-10) receive a partner hotel and car rental bundle offer for their destination; passives (7-8) get a thank-you with a Skywards miles progress update; detractors (0-6) get a service recovery email with a direct agent contact and optional 5,000 goodwill miles. Exit all contacts 14 days after the split. Validate at the end so I can review before deploying.",
  },
];
