import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Sparkles, Rocket, Check, CheckCircle2,
  Image as ImageIcon, Upload, Plus, Smartphone, Monitor,
  Wand2, Languages, Palette, ShieldCheck, TrendingUp, MousePointerClick,
  Eye, Users, Target, Clock, ChevronRight, X, Mic, Send,
  Mail, Globe, Award, Activity, ArrowUpRight, Loader2, Trash2,
  ImagePlus, MessageCircle, Search, Cloud,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================================
// Mock data — behavioral segmentation, AI suggestions, etc.
// ============================================================

const BEHAVIOR_AXES = [
  {
    id: 'engagement',
    icon: Mail,
    title: 'Email engagement',
    desc: 'Interacción con emails previos',
    tags: [
      'open_last_7d', 'open_last_30d', 'click_last_30d',
      'never_clicked', 'opened_no_click', 'dormant_90d',
      'highly_engaged', 'unsub_risk',
    ],
  },
  {
    id: 'travel',
    icon: Globe,
    title: 'Travel behavior',
    desc: 'Patrones de compra y viaje',
    tags: [
      'flew_last_90d', 'flew_last_year', 'never_flew',
      'abandoned_cart', 'searched_no_book',
      'business_class_flyer', 'family_booker', 'solo_leisure',
      'route_lover:DXB-LHR',
    ],
  },
  {
    id: 'lifecycle',
    icon: Activity,
    title: 'Lifecycle & intent',
    desc: 'Etapa y señales predictivas (AI)',
    tags: [
      'new_subscriber', 'activation_stage', 'engaged_loyalist',
      'at_risk', 'win_back', 'vip_whale',
      'predicted_next_trip:30d', 'price_sensitive', 'premium_seeker',
    ],
  },
];

const MOCK_VARIANTS = [
  {
    id: 'v1',
    code: 'A350_FR_EN_Gold_highly-engaged',
    market: 'FR', language: 'EN', tier: 'Gold',
    behaviors: ['highly_engaged', 'business_class_flyer'],
    size: 12480,
    angle: 'Premium regulars — upsell to business class',
    status: 'ready',
    subject: 'Your next business class upgrade — exclusive preview for Gold members',
    preheader: 'Your A350 Premium Economy seat is ready. Consider an upgrade.',
    mainHeader: 'Fly now, pay later',
    subheader: 'TRAVEL INSPIRATION',
    body: "Mathieu, you've taken 7 Premium Economy flights this year. The A350 is our finest addition yet — and as a Gold member, you get priority access to business class upgrades with miles.",
    ctaLabel: 'View upgrade offers',
    ctaUrl: 'https://emirates.com/gold/upgrade',
  },
  {
    id: 'v2',
    code: 'A350_FR_EN_Silver_dormant',
    market: 'FR', language: 'EN', tier: 'Silver',
    behaviors: ['dormant_90d', 'flew_last_year'],
    size: 31200,
    angle: 'Win-back — remind them why they loved us',
    status: 'editing',
    subject: "We've missed you — and we've got something new",
    preheader: 'Premium Economy on the new Emirates A350',
    mainHeader: 'Welcome back',
    subheader: 'SOMETHING NEW',
    body: "It's been a while. Since we last saw you, we've introduced the Emirates A350 with fully-adjustable Premium Economy seats. Start planning your return with 0% APR.",
    ctaLabel: 'Explore new routes',
    ctaUrl: 'https://emirates.com/welcomeback',
  },
  {
    id: 'v3',
    code: 'A350_FR_FR_Gold_abandoned',
    market: 'FR', language: 'FR', tier: 'Gold',
    behaviors: ['abandoned_cart', 'price_sensitive'],
    size: 3940,
    angle: 'Nudge with concrete savings + 0% APR emphasis',
    status: 'draft',
    subject: 'Toujours intéressé ? Payez 48€/mois sans frais',
    preheader: 'Votre réservation Montréal → Dubaï vous attend',
    mainHeader: 'Votre voyage vous attend',
    subheader: 'INSPIRATION VOYAGE',
    body: "Nous avons gardé votre recherche. Réservez la Premium Economy sur le nouvel A350 et étalez le paiement sur 12 mois — sans intérêts, sans frais.",
    ctaLabel: 'Terminer la réservation',
    ctaUrl: 'https://emirates.com/fr/premium-economy',
  },
];

const AI_SUGGESTIONS = [
  { label: 'Translate from V1', value: 'Convert V1 (EN) body to EN-US conventions', action: 'translate' },
  { label: 'Improve CTA', value: '"Book now" → "Reserve your seat" (+12% est. CTR)', action: 'cta' },
  { label: 'Shorten body', value: 'Reduce body copy to 2 sentences for mobile', action: 'shorten' },
];

const MOCK_IMAGES = [
  { id: 'img-1', slot: 'HEADER', size: '810×270', isPrimary: true, url: null },
  { id: 'img-2', slot: 'STORY_1', size: '600×360', isPrimary: false, url: null },
  { id: 'img-3', slot: 'STORY_2', size: '600×360', isPrimary: false, url: null },
];

// ============================================================
// Styles (scoped)
// ============================================================

const styles = `
.cc2-root {
  min-height: 100vh;
  background: var(--bg-main);
  color: var(--text-main);
  font-family: 'Inter', system-ui, sans-serif;
}
@keyframes cc2-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.cc2-spin { animation: cc2-spin 0.9s linear infinite; }

.cc2-top {
  position: sticky; top: 0; z-index: 40;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-light);
  padding: 14px 28px;
  display: flex; align-items: center; justify-content: space-between;
}
.cc2-top-left { display: flex; align-items: center; gap: 14px; }
.cc2-top-title { font-weight: 700; font-size: 15px; }
.cc2-top-sub { color: var(--text-muted); font-size: 13px; margin-left: 4px; }
.cc2-back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid var(--border-light);
  color: var(--text-muted); font-size: 13px; font-weight: 500;
  padding: 6px 12px; border-radius: var(--radius-full); cursor: pointer;
  transition: .15s;
}
.cc2-back-btn:hover { background: var(--bg-card); color: var(--text-main); }

.cc2-stepper {
  display: flex; align-items: center; gap: 4px;
  background: var(--bg-card);
  padding: 4px; border-radius: var(--radius-full);
  border: 1px solid var(--border-light);
}
.cc2-step-btn {
  background: transparent; border: 0;
  font-size: 12px; font-weight: 500;
  padding: 7px 14px; border-radius: var(--radius-full);
  cursor: pointer; color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 6px;
  transition: .15s;
}
.cc2-step-btn:hover:not(.active) { color: var(--text-main); }
.cc2-step-btn.active {
  background: var(--primary); color: #fff;
  box-shadow: 0 4px 12px rgba(215, 26, 33, 0.25);
}
.cc2-step-btn.done { color: var(--accent-green); }

.cc2-top-right { display: flex; align-items: center; gap: 10px; }

.cc2-body {
  max-width: 1480px; margin: 0 auto;
  padding: 32px 28px 80px;
}

/* ====== Hero ====== */
.cc2-hero { margin-bottom: 28px; }
.cc2-hero h1 {
  font-size: 30px; font-weight: 800; letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.cc2-hero p { color: var(--text-muted); font-size: 14px; max-width: 680px; }
.cc2-hero-row {
  display: flex; gap: 10px; align-items: center; margin-top: 14px;
  flex-wrap: wrap;
}

/* ====== Buttons ====== */
.cc2-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: var(--radius-full);
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid transparent; transition: .15s;
}
.cc2-btn-primary { background: var(--primary); color: #fff; }
.cc2-btn-primary:hover { background: #b51418; }
.cc2-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cc2-btn-ghost {
  background: var(--bg-elevated); border-color: var(--border-light); color: var(--text-main);
}
.cc2-btn-ghost:hover { background: var(--bg-card); }
.cc2-btn-soft {
  background: var(--bg-card); border-color: transparent; color: var(--text-main);
}
.cc2-btn-soft:hover { background: var(--border-light); }
.cc2-btn-ai {
  background: linear-gradient(135deg, #a855f7, #6366f1);
  color: #fff;
  box-shadow: 0 6px 16px rgba(168, 85, 247, 0.3);
}
.cc2-btn-ai:hover { box-shadow: 0 8px 20px rgba(168, 85, 247, 0.45); }
.cc2-btn-sm { padding: 5px 12px; font-size: 11px; }

/* ====== AI Chip ====== */
.cc2-ai-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--theme-purple-soft);
  border: 1px solid rgba(168, 85, 247, 0.25);
  color: #7c3aed;
  padding: 3px 10px; border-radius: var(--radius-full);
  font-size: 11px; font-weight: 600;
}
.cc2-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: var(--radius-full);
  font-size: 11px; font-weight: 600;
  background: var(--bg-card); color: var(--text-muted);
  border: 1px solid var(--border-light);
}
.cc2-chip-primary { background: var(--primary-soft); color: var(--primary); border-color: rgba(215, 26, 33, 0.2); }
.cc2-chip-green { background: var(--theme-green-soft); color: var(--accent-green); border-color: rgba(16, 185, 129, 0.25); }
.cc2-chip-amber { background: var(--theme-amber-soft); color: var(--accent-yellow); border-color: rgba(212, 175, 55, 0.3); }
.cc2-chip-blue { background: rgba(99, 102, 241, 0.12); color: #6366f1; border-color: rgba(99, 102, 241, 0.25); }
.cc2-chip-purple { background: var(--theme-purple-soft); color: #7c3aed; border-color: rgba(168, 85, 247, 0.25); }

/* ====== Cards ====== */
.cc2-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 22px;
}
.cc2-card + .cc2-card { margin-top: 16px; }
.cc2-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.cc2-card .sub { color: var(--text-muted); font-size: 13px; margin-bottom: 16px; }

.cc2-section-title {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 10px;
  display: flex; align-items: center; justify-content: space-between;
}

/* ====== Fields ====== */
.cc2-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cc2-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.cc2-field { display: flex; flex-direction: column; gap: 6px; }
.cc2-field label {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
  display: flex; align-items: center; justify-content: space-between;
}
.cc2-input, .cc2-select {
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  padding: 9px 12px; border-radius: 10px;
  font-size: 13px; color: var(--text-main);
  width: 100%; font-family: inherit;
  transition: .15s;
}
.cc2-input:focus, .cc2-select:focus {
  outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.cc2-textarea {
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; color: var(--text-main);
  width: 100%; font-family: inherit; resize: vertical;
  min-height: 72px;
}

/* ====== Segment matrix ====== */
.cc2-matrix {
  display: grid;
  grid-template-columns: 130px repeat(4, 1fr);
  gap: 1px;
  background: var(--border-light);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
  font-size: 12px;
  margin-top: 8px;
}
.cc2-matrix .cell { background: var(--bg-elevated); padding: 10px 12px; }
.cc2-matrix .head {
  background: var(--bg-card);
  color: var(--text-muted);
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cc2-matrix .row-label {
  color: var(--text-main);
  font-weight: 600;
  display: flex; align-items: center;
}
.cc2-matrix .pick { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.cc2-mini {
  font-size: 10px; padding: 3px 9px; border-radius: 999px;
  background: var(--bg-card); color: var(--text-muted);
  border: 1px solid var(--border-light);
  cursor: pointer; user-select: none;
  transition: .12s;
}
.cc2-mini:hover { background: var(--border-light); }
.cc2-mini.on {
  background: var(--primary-soft); color: var(--primary);
  border-color: rgba(215, 26, 33, 0.25);
}
.cc2-mini.on-behavior {
  background: var(--theme-purple-soft); color: #7c3aed;
  border-color: rgba(168, 85, 247, 0.3);
}

/* ====== Segments preview list ====== */
.cc2-seg-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  padding: 11px 14px; border-radius: 10px;
  font-size: 13px; margin-bottom: 6px;
  transition: .15s;
}
.cc2-seg-row:hover { border-color: rgba(215, 26, 33, 0.25); background: var(--bg-card); }
.cc2-seg-row .idx {
  font-size: 10px; font-weight: 700; padding: 3px 8px;
  border-radius: 6px;
  background: var(--primary-soft); color: var(--primary);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.cc2-seg-row .facets { display: flex; gap: 5px; flex-wrap: wrap; }
.cc2-seg-row .code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--text-muted);
  margin-left: auto;
}
.cc2-seg-row .size-chip {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--text-muted);
  white-space: nowrap;
}

/* ====== Axis cards ====== */
.cc2-axis-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  margin-top: 10px;
}
.cc2-axis-card {
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  border-radius: 12px; padding: 14px;
}
.cc2-axis-card .ai-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 10px;
  background: var(--bg-card); color: var(--text-main);
  margin-bottom: 8px;
}
.cc2-axis-card.primary .ai-icon { background: var(--primary-soft); color: var(--primary); }
.cc2-axis-card.behavior .ai-icon { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
.cc2-axis-card.ai .ai-icon { background: var(--theme-purple-soft); color: #7c3aed; }
.cc2-axis-card h5 { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
.cc2-axis-card .axis-desc { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; }
.cc2-axis-card .opts { display: flex; flex-wrap: wrap; gap: 4px; }
.cc2-axis-card .opt {
  font-size: 10px; padding: 3px 8px; border-radius: 5px;
  background: var(--bg-card); color: var(--text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  cursor: pointer;
}
.cc2-axis-card .opt:hover { background: var(--border-light); color: var(--text-main); }
.cc2-axis-card.primary .opt { background: var(--primary-soft); color: var(--primary); }
.cc2-axis-card.behavior .opt { background: rgba(99, 102, 241, 0.08); color: #6366f1; }
.cc2-axis-card.ai .opt { background: var(--theme-purple-soft); color: #7c3aed; }

/* ====== Studio layout ====== */
.cc2-studio {
  display: grid;
  grid-template-columns: 280px 1fr 340px 300px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 1400px) {
  .cc2-studio { grid-template-columns: 260px 1fr 320px; }
  .cc2-studio .ai-panel { grid-column: 1 / -1; }
}
@media (max-width: 1100px) { .cc2-studio { grid-template-columns: 1fr; } }

.cc2-studio-col {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 14px; padding: 14px;
  max-height: calc(100vh - 180px);
  overflow: auto;
}
.cc2-studio-col.middle { padding: 18px; }

/* Variant list item */
.cc2-variant-item {
  padding: 10px 12px;
  border-radius: 10px; cursor: pointer;
  font-size: 12px;
  display: flex; flex-direction: column; gap: 4px;
  transition: .15s;
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.cc2-variant-item:hover { background: var(--bg-card); }
.cc2-variant-item.active {
  background: var(--primary-soft);
  border-color: rgba(215, 26, 33, 0.2);
}
.cc2-variant-item .vtitle { font-weight: 700; color: var(--text-main); font-size: 12px; }
.cc2-variant-item.active .vtitle { color: var(--primary); }
.cc2-variant-item .vmeta {
  font-size: 10px; color: var(--text-muted);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 4px;
}

/* Image gallery */
.cc2-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cc2-tile {
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #f4f4f5, #e5e7eb);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  position: relative; overflow: hidden;
  display: grid; place-items: center;
  color: var(--text-muted); font-size: 10px;
  cursor: pointer;
  transition: .15s;
}
.cc2-tile:hover { border-color: var(--primary); }
.cc2-tile.primary {
  border: 2px solid var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.cc2-tile.dashed { border-style: dashed; background: var(--bg-card); }
.cc2-tile .slot-label {
  position: absolute; top: 6px; left: 6px;
  font-size: 9px; font-weight: 700;
  background: rgba(0, 0, 0, 0.65); color: #fff;
  padding: 2px 6px; border-radius: 4px;
}
.cc2-tile .primary-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 9px; font-weight: 700;
  background: var(--primary); color: #fff;
  padding: 2px 6px; border-radius: 4px;
}

/* Form sections */
.cc2-form-section { margin-bottom: 18px; }
.cc2-form-section-title {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-bottom: 10px;
  display: flex; justify-content: space-between; align-items: center;
}

/* Preview */
.cc2-preview-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.cc2-device-toggle {
  display: flex; gap: 4px;
  background: var(--bg-card); padding: 3px;
  border-radius: var(--radius-full);
}
.cc2-device-toggle button {
  background: transparent; border: 0;
  padding: 5px 10px; font-size: 11px;
  border-radius: var(--radius-full); color: var(--text-muted);
  cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
}
.cc2-device-toggle button.on { background: var(--primary); color: #fff; }

.cc2-phone {
  background: #1a1a1a;
  border-radius: 26px;
  padding: 10px 6px;
  aspect-ratio: 9 / 18;
  max-height: 560px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  margin: 0 auto;
}
.cc2-phone::before {
  content: ''; position: absolute;
  top: 6px; left: 50%; transform: translateX(-50%);
  width: 70px; height: 5px;
  background: #333; border-radius: 3px;
}
.cc2-phone-screen {
  background: #fff; border-radius: 18px;
  height: 100%; margin-top: 6px;
  padding: 16px 12px; overflow: auto;
  color: #333; font-size: 11px;
}
.cc2-phone-meta { font-size: 9px; color: #888; margin-bottom: 8px; }
.cc2-phone-hero {
  height: 80px; border-radius: 6px; margin: 8px 0;
  background: linear-gradient(135deg, #d4a373, #b08968);
  display: grid; place-items: center;
  color: #fff; font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em;
}
.cc2-phone h4 {
  text-align: center; font-size: 15px; font-weight: 800;
  color: #111; margin: 6px 0 3px;
}
.cc2-phone .subhead {
  text-align: center; font-size: 9px; color: #888;
  letter-spacing: 0.1em;
}
.cc2-phone .body-txt {
  color: #555; line-height: 1.5; font-size: 10px;
}
.cc2-phone .btn-cta {
  background: #111; color: #fff;
  padding: 7px 12px; border-radius: 4px;
  text-align: center; font-size: 10px;
  margin: 10px 0;
}

/* AI panel */
.cc2-ai-panel {
  background: linear-gradient(180deg, rgba(168, 85, 247, 0.04), rgba(99, 102, 241, 0.02));
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 14px;
  padding: 14px;
  max-height: calc(100vh - 180px);
  overflow: auto;
}
.cc2-ai-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(168, 85, 247, 0.15);
}
.cc2-ai-spark {
  width: 26px; height: 26px; border-radius: 8px;
  background: linear-gradient(135deg, #a855f7, #6366f1);
  display: grid; place-items: center; color: #fff;
}
.cc2-ai-suggestion {
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  border-radius: 10px; padding: 10px 12px;
  margin-bottom: 8px; font-size: 12px;
  display: flex; align-items: center; gap: 10px;
}
.cc2-ai-suggestion .content { flex: 1; min-width: 0; }
.cc2-ai-suggestion .label {
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.cc2-ai-suggestion .value { color: var(--text-main); font-size: 11px; line-height: 1.4; }

.cc2-ai-chat-box {
  background: var(--bg-elevated); border: 1px solid var(--border-light);
  border-radius: 10px; padding: 4px 4px 4px 12px;
  display: flex; align-items: center; gap: 6px;
  font-size: 12px;
}
.cc2-ai-chat-box input {
  flex: 1; border: 0; background: transparent;
  font-size: 12px; color: var(--text-main); outline: none;
  padding: 8px 0;
  font-family: inherit;
}
.cc2-ai-chat-box input::placeholder { color: var(--text-muted); }
.cc2-ai-chat-box .send-btn {
  background: linear-gradient(135deg, #a855f7, #6366f1);
  color: #fff; border: 0; padding: 6px;
  border-radius: 8px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}

/* Autopilot banner */
.cc2-autopilot {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(99, 102, 241, 0.06));
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 14px; padding: 18px 20px;
  display: flex; gap: 14px; align-items: center;
  margin-bottom: 20px;
}
.cc2-autopilot-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, #a855f7, #6366f1);
  display: grid; place-items: center; color: #fff;
  flex-shrink: 0;
}
.cc2-autopilot .body { flex: 1; }
.cc2-autopilot h4 { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
.cc2-autopilot p { font-size: 12px; color: var(--text-muted); }
.cc2-autopilot input,
.cc2-autopilot-textarea {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; margin-top: 10px;
  color: var(--text-main);
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 72px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.cc2-autopilot input:focus,
.cc2-autopilot-textarea:focus {
  outline: none; border-color: #a855f7;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
}
.cc2-autopilot-hint {
  font-size: 10px; color: var(--text-muted);
  margin-top: 4px; font-style: italic;
}

/* KPIs */
.cc2-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px; }
.cc2-kpi {
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: 12px; padding: 14px;
}
.cc2-kpi .l { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.cc2-kpi .v { font-size: 22px; font-weight: 800; margin-top: 4px; color: var(--text-main); }
.cc2-kpi .s { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

/* Footer */
.cc2-footer {
  display: flex; justify-content: space-between;
  align-items: center; margin-top: 24px;
  padding-top: 20px; border-top: 1px solid var(--border-light);
}

/* ===== Studio v2 — cards + drawers ===== */
.cc2-variants-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.cc2-vcard {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: .15s;
  display: flex; flex-direction: column; gap: 6px;
  min-width: 0;
}
.cc2-vcard:hover { border-color: rgba(215, 26, 33, 0.3); background: var(--bg-card); }
.cc2-vcard.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft), 0 8px 20px rgba(215, 26, 33, 0.12);
  background: var(--bg-elevated);
}
.cc2-vcard-head {
  display: flex; justify-content: space-between; align-items: center; gap: 6px;
}
.cc2-vcard-idx {
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 5px;
  background: var(--primary-soft); color: var(--primary);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.cc2-vcard.active .cc2-vcard-idx { background: var(--primary); color: #fff; }
.cc2-vcard-facets { display: flex; flex-wrap: wrap; gap: 3px; }
.cc2-vcard-code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cc2-vcard-meta {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: var(--text-muted);
}

.cc2-studio2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
}
@media (max-width: 1100px) { .cc2-studio2 { grid-template-columns: 1fr; } }

/* Desktop preview mode: form on top in 2 columns, preview full-width below */
.cc2-studio2.desktop-mode {
  grid-template-columns: 1fr;
  gap: 16px;
}
.cc2-studio2.desktop-mode .form-col {
  /* Inner form sections become 2 columns when there's horizontal space */
  column-count: 2;
  column-gap: 20px;
  column-rule: 1px solid var(--border-light);
}
.cc2-studio2.desktop-mode .form-col > * {
  break-inside: avoid;
}
@media (max-width: 900px) {
  .cc2-studio2.desktop-mode .form-col { column-count: 1; }
}
.cc2-studio2.desktop-mode .preview-col {
  position: static;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.cc2-studio2 .form-col {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 22px;
}
.cc2-studio2 .preview-col {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 16px;
  position: sticky; top: 80px;
  height: fit-content;
}

/* FAB stack */
.cc2-fab-stack {
  position: fixed; right: 24px; bottom: 24px;
  display: flex; flex-direction: column; gap: 12px;
  z-index: 50;
}
.cc2-fab {
  width: 54px; height: 54px; border-radius: 50%;
  display: grid; place-items: center;
  cursor: pointer; border: 0;
  background: var(--bg-elevated); color: var(--text-main);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: .15s; position: relative;
}
.cc2-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18); }
.cc2-fab-ai {
  background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
  box-shadow: 0 6px 22px rgba(168, 85, 247, 0.4);
}
.cc2-fab-ai:hover { box-shadow: 0 10px 28px rgba(168, 85, 247, 0.5); }
.cc2-fab-badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--primary); color: #fff;
  border-radius: 999px; font-size: 10px; font-weight: 700;
  padding: 2px 6px; min-width: 18px; text-align: center;
  border: 2px solid var(--bg-elevated);
}
.cc2-fab-label {
  position: absolute; right: 64px; top: 50%; transform: translateY(-50%);
  background: var(--text-main); color: #fff;
  padding: 5px 10px; border-radius: 6px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
  opacity: 0; pointer-events: none;
  transition: .15s;
}
.cc2-fab:hover .cc2-fab-label { opacity: 1; }

/* Drawer */
.cc2-drawer-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 100;
  animation: cc2-fade-in 0.15s ease-out;
}
@keyframes cc2-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cc2-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
.cc2-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(480px, 100vw);
  background: var(--bg-elevated);
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.15);
  z-index: 101;
  display: flex; flex-direction: column;
  animation: cc2-slide-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.cc2-drawer-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}
.cc2-drawer-head h3 {
  font-size: 15px; font-weight: 700; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.cc2-drawer-close {
  background: transparent; border: 0; color: var(--text-muted);
  cursor: pointer; padding: 6px; border-radius: 8px;
  display: grid; place-items: center;
}
.cc2-drawer-close:hover { background: var(--bg-card); color: var(--text-main); }
.cc2-drawer-tabs {
  display: flex; gap: 2px;
  padding: 0 20px; border-bottom: 1px solid var(--border-light);
}
.cc2-drawer-tab {
  background: transparent; border: 0;
  padding: 12px 14px; font-size: 12px; font-weight: 600;
  color: var(--text-muted); cursor: pointer;
  border-bottom: 2px solid transparent;
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: -1px;
}
.cc2-drawer-tab:hover { color: var(--text-main); }
.cc2-drawer-tab.on {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.cc2-drawer-body { flex: 1; overflow: auto; padding: 20px; }

.cc2-drop-zone {
  border: 2px dashed var(--border-light);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  background: var(--bg-card);
  cursor: pointer; transition: .15s;
}
.cc2-drop-zone:hover { border-color: var(--primary); background: var(--primary-soft); }
.cc2-drop-zone h4 { font-size: 14px; font-weight: 700; margin: 10px 0 4px; }
.cc2-drop-zone p { font-size: 12px; color: var(--text-muted); }

.cc2-img-gallery {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-top: 16px;
}
.cc2-img-tile {
  aspect-ratio: 3 / 2;
  background: linear-gradient(135deg, #e5e7eb, #d1d5db);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  position: relative; overflow: hidden;
  display: grid; place-items: center;
  font-size: 10px; color: var(--text-muted);
  cursor: pointer;
}
.cc2-img-tile:hover { border-color: var(--primary); }
.cc2-img-tile .slot-tag {
  position: absolute; top: 6px; left: 6px;
  background: rgba(0, 0, 0, 0.6); color: #fff;
  font-size: 9px; font-weight: 700;
  padding: 2px 6px; border-radius: 4px;
}

.cc2-size-selector {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;
  margin: 10px 0;
}
.cc2-size-selector button {
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: 8px; padding: 8px; font-size: 11px;
  cursor: pointer; color: var(--text-main);
  font-family: inherit;
}
.cc2-size-selector button.on {
  background: var(--primary-soft); border-color: var(--primary); color: var(--primary); font-weight: 700;
}

.cc2-chat-messages {
  display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 16px;
}
.cc2-chat-msg {
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; line-height: 1.5;
  max-width: 85%;
}
.cc2-chat-msg.user {
  background: var(--primary-soft); color: var(--text-main);
  align-self: flex-end;
}
.cc2-chat-msg.ai {
  background: var(--bg-card); color: var(--text-main);
  align-self: flex-start;
  border: 1px solid var(--border-light);
}
.cc2-chat-empty {
  text-align: center; padding: 40px 20px;
  color: var(--text-muted);
}
.cc2-chat-empty .cc2-ai-spark {
  width: 48px; height: 48px; border-radius: 14px;
  margin: 0 auto 14px;
}
.cc2-chat-suggestions {
  display: flex; flex-direction: column; gap: 6px;
  margin-top: 16px;
}
.cc2-chat-sugg {
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: 8px; padding: 10px 12px;
  font-size: 12px; cursor: pointer; text-align: left;
  transition: .15s; color: var(--text-main); font-family: inherit;
  width: 100%;
}
.cc2-chat-sugg:hover { border-color: #a855f7; background: var(--theme-purple-soft); }

.cc2-chat-input-bar {
  padding: 14px 20px;
  border-top: 1px solid var(--border-light);
  display: flex; gap: 8px;
  background: var(--bg-elevated);
}
.cc2-chat-input-bar input {
  flex: 1;
  background: var(--bg-card); border: 1px solid var(--border-light);
  padding: 10px 14px; border-radius: var(--radius-full);
  font-size: 13px; color: var(--text-main); outline: none;
  font-family: inherit;
}
.cc2-chat-input-bar input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.12);
}
.cc2-chat-input-bar button {
  background: linear-gradient(135deg, #a855f7, #6366f1);
  color: #fff; border: 0;
  width: 40px; height: 40px; border-radius: 50%;
  cursor: pointer; display: grid; place-items: center;
}
`;

// ============================================================
// Shared bits
// ============================================================

const STATUS_CHIPS = {
  draft: { cls: 'cc2-chip-amber', label: 'Draft' },
  editing: { cls: 'cc2-chip-blue', label: 'Editing' },
  ready: { cls: 'cc2-chip-green', label: 'Ready' },
};

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

// ============================================================
// STEP 1 · Setup (campaign meta + segment matrix)
// ============================================================

const TIER_OPTIONS = ['Platinum', 'Gold', 'Silver', 'Blue', 'Non-member'];
const BEHAVIOR_OPTIONS = [
  'highly_engaged', 'dormant_90d', 'abandoned_cart', 'vip_whale', 'win_back',
  'new_subscriber', 'at_risk', 'price_sensitive', 'premium_seeker',
];

// Deterministic segment code — matches EDBS pattern CampaignName_Market_Lang_Tier[_Behavior][_AirportEK]
function buildSegmentCode({ name, market, language, tier, behavior, airport }) {
  const clean = s => String(s || '').trim().replace(/\s+/g, '_');
  const parts = [clean(name) || 'CAMPAIGN', clean(market) || 'GLOBAL', clean(language) || 'EN', clean(tier) || 'ALL'];
  if (behavior) parts.push(clean(behavior));
  if (airport) parts.push('EK' + clean(airport));
  return parts.join('_');
}

function Step1Setup({ state, setState, onNext }) {
  const [autopilotText, setAutopilotText] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState(null);
  const [refs, setRefs] = useState({ markets: [], languages: [], bau: [] });
  const [refsLoading, setRefsLoading] = useState(true);
  const [refsMode, setRefsMode] = useState(null);

  // Builder form state — single cascading form drives the whole variant list
  const [form, setForm] = useState({
    market: '',
    language: '',
    tier: '',
    behavior: '',
    airport: '',
  });

  // Cascading option lists: set when market changes
  const [marketLanguages, setMarketLanguages] = useState([]); // codes allowed for current market
  const [airports, setAirports] = useState([]); // airports for current market
  const [loadingCascade, setLoadingCascade] = useState(false);

  // Load reference data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefsLoading(true);
      try {
        const [mRes, lRes, bRes] = await Promise.all([
          fetch(`${API_URL}/campaign-brief/markets`, { credentials: 'include' }),
          fetch(`${API_URL}/campaign-brief/languages`, { credentials: 'include' }),
          fetch(`${API_URL}/campaign-brief/bau-campaigns`, { credentials: 'include' }),
        ]);
        const [m, l, b] = await Promise.all([mRes.json(), lRes.json(), bRes.json()]);
        if (cancelled) return;
        setRefs({ markets: m.items || [], languages: l.items || [], bau: b.items || [] });
        setRefsMode((m.fallback || l.fallback || b.fallback) ? 'fallback' : 'live');
      } catch (e) {
        if (!cancelled) setRefsMode('fallback');
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When market changes, fetch languages + airports for that market
  useEffect(() => {
    if (!form.market) {
      setMarketLanguages([]);
      setAirports([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCascade(true);
      try {
        const [langRes, apRes] = await Promise.all([
          fetch(`${API_URL}/campaign-brief/market-languages?market=${form.market}`, { credentials: 'include' }),
          fetch(`${API_URL}/campaign-brief/airports?market=${form.market}`, { credentials: 'include' }),
        ]);
        const [langData, apData] = await Promise.all([langRes.json(), apRes.json()]);
        if (cancelled) return;
        const allowedCodes = (langData.items || []).map(x => x.code);
        // Enrich with names from the full language list
        const enriched = allowedCodes.map(code => {
          const full = refs.languages.find(l => l.code === code);
          return { code, name: full?.name || code };
        });
        setMarketLanguages(enriched);
        setAirports(apData.items || []);
        // Reset dependent fields if the current selection is no longer valid
        setForm(f => ({
          ...f,
          language: allowedCodes.includes(f.language) ? f.language : '',
          airport: (apData.items || []).some(a => a.code === f.airport) ? f.airport : '',
        }));
      } finally {
        if (!cancelled) setLoadingCascade(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form.market, refs.languages]);

  const addVariant = () => {
    const { market, language, tier, behavior, airport } = form;
    if (!market || !language || !tier) return;
    const id = `v_${Date.now()}`;
    const code = buildSegmentCode({
      name: state.name || state.code,
      market, language, tier,
      behavior: behavior || null,
      airport: airport || null,
    });
    const newVariant = {
      id, code, market, language, tier,
      behaviors: behavior ? [behavior] : [],
      airport: airport || null,
      size: 1000 + Math.floor(Math.random() * 15000),
      source: 'manual',
    };
    setState(s => ({ ...s, manualVariants: [...(s.manualVariants || []), newVariant] }));
    // Clear only tier/behavior/airport — keep market/language so the user can add siblings fast
    setForm(f => ({ ...f, tier: '', behavior: '', airport: '' }));
  };

  const removeVariant = (id) => {
    setState(s => ({ ...s, manualVariants: (s.manualVariants || []).filter(v => v.id !== id) }));
  };

  const handleGenerate = async () => {
    if (!autopilotText.trim()) return;
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await fetch(`${API_URL}/campaign-brief/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: autopilotText,
          markets: refs.markets,
          languages: refs.languages,
          bauCampaigns: refs.bau,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'generation failed');
      const b = data.brief || {};

      // Auto-build variants from the AI's markets × languages × tiers
      const aiMarkets = Array.isArray(b.markets) && b.markets.length ? b.markets : [];
      const aiLangs = Array.isArray(b.languages) && b.languages.length ? b.languages : [];
      const aiTiers = Array.isArray(b.tiers) && b.tiers.length ? b.tiers : ['Gold'];
      const aiBehaviors = Array.isArray(b.behaviors) && b.behaviors.length ? b.behaviors : [null];
      const generated = [];
      for (const m of aiMarkets) for (const l of aiLangs) for (const t of aiTiers) for (const bh of aiBehaviors) {
        generated.push({
          id: `ai_${m}_${l}_${t}_${bh || 'all'}`.toLowerCase(),
          code: buildSegmentCode({ name: b.name || state.name, market: m, language: l, tier: t, behavior: bh, airport: null }),
          market: m, language: l, tier: t,
          behaviors: bh ? [bh] : [],
          airport: null,
          size: 5000 + Math.floor(Math.random() * 20000),
          source: 'ai',
        });
      }

      setState(s => ({
        ...s,
        code: b.code || s.code,
        name: b.name || s.name,
        template: b.template || s.template,
        businessArea: b.businessArea || s.businessArea,
        bauCampaign: b.bauCampaign || s.bauCampaign,
        deployAt: b.deployAt || s.deployAt,
        manualVariants: generated.length ? generated : s.manualVariants,
      }));
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenBusy(false);
    }
  };

  const canAdd = form.market && form.language && form.tier;
  const totalCount = (state.manualVariants || []).length;
  const previewCode = canAdd
    ? buildSegmentCode({
        name: state.name || state.code,
        market: form.market, language: form.language, tier: form.tier,
        behavior: form.behavior || null, airport: form.airport || null,
      })
    : null;

  return (
    <>
      {/* Autopilot */}
      <div className="cc2-autopilot">
        <div className="cc2-autopilot-icon"><Sparkles size={22} /></div>
        <div className="body">
          <h4>🚀 Autopilot · describe the campaign in one sentence</h4>
          <p>Claude reads your brief and fills Setup + segments. You review before continuing.</p>
          <textarea
            className="cc2-autopilot-textarea"
            rows={3}
            placeholder='e.g. "Premium Economy A350 from Montréal to Dubai, target Skywards Gold in FR/ENG, deploy Feb 28 at 5pm"'
            value={autopilotText}
            onChange={e => setAutopilotText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !genBusy) handleGenerate();
            }}
            disabled={genBusy}
          />
          <div className="cc2-autopilot-hint">⌘/Ctrl + Enter to generate · Enter for new line</div>
          {genError && (
            <div style={{color: '#ef4444', fontSize: 12, marginTop: 6}}>⚠ {genError}</div>
          )}
        </div>
        <button className="cc2-btn cc2-btn-ai" disabled={!autopilotText.trim() || genBusy} onClick={handleGenerate}>
          {genBusy ? <Loader2 size={14} className="cc2-spin" /> : <Wand2 size={14} />}
          {genBusy ? 'Generating…' : 'Generate brief'}
        </button>
      </div>

      {/* Campaign meta */}
      <div className="cc2-card">
        <h3 style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Campaign details</span>
          {refsMode === 'live' && <span className="cc2-chip cc2-chip-green">✓ MC live</span>}
          {refsMode === 'fallback' && <span className="cc2-chip cc2-chip-amber">Offline · using fallback</span>}
        </h3>
        <p className="sub">Auto-save on each change. BAU campaigns, markets & languages load from Marketing Cloud DEs.</p>

        <div className="cc2-grid-3">
          <div className="cc2-field">
            <label>Campaign code</label>
            <input className="cc2-input" value={state.code} onChange={e => setState(s => ({...s, code: e.target.value}))} />
          </div>
          <div className="cc2-field">
            <label>Campaign name <span className="cc2-ai-chip"><Sparkles size={10} /> Auto</span></label>
            <input className="cc2-input" value={state.name} onChange={e => setState(s => ({...s, name: e.target.value}))} />
          </div>
          <div className="cc2-field">
            <label>
              BAU campaign type {refsLoading && <Loader2 size={10} className="cc2-spin" style={{marginLeft: 4}} />}
              {(() => {
                const sel = refs.bau.find(b => b.name === state.bauCampaign);
                if (!sel) return null;
                return sel.hasSfmcTemplate
                  ? <span className="cc2-chip cc2-chip-green" style={{fontSize: 9, padding: '1px 6px'}}>SFMC ready</span>
                  : <span className="cc2-chip cc2-chip-amber" style={{fontSize: 9, padding: '1px 6px'}}>catalog only</span>;
              })()}
            </label>
            <select
              className="cc2-select"
              value={state.bauCampaign || ''}
              onChange={e => {
                const selected = refs.bau.find(b => b.name === e.target.value);
                setState(s => ({
                  ...s,
                  bauCampaign: e.target.value,
                  template: selected?.name || s.template,
                  businessArea: selected?.businessArea || s.businessArea,
                }));
              }}
            >
              <option value="">— Select BAU type —</option>
              {(() => {
                // Group by category
                const groups = {};
                for (const b of refs.bau) {
                  const cat = b.category || 'other';
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(b);
                }
                const order = ['broadcast', 'offers', 'partner', 'route', 'lifecycle', 'engagement', 'other'];
                return order.filter(k => groups[k]).map(cat => (
                  <optgroup key={cat} label={cat.toUpperCase()}>
                    {groups[cat].map(b => (
                      <option key={b.id} value={b.name}>
                        {b.name}{b.perf ? ` — OR ${b.perf.openRate}%` : ''}
                      </option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>
        </div>

        <div className="cc2-grid-3" style={{marginTop: 12}}>
          <div className="cc2-field">
            <label>Deployment date</label>
            <input type="datetime-local" className="cc2-input" value={state.deployAt} onChange={e => setState(s => ({...s, deployAt: e.target.value}))} />
          </div>
          <div className="cc2-field">
            <label>Business area</label>
            <select className="cc2-select" value={state.businessArea} onChange={e => setState(s => ({...s, businessArea: e.target.value}))}>
              <option>E-commerce</option>
              <option>Skywards</option>
              <option>Emirates Holidays</option>
              <option>Dubai Experience</option>
            </select>
          </div>
          <div className="cc2-field">
            <label>Owner</label>
            <input className="cc2-input" placeholder="owner@emirates.com" value={state.owner} onChange={e => setState(s => ({...s, owner: e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Variant builder — single cascading form, no matrix */}
      <div className="cc2-card">
        <h3 style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Add segment variant</span>
          <span className="cc2-ai-chip"><Sparkles size={10} /> Behavioral & airport axes available</span>
        </h3>
        <p className="sub">Pick a market first — languages and airports are filtered to that market. Each variant gets its own SegmentCode and editor tab.</p>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end'}}>
          <div className="cc2-field">
            <label>Market{refsLoading && <Loader2 size={10} className="cc2-spin" style={{marginLeft: 4}} />}</label>
            <select className="cc2-select" value={form.market} onChange={e => setForm(f => ({...f, market: e.target.value}))}>
              <option value="">—</option>
              {refs.markets.map(m => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
            </select>
          </div>
          <div className="cc2-field">
            <label>
              Language
              {loadingCascade && <Loader2 size={10} className="cc2-spin" style={{marginLeft: 4}} />}
              {form.market && !loadingCascade && <span className="cc2-chip cc2-chip-blue" style={{fontSize: 9, padding: '1px 6px'}}>{marketLanguages.length}</span>}
            </label>
            <select className="cc2-select" value={form.language} onChange={e => setForm(f => ({...f, language: e.target.value}))} disabled={!form.market || loadingCascade}>
              <option value="">{!form.market ? 'Pick market first' : '—'}</option>
              {marketLanguages.map(l => <option key={l.code} value={l.code}>{l.code} · {l.name}</option>)}
            </select>
          </div>
          <div className="cc2-field">
            <label>Tier</label>
            <select className="cc2-select" value={form.tier} onChange={e => setForm(f => ({...f, tier: e.target.value}))}>
              <option value="">—</option>
              {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="cc2-field">
            <label>
              Fav. airport
              {form.market && !loadingCascade && <span className="cc2-chip cc2-chip-blue" style={{fontSize: 9, padding: '1px 6px'}}>{airports.length}</span>}
            </label>
            <select className="cc2-select" value={form.airport} onChange={e => setForm(f => ({...f, airport: e.target.value}))} disabled={!form.market || loadingCascade}>
              <option value="">— any —</option>
              {airports.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          <div className="cc2-field">
            <label>Behavior</label>
            <select className="cc2-select" value={form.behavior} onChange={e => setForm(f => ({...f, behavior: e.target.value}))}>
              <option value="">— none —</option>
              {BEHAVIOR_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button className="cc2-btn cc2-btn-primary" onClick={addVariant} disabled={!canAdd} style={{height: 36}}>
            <Plus size={13} /> Add
          </button>
        </div>

        {previewCode && (
          <div style={{marginTop: 14, padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700}}>Preview code:</span>
            <span style={{fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'var(--primary)', fontWeight: 600}}>{previewCode}</span>
          </div>
        )}
      </div>

      {/* Variant list */}
      <div className="cc2-card">
        <h3 style={{display: 'flex', justifyContent: 'space-between'}}>
          <span>Variants ({totalCount})</span>
          {totalCount > 0 && <span className="cc2-ai-chip"><Sparkles size={10} /> Ready for Content Studio</span>}
        </h3>

        {totalCount === 0 && (
          <div style={{padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13}}>
            Add at least one variant above — or use Autopilot to let AI build them for you.
          </div>
        )}

        {(state.manualVariants || []).map((v, i) => (
          <div className="cc2-seg-row" key={v.id}>
            <span className="idx">V{i + 1}</span>
            <div className="facets">
              <span className="cc2-chip cc2-chip-primary">{v.market}</span>
              <span className="cc2-chip cc2-chip-primary">{v.language}</span>
              <span className="cc2-chip cc2-chip-amber">{v.tier}</span>
              {v.airport && <span className="cc2-chip cc2-chip-blue">✈ {v.airport}</span>}
              {v.behaviors.map(b => <span key={b} className="cc2-chip cc2-chip-purple">{b}</span>)}
              {v.source === 'ai' && <span className="cc2-ai-chip" style={{fontSize: 9, padding: '1px 6px'}}>AI</span>}
            </div>
            <span className="code">{v.code}</span>
            <span className="cc2-chip cc2-chip-green size-chip">{fmtNum(v.size)}</span>
            <button className="cc2-btn cc2-btn-soft cc2-btn-sm" title="Remove" onClick={() => removeVariant(v.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="cc2-footer">
        <button className="cc2-btn cc2-btn-ghost">Cancel</button>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Auto-saved · 2s ago</span>
          <button className="cc2-btn cc2-btn-primary" onClick={onNext} disabled={totalCount === 0}>
            Next · Content Studio <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// STEP 2 · Content Studio (images + variants + editor + preview + AI)
// ============================================================

// Seed content defaults for a newly-edited variant. Content = envelope + ordered blocks.
// Each variant now carries a real Emirates-style block composition (header, hero, body,
// offer, footer) that renders via AMPscript interpolation server-side.
function seedContentForVariant(v) {
  const angleMap = {
    highly_engaged: 'Premium regulars — reward loyalty, hint at upgrade',
    dormant_90d: 'Win-back — remind them why they loved us',
    abandoned_cart: 'Nudge with concrete savings + 0% APR emphasis',
    vip_whale: 'White-glove concierge tone · exclusive access',
    win_back: 'Emotional reconnect · no hard sell',
    new_subscriber: 'First-time flyers — reduce friction, build trust',
    at_risk: 'Re-engage before unsubscribe — curiosity-driven',
    price_sensitive: 'Lead with savings · flex payment options',
    premium_seeker: 'Aspirational cabin imagery · experience-led copy',
  };
  const behav = v.behaviors?.[0];
  const angle = (behav && angleMap[behav]) || 'Market-tailored messaging';

  // Default Emirates email composition — user can reorder, add, remove blocks
  const blocks = [
    { id: `b_${Date.now()}_1`, blockId: 'ebase_header', vars: {} },
    { id: `b_${Date.now()}_2`, blockId: 'global_header_title_v2', vars: { main_subheader: 'TRAVEL INSPIRATION' } },
    { id: `b_${Date.now()}_3`, blockId: 'global_body_copy_cta_red', vars: { body_cta: 'Book now' } },
    { id: `b_${Date.now()}_4`, blockId: 'global_offer_block', vars: { offer_block_cta_text: 'Discover' } },
    { id: `b_${Date.now()}_5`, blockId: 'global_footer', vars: {} },
  ];

  return {
    status: v.status || 'draft',
    angle,
    // Envelope (subject + preheader) stays out of blocks — it's MC-level metadata
    subject: '',
    preheader: '',
    blocks,
  };
}

function Step2Studio({ state, setState, onBack, onNext }) {
  // Ensure every variant carries a content object — merge from state once on mount
  useEffect(() => {
    setState(s => {
      const vs = s.manualVariants || [];
      let changed = false;
      const enriched = vs.map(v => {
        if (v.content) return v;
        changed = true;
        return { ...v, content: seedContentForVariant(v, s.name) };
      });
      if (!changed) return s;
      return { ...s, manualVariants: enriched };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variants = state.manualVariants || [];
  const [activeVariantId, setActiveVariantId] = useState(variants[0]?.id || null);
  const [device, setDevice] = useState('mobile');
  const [aiMessage, setAiMessage] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Keep activeVariantId in sync if the list shrinks
  useEffect(() => {
    if (variants.length && !variants.find(v => v.id === activeVariantId)) {
      setActiveVariantId(variants[0].id);
    }
  }, [variants, activeVariantId]);

  const activeVariant = variants.find(v => v.id === activeVariantId) || variants[0];
  const content = activeVariant?.content || {};

  // Update a single content field on the active variant
  const patchContent = (patch) => {
    setState(s => ({
      ...s,
      manualVariants: (s.manualVariants || []).map(v =>
        v.id === activeVariantId
          ? { ...v, content: { ...(v.content || {}), ...patch } }
          : v
      ),
    }));
  };

  // Counts for footer chips
  const statusCounts = variants.reduce((acc, v) => {
    const st = v.content?.status || 'draft';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  // Empty state if Step 1 added no variants
  if (!variants.length) {
    return (
      <div className="cc2-card" style={{textAlign: 'center', padding: 50}}>
        <h3>No variants yet</h3>
        <p className="sub">Go back to Setup and add at least one segment variant before editing content.</p>
        <button className="cc2-btn cc2-btn-primary" onClick={onBack} style={{marginTop: 16}}>
          <ArrowLeft size={14} /> Back to Setup
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header with variant info + actions */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14, flexWrap: 'wrap'}}>
        <div style={{minWidth: 0, flex: 1}}>
          <h1 style={{fontSize: 20, fontWeight: 800, marginBottom: 4}}>
            Editing <span style={{color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 16}}>{activeVariant.code}</span>
          </h1>
          <p style={{color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
            <span>{fmtNum(activeVariant.size)} contacts</span>
            <span>·</span>
            <span style={{fontStyle: 'italic'}}>{content.angle}</span>
          </p>
        </div>
        <div style={{display: 'flex', gap: 6}}>
          <button className="cc2-btn cc2-btn-soft"><ShieldCheck size={14} /> Send to QA</button>
          <button className="cc2-btn cc2-btn-ghost">Save & close</button>
        </div>
      </div>

      {/* Variants strip (cards at the top) */}
      <div className="cc2-variants-strip">
        {variants.map((v, i) => {
          const st = v.content?.status || 'draft';
          const status = STATUS_CHIPS[st] || STATUS_CHIPS.draft;
          return (
            <div
              key={v.id}
              className={`cc2-vcard ${v.id === activeVariantId ? 'active' : ''}`}
              onClick={() => setActiveVariantId(v.id)}
            >
              <div className="cc2-vcard-head">
                <span className="cc2-vcard-idx">V{i + 1}</span>
                <span className={`cc2-chip ${status.cls}`} style={{fontSize: 9, padding: '1px 7px'}}>{status.label}</span>
              </div>
              <div className="cc2-vcard-facets">
                <span className="cc2-chip cc2-chip-primary" style={{fontSize: 9, padding: '1px 6px'}}>{v.market}</span>
                <span className="cc2-chip cc2-chip-primary" style={{fontSize: 9, padding: '1px 6px'}}>{v.language}</span>
                <span className="cc2-chip cc2-chip-amber" style={{fontSize: 9, padding: '1px 6px'}}>{v.tier}</span>
                {v.airport && <span className="cc2-chip cc2-chip-blue" style={{fontSize: 9, padding: '1px 6px'}}>✈ {v.airport}</span>}
                {v.behaviors?.map(b => <span key={b} className="cc2-chip cc2-chip-purple" style={{fontSize: 9, padding: '1px 6px'}}>{b}</span>)}
              </div>
              <div className="cc2-vcard-code" title={v.code}>{v.code}</div>
              <div className="cc2-vcard-meta">
                <span>{fmtNum(v.size)} contacts</span>
              </div>
            </div>
          );
        })}
        <button
          className="cc2-vcard"
          onClick={onBack}
          style={{
            border: '1px dashed var(--border-light)',
            background: 'var(--bg-card)',
            color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 96, cursor: 'pointer',
            gap: 6, fontSize: 12, fontFamily: 'inherit',
          }}
        >
          <Plus size={14} /> Add variant
        </button>
      </div>

      {/* Main layout: block editor + preview */}
      <div className={`cc2-studio2 ${device === 'desktop' ? 'desktop-mode' : ''}`}>
        {/* Block editor */}
        <div className="form-col" key={activeVariantId}>
          <EnvelopeSection
            variant={activeVariant}
            content={content}
            patchContent={patchContent}
          />

          {/* Brand check — always visible, compact */}
          <BrandCheckPanel variant={activeVariant} content={content} />

          {/* AI draft banner — shown when the variant's content is basically empty */}
          {(!content.subject && !content.blocks?.some(b => Object.keys(b.vars || {}).length > 0)) && (
            <AiDraftsBanner
              variant={activeVariant}
              campaign={{ name: state.name, bauCampaign: state.bauCampaign, template: state.template, businessArea: state.businessArea }}
              onApply={(draft) => {
                patchContent({
                  subject: draft.subject || '',
                  preheader: draft.preheader || '',
                  blocks: draft.blocks || [],
                });
              }}
            />
          )}

          <BlockEditor
            blocks={content.blocks || []}
            onChange={next => patchContent({ blocks: next })}
            variant={activeVariant}
            campaign={{ name: state.name, bauCampaign: state.bauCampaign, template: state.template, businessArea: state.businessArea }}
            onApplyFill={({ subject, preheader }) => patchContent({ subject, preheader })}
          />

          <div style={{display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-light)'}}>
            <button
              className="cc2-btn cc2-btn-soft"
              onClick={() => patchContent({ status: 'draft' })}
            >Mark draft</button>
            <button
              className="cc2-btn cc2-btn-primary"
              onClick={() => patchContent({ status: 'ready' })}
            >
              <CheckCircle2 size={13} /> Mark ready
            </button>
          </div>
        </div>

        {/* Preview col — real Emirates HTML via server-side render */}
        <div className="preview-col">
          <div className="cc2-preview-head">
            <span className="cc2-section-title" style={{margin: 0}}>Live preview</span>
            <div className="cc2-device-toggle">
              <button className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')}><Smartphone size={10} /> Mobile</button>
              <button className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')}><Monitor size={10} /> Desktop</button>
            </div>
          </div>

          <EmailPreview
            blocks={content.blocks || []}
            subject={content.subject}
            preheader={content.preheader}
            device={device}
          />
          <div style={{fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8}}>
            Renders real Emirates blocks · updates on change
          </div>
        </div>
      </div>

      <div className="cc2-footer">
        <button className="cc2-btn cc2-btn-ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Back · Setup
        </button>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          {statusCounts.draft > 0 && <span className="cc2-chip cc2-chip-amber">{statusCounts.draft} draft</span>}
          {statusCounts.editing > 0 && <span className="cc2-chip cc2-chip-blue">{statusCounts.editing} editing</span>}
          {statusCounts.ready > 0 && <span className="cc2-chip cc2-chip-green">{statusCounts.ready} ready</span>}
          <button className="cc2-btn cc2-btn-primary" onClick={onNext}>
            Next · Review <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Floating action buttons for Library + AI */}
      <div className="cc2-fab-stack">
        <button className="cc2-fab" onClick={() => setLibraryOpen(true)} title="Image library">
          <span className="cc2-fab-label">Image library</span>
          <ImageIcon size={22} />
          <span className="cc2-fab-badge">{MOCK_IMAGES.length}</span>
        </button>
        <button className="cc2-fab cc2-fab-ai" onClick={() => setAiOpen(true)} title="AI co-pilot">
          <span className="cc2-fab-label">AI co-pilot</span>
          <Sparkles size={22} />
        </button>
      </div>

      {/* Image library drawer */}
      {libraryOpen && (
        <ImageLibraryDrawer onClose={() => setLibraryOpen(false)} activeVariant={activeVariant} />
      )}

      {/* AI drawer */}
      {aiOpen && (
        <AiCopilotDrawer
          onClose={() => setAiOpen(false)}
          activeVariant={activeVariant}
          content={content}
          patchContent={patchContent}
          aiMessage={aiMessage}
          setAiMessage={setAiMessage}
        />
      )}
    </>
  );
}

// ============================================================
// Image library drawer — tabs: Upload · Pool · Generate
// ============================================================
function ImageLibraryDrawer({ onClose, activeVariant }) {
  const [tab, setTab] = useState('upload');
  const [aiSize, setAiSize] = useState('810x270');
  const [aiPrompt, setAiPrompt] = useState('');
  const [searchQ, setSearchQ] = useState('');

  // MC pool state
  const [mcImages, setMcImages] = useState([]);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState(null);

  const loadMcImages = async (q = '') => {
    setMcLoading(true); setMcError(null);
    try {
      const url = `${API_URL}/email-blocks/mc-images?pageSize=24${q ? `&q=${encodeURIComponent(q)}` : ''}`;
      const r = await fetch(url, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'failed');
      setMcImages(d.items || []);
    } catch (e) { setMcError(e.message); setMcImages([]); }
    finally { setMcLoading(false); }
  };

  useEffect(() => {
    if (tab === 'pool' && mcImages.length === 0 && !mcError) loadMcImages();
    // eslint-disable-next-line
  }, [tab]);

  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div className="cc2-drawer" role="dialog" aria-label="Image library">
        <div className="cc2-drawer-head">
          <h3><ImageIcon size={16} /> Image library</h3>
          <button className="cc2-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="cc2-drawer-tabs">
          <button className={`cc2-drawer-tab ${tab === 'upload' ? 'on' : ''}`} onClick={() => setTab('upload')}>
            <Upload size={13} /> Upload
          </button>
          <button className={`cc2-drawer-tab ${tab === 'pool' ? 'on' : ''}`} onClick={() => setTab('pool')}>
            <Cloud size={13} /> MC pool
          </button>
          <button className={`cc2-drawer-tab ${tab === 'ai' ? 'on' : ''}`} onClick={() => setTab('ai')}>
            <Sparkles size={13} /> AI generate
          </button>
        </div>

        <div className="cc2-drawer-body">
          {tab === 'upload' && (
            <>
              <div className="cc2-drop-zone">
                <ImagePlus size={32} style={{color: 'var(--text-muted)'}} />
                <h4>Drop images here</h4>
                <p>or click to browse · JPG, PNG, WebP up to 3MB</p>
                <button className="cc2-btn cc2-btn-primary cc2-btn-sm" style={{marginTop: 14}}>
                  Select files
                </button>
              </div>

              <div style={{marginTop: 20}}>
                <div className="cc2-section-title" style={{marginBottom: 8}}>
                  <span>Uploaded ({MOCK_IMAGES.length})</span>
                </div>
                <div className="cc2-img-gallery">
                  {MOCK_IMAGES.map(img => (
                    <div key={img.id} className="cc2-img-tile">
                      <span className="slot-tag">{img.slot}</span>
                      {img.size}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'pool' && (
            <>
              <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14}}>
                <div style={{flex: 1, position: 'relative'}}>
                  <Search size={13} style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
                  <input
                    className="cc2-input"
                    style={{paddingLeft: 30}}
                    placeholder='Search MC assets (e.g. "premium economy")'
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') loadMcImages(searchQ); }}
                  />
                </div>
                <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={() => loadMcImages(searchQ)} disabled={mcLoading}>
                  {mcLoading ? <Loader2 size={11} className="cc2-spin" /> : <Search size={11} />}
                </button>
              </div>
              <p style={{fontSize: 11, color: 'var(--text-muted)', marginBottom: 10}}>
                Reuse assets already in Marketing Cloud Content Builder. Click an image to copy its URL.
              </p>
              {mcError && <div style={{color: '#ef4444', fontSize: 11, padding: 10}}>⚠ {mcError}</div>}
              {mcLoading && mcImages.length === 0 && (
                <div style={{textAlign: 'center', padding: 40, color: 'var(--text-muted)'}}>
                  <Loader2 size={22} className="cc2-spin" /><div style={{marginTop: 8, fontSize: 12}}>Loading MC assets…</div>
                </div>
              )}
              {!mcLoading && mcImages.length === 0 && !mcError && (
                <div style={{textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12}}>
                  No images found. Try a different search.
                </div>
              )}
              <div className="cc2-img-gallery">
                {mcImages.map(img => (
                  <div
                    key={img.id}
                    className="cc2-img-tile"
                    style={{
                      aspectRatio: '3 / 2',
                      background: img.thumbnail || img.url
                        ? `url(${img.thumbnail || img.url}) center/cover no-repeat, linear-gradient(135deg, #e5e7eb, #d1d5db)`
                        : 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                    }}
                    title={`${img.name}\n${img.width && img.height ? `${img.width}×${img.height}` : ''}\n${img.url || ''}`}
                    onClick={() => {
                      if (img.url) {
                        navigator.clipboard?.writeText(img.url);
                      }
                    }}
                  >
                    {!img.thumbnail && !img.url && (
                      <span style={{fontSize: 10, padding: 6, textAlign: 'center'}}>{img.name}</span>
                    )}
                    {(img.thumbnail || img.url) && (
                      <span style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent)',
                        color: '#fff', fontSize: 9, padding: '12px 6px 4px', textAlign: 'center',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{img.name}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'ai' && (
            <>
              <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 12}}>
                Describe the image. AI uses variant context: <b style={{color: 'var(--text-main)'}}>{activeVariant.market} · {activeVariant.tier}</b>.
              </p>

              <div className="cc2-field" style={{marginBottom: 12}}>
                <label>Size</label>
                <div className="cc2-size-selector">
                  <button className={aiSize === '810x270' ? 'on' : ''} onClick={() => setAiSize('810x270')}>
                    Header<br/><span style={{fontSize: 9, opacity: 0.7}}>810×270</span>
                  </button>
                  <button className={aiSize === '600x360' ? 'on' : ''} onClick={() => setAiSize('600x360')}>
                    Story<br/><span style={{fontSize: 9, opacity: 0.7}}>600×360</span>
                  </button>
                  <button className={aiSize === '600x600' ? 'on' : ''} onClick={() => setAiSize('600x600')}>
                    Square<br/><span style={{fontSize: 9, opacity: 0.7}}>600×600</span>
                  </button>
                </div>
              </div>

              <div className="cc2-field">
                <label>Prompt</label>
                <textarea
                  className="cc2-textarea"
                  rows={3}
                  placeholder="e.g. Emirates Premium Economy cabin, morning light through windows, passenger reading a book"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
              </div>

              <button className="cc2-btn cc2-btn-ai" style={{width: '100%', justifyContent: 'center', marginTop: 14, padding: 12}} disabled={!aiPrompt.trim()}>
                <Wand2 size={14} /> Generate image
              </button>

              <div style={{marginTop: 20, padding: 12, background: 'var(--theme-purple-soft)', borderRadius: 8, fontSize: 11, color: '#7c3aed'}}>
                <b>Pro tip:</b> AI matches variant tone. Gold tier gets luxe, aspirational imagery; price-sensitive segments get warm, approachable shots.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// AI Co-pilot drawer — chat style
// ============================================================
function AiCopilotDrawer({ onClose, activeVariant, content, patchContent, aiMessage, setAiMessage }) {
  const [messages, setMessages] = useState([]);

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setAiMessage('');
    // placeholder AI echo
    setTimeout(() => {
      setMessages(m => [...m, {
        role: 'ai',
        text: `I can help with that. Based on variant ${activeVariant.code}, here's what I'd suggest… (AI wiring pending)`,
      }]);
    }, 400);
  };

  const quickSuggestions = [
    'Write a subject line for this variant',
    'Translate the body to the variant language',
    'Make the CTA more urgent (+12% est. CTR)',
    'Check brand compliance',
    'Shorten body to 2 sentences',
  ];

  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div className="cc2-drawer" role="dialog" aria-label="AI co-pilot">
        <div className="cc2-drawer-head">
          <h3>
            <div className="cc2-ai-spark" style={{width: 26, height: 26, borderRadius: 8}}><Sparkles size={14} /></div>
            AI Co-pilot
          </h3>
          <button className="cc2-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{padding: '10px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)'}}>
          Context: <span style={{fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-main)'}}>{activeVariant.code}</span>
        </div>

        <div className="cc2-drawer-body">
          {messages.length === 0 ? (
            <div className="cc2-chat-empty">
              <div className="cc2-ai-spark"><Sparkles size={24} /></div>
              <h4 style={{fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px'}}>How can I help?</h4>
              <p style={{fontSize: 12}}>Ask anything about this variant — I see the market, tier, behavior and content you've written so far.</p>

              <div className="cc2-chat-suggestions">
                {quickSuggestions.map((s, i) => (
                  <button key={i} className="cc2-chat-sugg" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="cc2-chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`cc2-chat-msg ${m.role}`}>{m.text}</div>
              ))}
            </div>
          )}
        </div>

        <div className="cc2-chat-input-bar">
          <input
            placeholder='Ask the co-pilot…'
            value={aiMessage}
            onChange={e => setAiMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(aiMessage); }}
          />
          <button onClick={() => send(aiMessage)} disabled={!aiMessage.trim()}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// STEP 3 · Review
// ============================================================

function Step3Review({ state, onBack }) {
  const variants = state.manualVariants || [];
  const totalAudience = variants.reduce((a, v) => a + (v.size || 0), 0);
  const readyCount = variants.filter(v => (v.content?.status || 'draft') === 'ready').length;
  const draftCount = variants.length - readyCount;

  return (
    <>
      <div className="cc2-card">
        <h3>Brief summary</h3>
        <p className="sub">Review all variants before submission. Brand compliance check. Mock analytics for demo.</p>

        <div className="cc2-grid-3">
          <div className="cc2-field">
            <label>Campaign</label>
            <div className="cc2-input">{state.code || '—'}</div>
          </div>
          <div className="cc2-field">
            <label>Name</label>
            <div className="cc2-input">{state.name || '—'}</div>
          </div>
          <div className="cc2-field">
            <label>BAU type</label>
            <div className="cc2-input">{state.bauCampaign || state.template || '—'}</div>
          </div>
        </div>
        <div className="cc2-grid-3" style={{marginTop: 12}}>
          <div className="cc2-field">
            <label>Business area</label>
            <div className="cc2-input">{state.businessArea || '—'}</div>
          </div>
          <div className="cc2-field">
            <label>Deployment</label>
            <div className="cc2-input">{state.deployAt || '—'}</div>
          </div>
          <div className="cc2-field">
            <label>Owner</label>
            <div className="cc2-input">{state.owner || '—'}</div>
          </div>
        </div>
      </div>

      <div className="cc2-card">
        <h3 style={{display: 'flex', justifyContent: 'space-between'}}>
          <span>Variants ({variants.length})</span>
          <span style={{display: 'flex', gap: 6}}>
            {readyCount > 0 && <span className="cc2-chip cc2-chip-green"><CheckCircle2 size={11} /> {readyCount} ready</span>}
            {draftCount > 0 && <span className="cc2-chip cc2-chip-amber">{draftCount} draft</span>}
          </span>
        </h3>
        {variants.length === 0 && (
          <div style={{padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13}}>
            No variants yet. Go back to Setup to add some.
          </div>
        )}
        {variants.map((v, i) => {
          const st = v.content?.status || 'draft';
          const status = STATUS_CHIPS[st] || STATUS_CHIPS.draft;
          return (
            <div className="cc2-seg-row" key={v.id}>
              <span className="idx">V{i + 1}</span>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontWeight: 700, fontSize: 12, marginBottom: 2, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all'}}>{v.code}</div>
                <div style={{fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                  <span className="cc2-chip cc2-chip-primary" style={{fontSize: 9, padding: '1px 6px'}}>{v.market}</span>
                  <span className="cc2-chip cc2-chip-primary" style={{fontSize: 9, padding: '1px 6px'}}>{v.language}</span>
                  <span className="cc2-chip cc2-chip-amber" style={{fontSize: 9, padding: '1px 6px'}}>{v.tier}</span>
                  {v.airport && <span className="cc2-chip cc2-chip-blue" style={{fontSize: 9, padding: '1px 6px'}}>✈ {v.airport}</span>}
                  {v.behaviors?.map(b => <span key={b} className="cc2-chip cc2-chip-purple" style={{fontSize: 9, padding: '1px 6px'}}>{b}</span>)}
                </div>
                {v.content?.subject && (
                  <div style={{fontSize: 11, color: 'var(--text-main)', marginTop: 4, fontStyle: 'italic'}}>
                    "{v.content.subject}"
                  </div>
                )}
              </div>
              <span className="cc2-chip cc2-chip-green size-chip">{fmtNum(v.size)}</span>
              <span className={`cc2-chip ${status.cls}`}>{status.label}</span>
            </div>
          );
        })}
      </div>

      {/* AI audit */}
      <div className="cc2-card" style={{background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04), transparent)', borderColor: 'rgba(168, 85, 247, 0.25)'}}>
        <h3 style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'grid', placeItems: 'center', color: '#fff'}}><Sparkles size={14} /></div>
          AI audit
        </h3>
        <p className="sub">Brand compliance, broken links, UTM check, predicted performance.</p>

        <div style={{display: 'grid', gap: 10}}>
          <div className="cc2-ai-suggestion" style={{background: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.3)'}}>
            <CheckCircle2 size={16} color="var(--accent-green)" />
            <div className="content">
              <div className="label" style={{color: 'var(--accent-green)'}}>Brand compliance</div>
              <div className="value">Tone, disclaimers & legal OK across all 3 variants</div>
            </div>
          </div>
          <div className="cc2-ai-suggestion" style={{background: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.3)'}}>
            <CheckCircle2 size={16} color="var(--accent-green)" />
            <div className="content">
              <div className="label" style={{color: 'var(--accent-green)'}}>Links & UTMs</div>
              <div className="value">9/9 links valid · 9/9 have UTM parameters</div>
            </div>
          </div>
          <div className="cc2-ai-suggestion">
            <TrendingUp size={16} color="#7c3aed" />
            <div className="content">
              <div className="label">Predicted performance</div>
              <div className="value">
                Open rate <b>32–36%</b> · CTR <b>4.2–5.1%</b> · <span style={{color: 'var(--accent-green)'}}>+28% vs single-blast baseline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mock metrics */}
      <div className="cc2-card">
        <h3>Performance (mock · demo)</h3>
        <p className="sub">Expected once deployed. Real numbers via Marketing Cloud post-send.</p>
        <div className="cc2-kpis">
          <div className="cc2-kpi">
            <div className="l"><Users size={10} style={{verticalAlign: '-1px'}} /> Audience</div>
            <div className="v">{fmtNum(totalAudience)}</div>
            <div className="s">across {variants.length} variants</div>
          </div>
          <div className="cc2-kpi" style={{borderBottom: '3px solid var(--primary)'}}>
            <div className="l"><Eye size={10} style={{verticalAlign: '-1px'}} /> Open rate</div>
            <div className="v">34.2%</div>
            <div className="s">est. 16,340 opens</div>
          </div>
          <div className="cc2-kpi" style={{borderBottom: '3px solid var(--theme-cyan)'}}>
            <div className="l"><MousePointerClick size={10} style={{verticalAlign: '-1px'}} /> CTR</div>
            <div className="v">4.8%</div>
            <div className="s">est. 2,290 clicks</div>
          </div>
          <div className="cc2-kpi">
            <div className="l"><X size={10} style={{verticalAlign: '-1px'}} /> Unsubs</div>
            <div className="v" style={{color: '#ef4444'}}>&lt;0.1%</div>
            <div className="s">well below threshold</div>
          </div>
        </div>
      </div>

      <div className="cc2-footer">
        <button className="cc2-btn cc2-btn-ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Back · Content Studio
        </button>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <span style={{fontSize: 12, color: 'var(--text-muted)'}}>
            <CheckCircle2 size={12} style={{verticalAlign: '-2px', color: 'var(--accent-green)'}} /> Brand guidelines confirmed
          </span>
          <button className="cc2-btn cc2-btn-primary">
            <Rocket size={14} /> Submit final brief
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Envelope (subject + preheader) with 3-suggestions popover
// ============================================================
function EnvelopeSection({ variant, content, patchContent }) {
  const [sugg, setSugg] = useState(null);
  const open = (fieldName, fieldLabel, currentValue) =>
    setSugg({ fieldName, fieldLabel, currentValue });

  return (
    <div className="cc2-form-section">
      <div className="cc2-form-section-title">
        <span>Envelope</span>
      </div>
      <div className="cc2-field" style={{marginBottom: 10}}>
        <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Subject line</span>
          <button
            className="cc2-btn cc2-btn-ai cc2-btn-sm"
            style={{padding: '3px 8px', fontSize: 10}}
            onClick={() => open('subject', 'Subject line', content.subject)}
          >
            <Sparkles size={9} /> 3 suggestions
          </button>
        </label>
        <input
          className="cc2-input"
          value={content.subject || ''}
          onChange={e => patchContent({ subject: e.target.value })}
          placeholder="Write a punchy subject line…"
        />
      </div>
      <div className="cc2-field">
        <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Preheader</span>
          <button
            className="cc2-btn cc2-btn-ai cc2-btn-sm"
            style={{padding: '3px 8px', fontSize: 10}}
            onClick={() => open('preheader', 'Preheader', content.preheader)}
          >
            <Sparkles size={9} /> 3 suggestions
          </button>
        </label>
        <input
          className="cc2-input"
          value={content.preheader || ''}
          onChange={e => patchContent({ preheader: e.target.value })}
          placeholder="Shown in the inbox preview…"
        />
      </div>

      {sugg && (
        <FieldSuggestions
          variant={variant}
          fieldName={sugg.fieldName}
          fieldLabel={sugg.fieldLabel}
          blockLabel="Envelope"
          currentValue={sugg.currentValue || ''}
          onPick={(value) => patchContent({ [sugg.fieldName]: value })}
          onClose={() => setSugg(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// AI drafts banner — shown when variant has no user-filled content yet
// ============================================================
function AiDraftsBanner({ variant, campaign, onApply }) {
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/email-blocks/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ variant, campaign, count: 3 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'failed');
      setDrafts(d.drafts || []);
      setModalOpen(true);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(99, 102, 241, 0.06))',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        borderRadius: 14, padding: '14px 18px', marginBottom: 16,
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #a855f7, #6366f1)',
          display: 'grid', placeItems: 'center', color: '#fff',
        }}>
          <Sparkles size={22} />
        </div>
        <div style={{flex: 1}}>
          <h4 style={{fontSize: 14, fontWeight: 700, margin: '0 0 2px'}}>Let AI draft this email for you</h4>
          <p style={{fontSize: 12, color: 'var(--text-muted)', margin: 0}}>
            Get 3 distinct email proposals tailored to <b style={{color: 'var(--text-main)'}}>{variant.market} · {variant.tier}{variant.behaviors?.[0] ? ` · ${variant.behaviors[0]}` : ''}</b>. Pick one or mix & match.
          </p>
          {error && <div style={{color: '#ef4444', fontSize: 11, marginTop: 4}}>⚠ {error}</div>}
        </div>
        <button className="cc2-btn cc2-btn-ai" onClick={generate} disabled={busy}>
          {busy ? <Loader2 size={14} className="cc2-spin" /> : <Wand2 size={14} />}
          {busy ? 'Drafting…' : 'Generate 3 drafts'}
        </button>
      </div>

      {modalOpen && drafts && (
        <DraftsModal
          drafts={drafts}
          onClose={() => setModalOpen(false)}
          onPick={(d) => { onApply(d); setModalOpen(false); }}
        />
      )}
    </>
  );
}

function DraftsModal({ drafts, onClose, onPick }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = drafts[selectedIdx];
  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 40, zIndex: 102,
        background: 'var(--bg-elevated)', borderRadius: 16,
        boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'cc2-fade-in 0.2s',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{padding: '18px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h3 style={{margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8}}>
              <Sparkles size={16} style={{color: '#a855f7'}} /> AI-generated drafts
            </h3>
            <p style={{fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0'}}>Pick one — it replaces the current composition</p>
          </div>
          <button className="cc2-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{padding: '14px 22px', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: `repeat(${drafts.length}, 1fr)`, gap: 10}}>
          {drafts.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: selectedIdx === i ? '2px solid #a855f7' : '1px solid var(--border-light)',
                background: selectedIdx === i ? 'rgba(168, 85, 247, 0.06)' : 'var(--bg-card)',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                color: 'var(--text-main)',
              }}
            >
              <div style={{fontSize: 10, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                {String.fromCharCode(65 + i)} · Draft
              </div>
              <div style={{fontSize: 14, fontWeight: 700, margin: '3px 0 4px'}}>{d.label}</div>
              <div style={{fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4}}>{d.rationale}</div>
              <div style={{fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'JetBrains Mono, monospace'}}>
                {d.blocks?.length || 0} blocks
              </div>
            </button>
          ))}
        </div>
        {selected && (
          <div style={{flex: 1, overflow: 'auto', padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
            <div>
              <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Envelope</div>
              <div style={{background: 'var(--bg-card)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12}}>
                <div style={{color: 'var(--text-muted)', marginBottom: 3}}><b style={{color: 'var(--text-main)'}}>Subject:</b> {selected.subject}</div>
                <div style={{color: 'var(--text-muted)'}}><b style={{color: 'var(--text-main)'}}>Preheader:</b> {selected.preheader}</div>
              </div>
              <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Composition ({selected.blocks?.length || 0} blocks)</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                {(selected.blocks || []).map((b, i) => (
                  <div key={i} style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, fontSize: 12}}>
                    <span style={{fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)'}}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{fontWeight: 600}}>{b.blockId}</span>
                    <span style={{marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)'}}>
                      {Object.keys(b.vars || {}).length} vars
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Preview</div>
              <EmailPreview blocks={selected.blocks || []} subject={selected.subject} preheader={selected.preheader} device="mobile" />
            </div>
          </div>
        )}
        <div style={{padding: '14px 22px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 8}}>
          <button className="cc2-btn cc2-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cc2-btn cc2-btn-ai" onClick={() => onPick(selected)}>
            <Check size={14} /> Use this draft
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Fill-all modal — 3 full content fills for the CURRENT layout
// ============================================================
function FillAllModal({ variant, campaign, blocks, onClose, onApply }) {
  const [loading, setLoading] = useState(true);
  const [fills, setFills] = useState([]);
  const [error, setError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/email-blocks/fill-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ variant, campaign, blocks, count: 3 }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'failed');
        setFills(d.fills || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  const selected = fills[selectedIdx];

  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 40, zIndex: 102,
        background: 'var(--bg-elevated)', borderRadius: 16,
        boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'cc2-fade-in 0.2s',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{padding: '18px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h3 style={{margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8}}>
              <Sparkles size={16} style={{color: '#a855f7'}} /> Fill all fields · 3 ways
            </h3>
            <p style={{fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0'}}>
              Keep your layout ({blocks.length} blocks). AI writes subject, preheader and every field in 3 distinct angles.
            </p>
          </div>
          <button className="cc2-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        {loading && (
          <div style={{flex: 1, display: 'grid', placeItems: 'center', padding: 40, color: 'var(--text-muted)'}}>
            <div style={{textAlign: 'center'}}>
              <Loader2 size={26} className="cc2-spin" />
              <div style={{marginTop: 10, fontSize: 13}}>Writing 3 versions tailored to {variant.market}/{variant.tier}…</div>
              <div style={{marginTop: 4, fontSize: 11, opacity: 0.7}}>This takes 5–10 seconds.</div>
            </div>
          </div>
        )}
        {error && <div style={{padding: 20, color: '#ef4444', fontSize: 12}}>⚠ {error}</div>}

        {!loading && !error && fills.length > 0 && (
          <>
            <div style={{padding: '14px 22px', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: `repeat(${fills.length}, 1fr)`, gap: 10}}>
              {fills.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    border: selectedIdx === i ? '2px solid #a855f7' : '1px solid var(--border-light)',
                    background: selectedIdx === i ? 'rgba(168, 85, 247, 0.06)' : 'var(--bg-card)',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-main)',
                  }}
                >
                  <div style={{fontSize: 10, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div style={{fontSize: 14, fontWeight: 700, margin: '3px 0 4px'}}>{f.label}</div>
                  <div style={{fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4}}>{f.rationale}</div>
                </button>
              ))}
            </div>

            {selected && (
              <div style={{flex: 1, overflow: 'auto', padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
                <div>
                  <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Envelope</div>
                  <div style={{background: 'var(--bg-card)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12}}>
                    <div style={{color: 'var(--text-muted)', marginBottom: 3}}><b style={{color: 'var(--text-main)'}}>Subject:</b> {selected.subject}</div>
                    <div style={{color: 'var(--text-muted)'}}><b style={{color: 'var(--text-main)'}}>Preheader:</b> {selected.preheader}</div>
                  </div>
                  <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Content by block</div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                    {(selected.blocks || []).map((b, i) => {
                      const filledVars = Object.entries(b.vars || {}).filter(([, v]) => v && String(v).trim());
                      return (
                        <div key={i} style={{background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px', fontSize: 11}}>
                          <div style={{fontWeight: 700, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: 10}}>
                            {String(i + 1).padStart(2, '0')} · {b.blockId}
                          </div>
                          {filledVars.length === 0 && <div style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>(no vars)</div>}
                          {filledVars.map(([k, v]) => (
                            <div key={k} style={{marginTop: 3}}>
                              <span style={{color: '#a855f7', fontFamily: 'JetBrains Mono, monospace', fontSize: 10}}>{k}:</span>{' '}
                              <span style={{color: 'var(--text-main)'}}>{String(v).slice(0, 140)}{String(v).length > 140 ? '…' : ''}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>Preview</div>
                  <EmailPreview blocks={selected.blocks || []} subject={selected.subject} preheader={selected.preheader} device="mobile" />
                </div>
              </div>
            )}

            <div style={{padding: '14px 22px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 8}}>
              <button className="cc2-btn cc2-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="cc2-btn cc2-btn-ai" onClick={() => { onApply(selected); onClose(); }} disabled={!selected}>
                <Check size={14} /> Apply this fill
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// Field suggestions popover — 3 variations + refine
// ============================================================
function FieldSuggestions({ variant, fieldName, fieldLabel, blockLabel, currentValue, onPick, onClose }) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [refine, setRefine] = useState('');
  const [error, setError] = useState(null);

  const fetchSuggestions = async (refineText = '') => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/email-blocks/field-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ variant, fieldName, fieldLabel, blockLabel, currentValue, count: 3, refine: refineText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'failed');
      setSuggestions(d.suggestions || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSuggestions(); /* eslint-disable-line */ }, []);

  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(560px, 95vw)', maxHeight: '80vh',
        background: 'var(--bg-elevated)', borderRadius: 14,
        boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
        zIndex: 102, display: 'flex', flexDirection: 'column',
        animation: 'cc2-fade-in 0.15s',
      }}>
        <div style={{padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3 style={{margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8}}>
            <Sparkles size={14} style={{color: '#a855f7'}} /> Suggestions for <span style={{color: 'var(--text-muted)', fontWeight: 400}}>{fieldLabel || fieldName}</span>
          </h3>
          <button className="cc2-drawer-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{flex: 1, overflow: 'auto', padding: 16}}>
          {loading && (
            <div style={{textAlign: 'center', padding: 40, color: 'var(--text-muted)'}}>
              <Loader2 size={22} className="cc2-spin" /> <div style={{fontSize: 12, marginTop: 8}}>Generating…</div>
            </div>
          )}
          {error && <div style={{color: '#ef4444', fontSize: 12, padding: 20}}>⚠ {error}</div>}
          {!loading && !error && suggestions.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 10, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3}}>
                  {s.angle || `Option ${String.fromCharCode(65 + i)}`}
                </div>
                <div style={{fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5}}>{s.value}</div>
              </div>
              <button className="cc2-btn cc2-btn-primary cc2-btn-sm" onClick={() => { onPick(s.value); onClose(); }}>
                Use
              </button>
            </div>
          ))}
        </div>
        <div style={{padding: '12px 18px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 6}}>
          <input
            className="cc2-input"
            style={{fontSize: 12}}
            placeholder='Refine (e.g. "be more urgent", "shorter")'
            value={refine}
            onChange={e => setRefine(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && refine.trim()) { fetchSuggestions(refine); } }}
          />
          <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={() => fetchSuggestions(refine)} disabled={loading}>
            <Wand2 size={11} /> Refine
          </button>
          <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={() => { setRefine(''); fetchSuggestions(); }} disabled={loading}>
            ⟲
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Layout alternatives modal — 3 different block compositions
// ============================================================
function LayoutAlternatives({ variant, currentBlocks, onPick, onClose }) {
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState([]);
  const [error, setError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/email-blocks/layout-alternatives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ variant, currentBlocks, count: 3 }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'failed');
        setLayouts(d.layouts || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  const selected = layouts[selectedIdx];

  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(780px, 95vw)', maxHeight: '85vh',
        background: 'var(--bg-elevated)', borderRadius: 14,
        boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
        zIndex: 102, display: 'flex', flexDirection: 'column',
        animation: 'cc2-fade-in 0.15s',
      }}>
        <div style={{padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3 style={{margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8}}>
            <Sparkles size={14} style={{color: '#a855f7'}} /> Layout alternatives
          </h3>
          <button className="cc2-drawer-close" onClick={onClose}><X size={14} /></button>
        </div>
        {loading && <div style={{textAlign: 'center', padding: 50, color: 'var(--text-muted)'}}><Loader2 size={22} className="cc2-spin" /><div style={{marginTop: 8, fontSize: 12}}>Designing alternatives…</div></div>}
        {error && <div style={{color: '#ef4444', padding: 20, fontSize: 12}}>⚠ {error}</div>}
        {!loading && !error && layouts.length > 0 && (
          <>
            <div style={{padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: `repeat(${layouts.length}, 1fr)`, gap: 10}}>
              {layouts.map((l, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: selectedIdx === i ? '2px solid #a855f7' : '1px solid var(--border-light)',
                    background: selectedIdx === i ? 'rgba(168, 85, 247, 0.06)' : 'var(--bg-card)',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-main)',
                  }}
                >
                  <div style={{fontSize: 10, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                    {String.fromCharCode(65 + i)} · {l.label}
                  </div>
                  <div style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4}}>{l.rationale}</div>
                </button>
              ))}
            </div>
            {selected && (
              <div style={{flex: 1, overflow: 'auto', padding: '16px 18px'}}>
                <div style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8}}>
                  Block sequence
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                  {(selected.blocks || []).map((b, i) => (
                    <div key={i} style={{padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, fontFamily: 'JetBrains Mono, monospace'}}>
                      {String(i + 1).padStart(2, '0')} · {b.blockId}
                    </div>
                  ))}
                </div>
                <div style={{marginTop: 14, padding: 12, background: 'var(--theme-purple-soft)', borderRadius: 8, fontSize: 11, color: '#7c3aed'}}>
                  <b>Note:</b> Your current text content will be preserved where the same field exists in the new layout.
                </div>
              </div>
            )}
            <div style={{padding: '12px 18px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 8}}>
              <button className="cc2-btn cc2-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="cc2-btn cc2-btn-ai" onClick={() => { onPick(selected); onClose(); }} disabled={!selected}>
                <Check size={14} /> Apply this layout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// Brand compliance check — compact status row with expandable details
// ============================================================
function BrandCheckPanel({ variant, content }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/email-blocks/brand-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ variant, content }),
      });
      const d = await r.json();
      if (r.ok) setResult(d);
    } finally { setLoading(false); }
  };

  const statusColor = result?.status === 'pass' ? 'var(--accent-green)' : result?.status === 'warn' ? 'var(--accent-yellow)' : '#ef4444';
  const statusBg = result?.status === 'pass' ? 'rgba(16, 185, 129, 0.1)' : result?.status === 'warn' ? 'rgba(212, 175, 55, 0.12)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <div style={{
      background: result ? statusBg : 'var(--bg-card)',
      border: `1px solid ${result ? statusColor : 'var(--border-light)'}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <ShieldCheck size={16} style={{color: result ? statusColor : 'var(--text-muted)'}} />
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 12, fontWeight: 700, color: result ? statusColor : 'var(--text-main)'}}>
            Brand compliance {result && `· ${result.status?.toUpperCase()} · ${result.score}/100`}
          </div>
          {result?.summary && (
            <div style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 2}}>{result.summary}</div>
          )}
          {!result && !loading && (
            <div style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 2}}>Run a check once your content is drafted.</div>
          )}
        </div>
        {loading ? (
          <Loader2 size={14} className="cc2-spin" style={{color: 'var(--text-muted)'}} />
        ) : result ? (
          <>
            <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Hide' : 'Details'}
            </button>
            <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={run}>⟲</button>
          </>
        ) : (
          <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={run}>
            <ShieldCheck size={11} /> Check
          </button>
        )}
      </div>
      {result && expanded && (
        <div style={{marginTop: 10, paddingTop: 10, borderTop: `1px solid ${statusColor}`, display: 'flex', flexDirection: 'column', gap: 6}}>
          {(result.checks || []).map((c, i) => {
            const cColor = c.status === 'pass' ? 'var(--accent-green)' : c.status === 'warn' ? 'var(--accent-yellow)' : '#ef4444';
            return (
              <div key={i} style={{display: 'flex', gap: 8, fontSize: 11}}>
                <span style={{color: cColor, fontWeight: 700, minWidth: 14}}>
                  {c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗'}
                </span>
                <span style={{fontWeight: 600, minWidth: 90}}>{c.label}</span>
                <span style={{color: 'var(--text-muted)'}}>{c.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Block editor — vertical list of Emirates email blocks,
// each one expandable with its own form fields
// ============================================================
function BlockEditor({ blocks, onChange, variant, campaign, onApplyFill }) {
  const [catalog, setCatalog] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [picker, setPicker] = useState(null); // insert-at index
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [fillAllOpen, setFillAllOpen] = useState(false);
  const [fieldSugg, setFieldSugg] = useState(null); // { blockIdx, fieldName, fieldLabel, blockLabel, currentValue }

  useEffect(() => {
    fetch(`${API_URL}/email-blocks/catalog`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCatalog(d.items || []))
      .catch(() => {});
  }, []);

  const defOf = id => catalog.find(c => c.id === id);

  const updateBlock = (idx, patch) => {
    const next = [...blocks];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeBlock = idx => {
    onChange(blocks.filter((_, i) => i !== idx));
  };
  const moveBlock = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const insertBlock = (blockId, atIdx) => {
    const newB = { id: `b_${Date.now()}`, blockId, vars: {} };
    const next = [...blocks];
    next.splice(atIdx ?? blocks.length, 0, newB);
    onChange(next);
    setPicker(null);
    setExpanded(e => ({ ...e, [newB.id]: true }));
  };

  return (
    <div className="cc2-form-section">
      <div className="cc2-form-section-title">
        <span>Email blocks · {blocks.length}</span>
        <div style={{display: 'flex', gap: 4}}>
          {variant && blocks.length > 0 && (
            <>
              <button className="cc2-btn cc2-btn-ai cc2-btn-sm" onClick={() => setFillAllOpen(true)} title="AI fills every field in 3 ways">
                <Sparkles size={11} /> Fill all · 3 ways
              </button>
              <button className="cc2-btn cc2-btn-ai cc2-btn-sm" onClick={() => setLayoutOpen(true)} title="Get AI layout alternatives">
                <Sparkles size={11} /> 3 layouts
              </button>
            </>
          )}
          <button className="cc2-btn cc2-btn-soft cc2-btn-sm" onClick={() => setPicker('end')}>
            <Plus size={11} /> Add block
          </button>
        </div>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
        {blocks.map((b, idx) => {
          const def = defOf(b.blockId);
          const isOpen = expanded[b.id];
          return (
            <div key={b.id} style={{
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              background: 'var(--bg-elevated)',
              overflow: 'hidden',
            }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', cursor: 'pointer',
                  background: isOpen ? 'var(--bg-card)' : 'transparent',
                }}
                onClick={() => setExpanded(e => ({ ...e, [b.id]: !e[b.id] }))}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                  background: 'var(--primary-soft)', color: 'var(--primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>{idx + 1}</span>
                <span style={{fontSize: 12, fontWeight: 700, flex: 1}}>
                  {def?.label || b.blockId}
                </span>
                <span style={{fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                  {def?.category || ''}
                </span>
                <div style={{display: 'flex', gap: 2}} onClick={e => e.stopPropagation()}>
                  <button
                    className="cc2-btn cc2-btn-soft"
                    style={{padding: 3, fontSize: 10}}
                    disabled={idx === 0}
                    onClick={() => moveBlock(idx, -1)}
                    title="Move up"
                  >▲</button>
                  <button
                    className="cc2-btn cc2-btn-soft"
                    style={{padding: 3, fontSize: 10}}
                    disabled={idx === blocks.length - 1}
                    onClick={() => moveBlock(idx, 1)}
                    title="Move down"
                  >▼</button>
                  <button
                    className="cc2-btn cc2-btn-soft"
                    style={{padding: 3, fontSize: 10, color: '#ef4444'}}
                    onClick={() => removeBlock(idx)}
                    title="Remove"
                  ><Trash2 size={11} /></button>
                </div>
                <ChevronRight size={13} style={{transform: isOpen ? 'rotate(90deg)' : 'none', transition: '.15s', color: 'var(--text-muted)'}} />
              </div>

              {isOpen && def && (
                <div style={{padding: '12px 14px', borderTop: '1px solid var(--border-light)'}}>
                  {def.fields.length === 0 ? (
                    <div style={{fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic'}}>
                      This block has no editable fields.
                    </div>
                  ) : (
                    def.fields.map(f => {
                      // AI suggestions only for text-ish fields (copy), not URLs/images
                      const canSuggest = variant && (f.type === 'textarea' || f.type === 'text' || !f.type);
                      const openSugg = () => setFieldSugg({
                        blockIdx: idx, fieldName: f.name, fieldLabel: f.label,
                        blockLabel: def.label, currentValue: b.vars?.[f.name] ?? '',
                      });
                      return (
                        <div className="cc2-field" key={f.name} style={{marginBottom: 10}}>
                          <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span>{f.label}</span>
                            {canSuggest && (
                              <button
                                className="cc2-btn cc2-btn-ai cc2-btn-sm"
                                style={{padding: '3px 8px', fontSize: 10}}
                                onClick={openSugg}
                                title="3 AI suggestions"
                              >
                                <Sparkles size={9} /> 3
                              </button>
                            )}
                          </label>
                          {f.type === 'textarea' ? (
                            <textarea
                              className="cc2-textarea"
                              value={b.vars?.[f.name] ?? ''}
                              onChange={e => updateBlock(idx, { vars: { ...b.vars, [f.name]: e.target.value } })}
                              placeholder={f.default || ''}
                            />
                          ) : f.type === 'image' ? (
                            <div style={{display: 'flex', gap: 6}}>
                              <input
                                className="cc2-input"
                                value={b.vars?.[f.name] ?? ''}
                                onChange={e => updateBlock(idx, { vars: { ...b.vars, [f.name]: e.target.value } })}
                                placeholder="https://image.e.emirates.email/…"
                              />
                              <button className="cc2-btn cc2-btn-soft cc2-btn-sm" title="Pick from library">
                                <ImageIcon size={12} />
                              </button>
                            </div>
                          ) : f.type === 'url' ? (
                            <input
                              className="cc2-input"
                              type="url"
                              value={b.vars?.[f.name] ?? ''}
                              onChange={e => updateBlock(idx, { vars: { ...b.vars, [f.name]: e.target.value } })}
                              placeholder={f.default || 'https://…'}
                            />
                          ) : (
                            <input
                              className="cc2-input"
                              value={b.vars?.[f.name] ?? ''}
                              onChange={e => updateBlock(idx, { vars: { ...b.vars, [f.name]: e.target.value } })}
                              placeholder={f.default || ''}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                  <button
                    className="cc2-btn cc2-btn-soft cc2-btn-sm"
                    style={{marginTop: 4}}
                    onClick={() => setPicker(idx + 1)}
                  >
                    <Plus size={11} /> Insert block below
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker !== null && (
        <BlockPickerModal
          catalog={catalog}
          onPick={id => insertBlock(id, picker === 'end' ? blocks.length : picker)}
          onClose={() => setPicker(null)}
        />
      )}

      {layoutOpen && variant && (
        <LayoutAlternatives
          variant={variant}
          currentBlocks={blocks}
          onPick={(layout) => {
            // Preserve user-filled vars where the field exists in the new block
            const existingVars = {};
            for (const b of blocks) {
              for (const [k, v] of Object.entries(b.vars || {})) {
                if (v && !existingVars[k]) existingVars[k] = v;
              }
            }
            const newBlocks = (layout.blocks || []).map(b => {
              const def = catalog.find(c => c.id === b.blockId);
              const preserved = {};
              for (const f of def?.fields || []) {
                if (existingVars[f.name]) preserved[f.name] = existingVars[f.name];
              }
              return { ...b, vars: preserved };
            });
            onChange(newBlocks);
          }}
          onClose={() => setLayoutOpen(false)}
        />
      )}

      {fieldSugg && variant && (
        <FieldSuggestions
          variant={variant}
          fieldName={fieldSugg.fieldName}
          fieldLabel={fieldSugg.fieldLabel}
          blockLabel={fieldSugg.blockLabel}
          currentValue={fieldSugg.currentValue}
          onPick={(value) => {
            const b = blocks[fieldSugg.blockIdx];
            if (b) updateBlock(fieldSugg.blockIdx, { vars: { ...b.vars, [fieldSugg.fieldName]: value } });
          }}
          onClose={() => setFieldSugg(null)}
        />
      )}

      {fillAllOpen && variant && (
        <FillAllModal
          variant={variant}
          campaign={campaign}
          blocks={blocks}
          onClose={() => setFillAllOpen(false)}
          onApply={(fill) => {
            // Apply filled blocks + envelope — blockIds are preserved by the server
            onChange(fill.blocks || []);
            if (onApplyFill) onApplyFill({ subject: fill.subject, preheader: fill.preheader });
          }}
        />
      )}
    </div>
  );
}

function BlockPickerModal({ catalog, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const groups = {};
  const filtered = catalog.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toLowerCase())
  );
  for (const c of filtered) {
    const cat = c.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  }
  const catOrder = ['structure', 'hero', 'body', 'offer', 'story', 'cta', 'specialty', 'other'];
  return (
    <>
      <div className="cc2-drawer-backdrop" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(640px, 95vw)', maxHeight: '80vh',
        background: 'var(--bg-elevated)', borderRadius: 16,
        boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
        zIndex: 102,
        display: 'flex', flexDirection: 'column',
        animation: 'cc2-fade-in 0.15s',
      }}>
        <div style={{padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, alignItems: 'center'}}>
          <h3 style={{margin: 0, fontSize: 15, fontWeight: 700}}>Add Emirates block</h3>
          <div style={{flex: 1, position: 'relative'}}>
            <Search size={12} style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
            <input
              className="cc2-input"
              style={{paddingLeft: 28}}
              placeholder="Search blocks…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button className="cc2-drawer-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{flex: 1, overflow: 'auto', padding: 16}}>
          {catOrder.filter(c => groups[c]).map(cat => (
            <div key={cat} style={{marginBottom: 16}}>
              <div style={{fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6}}>
                {cat}
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6}}>
                {groups[cat].map(b => (
                  <button
                    key={b.id}
                    onClick={() => onPick(b.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)', cursor: 'pointer',
                      textAlign: 'left', fontSize: 12, fontWeight: 600,
                      fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                    className="cc2-block-pick"
                  >
                    <span>{b.label}</span>
                    <span style={{fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace'}}>{b.id}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Email preview — iframe that asks the server to render real blocks
// ============================================================
function EmailPreview({ blocks, subject, preheader, device }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounced render
  useEffect(() => {
    if (!blocks.length) { setHtml(''); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`${API_URL}/email-blocks/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ blocks, shell: true }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || 'render failed');
        setHtml(data.html);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [blocks]);

  const frameStyle = device === 'mobile'
    ? { width: 375, height: 600, border: '8px solid #1a1a1a', borderRadius: 26, margin: '0 auto', background: '#fff' }
    : { width: '100%', height: 720, border: '1px solid var(--border-light)', borderRadius: 10, background: '#f4f4f5' };

  return (
    <div>
      {/* Inbox meta (subject + preheader) */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-light)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 11,
      }}>
        <div style={{color: '#888'}}>
          <b style={{color: '#111'}}>Subject:</b> {subject || <span style={{fontStyle: 'italic', color: '#ccc'}}>(empty)</span>}
        </div>
        <div style={{color: '#888', marginTop: 3}}>
          <b style={{color: '#111'}}>Preheader:</b> {preheader || <span style={{fontStyle: 'italic', color: '#ccc'}}>(empty)</span>}
        </div>
      </div>

      <div style={{position: 'relative', display: 'flex', justifyContent: 'center'}}>
        {loading && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            background: 'rgba(255, 255, 255, 0.9)', padding: '4px 10px',
            borderRadius: 999, fontSize: 10, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Loader2 size={10} className="cc2-spin" /> Rendering…
          </div>
        )}
        {error && (
          <div style={{padding: 20, textAlign: 'center', color: '#ef4444', fontSize: 12}}>
            ⚠ {error}
          </div>
        )}
        {!error && (
          <iframe
            title="Email preview"
            srcDoc={html || '<div style="padding:40px; text-align:center; color:#888; font-family:sans-serif;">No blocks yet</div>'}
            style={frameStyle}
            sandbox=""
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main
// ============================================================

export default function CampaignCreationV2Page() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState({
    code: 'A350_FR_PE_2026',
    name: '20260228_FR_A350_PremiumEconomy',
    template: 'Partner Offer',
    businessArea: 'E-commerce',
    deployAt: '2026-02-28T17:00',
    owner: '',
    bauCampaign: '',
    selectedMarkets: ['FR'],
    selectedLanguages: ['EN', 'EN-US', 'FR'],
    selectedTiers: ['Gold', 'Silver'],
    selectedBehaviors: ['highly_engaged', 'dormant_90d', 'abandoned_cart'],
    manualVariants: [],
  });

  return (
    <div className="cc2-root">
      <style>{styles}</style>

      {/* Top bar */}
      <div className="cc2-top">
        <div className="cc2-top-left">
          <button className="cc2-back-btn" onClick={() => window.history.back()}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div className="cc2-top-title">Create Campaign</div>
            <div className="cc2-top-sub">New flow · AI co-pilot · Behavioral segmentation</div>
          </div>
        </div>

        <div className="cc2-stepper">
          <button className={`cc2-step-btn ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`} onClick={() => setStep(1)}>
            {step > 1 ? <Check size={12} /> : <Circle1 />} Setup
          </button>
          <button className={`cc2-step-btn ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`} onClick={() => setStep(2)}>
            {step > 2 ? <Check size={12} /> : <Circle2 />} Content Studio
          </button>
          <button className={`cc2-step-btn ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>
            <Circle3 /> Review
          </button>
        </div>

        <div className="cc2-top-right">
          <span className="cc2-ai-chip"><Sparkles size={10} /> AI active</span>
          <button className="cc2-btn cc2-btn-soft cc2-btn-sm">Save draft</button>
        </div>
      </div>

      {/* Body */}
      <div className="cc2-body">
        {step === 1 && (
          <>
            <div className="cc2-hero">
              <h1>1 · Campaign Setup</h1>
              <p>Define campaign meta and audience segments in one screen. Behavioral axis lets you cross engagement and lifecycle data with classic market/language/tier.</p>
            </div>
            <Step1Setup state={state} setState={setState} onNext={() => setStep(2)} />
          </>
        )}
        {step === 2 && (
          <Step2Studio state={state} setState={setState} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <>
            <div className="cc2-hero">
              <h1>3 · Review & Submit</h1>
              <p>All variants validated. AI audit passed. Submit the brief to kick off the automation pipeline.</p>
            </div>
            <Step3Review state={state} onBack={() => setStep(2)} />
          </>
        )}
      </div>
    </div>
  );
}

// tiny number badges for the stepper
function Circle1() { return <span style={{fontWeight: 700, fontSize: 11}}>1</span>; }
function Circle2() { return <span style={{fontWeight: 700, fontSize: 11}}>2</span>; }
function Circle3() { return <span style={{fontWeight: 700, fontSize: 11}}>3</span>; }
