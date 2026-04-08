/**
 * Centralized icon exports using lucide-react.
 * Replaces all emoji usage across the app with professional SVG icons.
 */
import {
  Home, LayoutGrid, Building, Zap, Mail, FileText, Lightbulb, User, BarChart3,
  Settings, PanelLeft, LogOut, Menu, X, ChevronLeft, Plus, RefreshCw, Save,
  Pencil, Trash2, Pin, Wrench, AlertTriangle, Rocket, Bug, Sparkles, ClipboardList,
  CheckCircle2, RotateCw, Construction, Brain, Target, Dumbbell, CircleAlert,
  Meh, TrendingUp, BarChart2, FileEdit, Clock, Hourglass, PartyPopper,
  MessageSquare, Search, Inbox, FileCheck, Calendar, Shield, Lock, TestTube,
  Palette, Star, Users, Bell, Globe, MonitorSmartphone, Tablet, MailOpen,
  Smartphone, Link2, PlayCircle, CircleDot, Cog, ScrollText, Ruler, Image,
  Puzzle, Bot, ArrowUpRight, Timer, Send, Megaphone, Eye, Package,
  CircleCheck, CircleX, Circle, Loader2, ChevronUp, ChevronDown,
  Activity, ListChecks, FolderKanban, Workflow, BookOpen,
  ServerCrash, HardDrive, GitBranch, Code2, Layers,
  FolderOpen, Siren, Repeat, Scale, Cloud, Gem, Medal,
  Handshake, Plane, Tag, Trophy, Sprout, Moon, HelpCircle,
  Database, Calculator, Share2, Cpu, SlidersHorizontal, Ticket,
  Film,
} from 'lucide-react';

// Default icon size for inline usage
const S = 16;
const M = 18;

// ─── Navigation Icons (Sidebar & HomePage) ─────────────────────────────────
export const NavIcons = {
  home: <Home size={20} />,
  dashboard: <LayoutGrid size={20} />,
  workspace: <Building size={20} />,
  workflows: <Zap size={20} />,
  campaigns: <Mail size={20} />,
  audit: <FileText size={20} />,
  intelligence: <Lightbulb size={20} />,
  agent: <User size={20} />,
  reports: <BarChart3 size={20} />,
  settings: <Settings size={20} />,
  imageStudio: <Film size={20} />,
  panelLeft: <PanelLeft size={20} />,
  logout: <LogOut size={16} />,
  menu: <Menu size={20} />,
  close: <X size={20} />,
};

// ─── HomePage Feature Icons (larger) ────────────────────────────────────────
export const FeatureIcons = {
  projects: <LayoutGrid size={32} />,
  workspace: <Building size={32} />,
  standup: <Calendar size={32} />,
  weekly: <ClipboardList size={32} />,
  pmAgent: <Lightbulb size={32} />,
  workflows: <Zap size={32} />,
  intelligence: <Search size={32} />,
  inbox: <Inbox size={32} />,
  audit: <FileText size={32} />,
};

export const StepIcons = {
  setup: <Settings size={40} />,
  agents: <User size={40} />,
  dashboard: <BarChart3 size={40} />,
};

// ─── Action Icons ───────────────────────────────────────────────────────────
export const ActionIcons = {
  save: <Save size={S} />,
  edit: <Pencil size={S} />,
  delete: <Trash2 size={S} />,
  refresh: <RefreshCw size={S} />,
  add: <Plus size={S} />,
  back: <ChevronLeft size={S} />,
  send: <Send size={S} />,
};

// ─── Section Icons ──────────────────────────────────────────────────────────
export const SectionIcons = {
  painPoints: <Pin size={S} />,
  requirements: <Wrench size={S} />,
  risks: <AlertTriangle size={S} />,
  roadmap: <Rocket size={S} />,
  successMetrics: <Target size={S} />,
};

// ─── Task Type Icons ────────────────────────────────────────────────────────
export const TaskIcons = {
  bug: <Bug size={M} />,
  enhancement: <Sparkles size={M} />,
  task: <ClipboardList size={M} />,
};

// ─── Mood Icons ─────────────────────────────────────────────────────────────
export const MoodIcons = {
  productive: <Rocket size={M} />,
  focused: <Target size={M} />,
  creative: <Sparkles size={M} />,
  energized: <Zap size={M} />,
  motivated: <Dumbbell size={M} />,
  strategic: <Brain size={M} />,
  blocked: <Construction size={M} />,
  neutral: <Meh size={M} />,
  frustrated: <CircleAlert size={M} />,
  accomplished: <Trophy size={M} />,
  starting: <Sprout size={M} />,
  idle: <Moon size={M} />,
  unknown: <HelpCircle size={M} />,
};

// ─── Status Icons ───────────────────────────────────────────────────────────
export const StatusIcons = {
  completed: <CheckCircle2 size={S} />,
  inProgress: <RotateCw size={S} />,
  blocked: <Construction size={S} />,
  insights: <Lightbulb size={S} />,
  loading: <Loader2 size={S} className="icon-spin" />,
  success: <CircleCheck size={S} />,
  error: <CircleX size={S} />,
  pending: <Clock size={S} />,
  running: <RotateCw size={S} />,
  unknown: <Circle size={S} />,
  pass: <CheckCircle2 size={S} />,
  warning: <AlertTriangle size={S} />,
  fail: <CircleX size={S} />,
  failed: <CircleX size={S} />,
  idle: <Circle size={S} />,
};

// ─── Standup Board Icons ────────────────────────────────────────────────────
export const StandupIcons = {
  done: <CheckCircle2 size={M} />,
  wip: <RotateCw size={M} />,
  blocked: <Construction size={M} />,
  insights: <Lightbulb size={M} />,
  timer: <Timer size={S} />,
  celebrate: <PartyPopper size={S} />,
  standup: <RotateCw size={24} />,
  plan: <Calendar size={M} />,
};

// ─── Daily Standup Tab Icons ────────────────────────────────────────────────
export const DailyTabIcons = {
  board: <BarChart2 size={S} />,
  reports: <FileEdit size={S} />,
  trends: <TrendingUp size={S} />,
  calendar: <Calendar size={S} />,
  generate: <Zap size={S} />,
};

// ─── Workflow Icons ─────────────────────────────────────────────────────────
export const WorkflowIcons = {
  'campaign-creation': <Rocket size={20} />,
  'flash-sale-rapid-deploy': <Zap size={20} />,
  'seasonal-campaign-planning': <Calendar size={20} />,
  'brand-audit-cycle': <Shield size={20} />,
  'gdpr-consent-refresh': <Lock size={20} />,
  'email-deliverability-check': <MailOpen size={20} />,
  'ab-test-pipeline': <TestTube size={20} />,
  'weekly-performance-digest': <BarChart2 size={20} />,
  'template-library-refresh': <Puzzle size={20} />,
  'audience-hygiene-cleanup': <Users size={20} />,
  'doc-audit': <BookOpen size={20} />,
  'doc-hygiene': <FileCheck size={20} />,
  default: <Zap size={20} />,
};

// ─── Agent View Tab Icons ───────────────────────────────────────────────────
export const AgentTabIcons = {
  chat: <MessageSquare size={S} />,
  skills: <Wrench size={S} />,
  tools: <Settings size={S} />,
  workflows: <ClipboardList size={S} />,
  activity: <Activity size={S} />,
  eod: <FileEdit size={S} />,
  settings: <SlidersHorizontal size={S} />,
  dashboard: <TrendingUp size={S} />,
  bau: <MailOpen size={S} />,
  attribution: <GitBranch size={S} />,
  reports: <FileText size={S} />,
  automations: <Cog size={S} />,
  executions: <PlayCircle size={S} />,
  errors: <CircleX size={S} />,
  queue: <ClipboardList size={S} />,
  history: <ScrollText size={S} />,
  guidelines: <Ruler size={S} />,
  calendar: <Calendar size={S} />,
  conflicts: <AlertTriangle size={S} />,
  upcoming: <Clock size={S} />,
  campaigns: <Rocket size={S} />,
  dependencies: <Link2 size={S} />,
  metrics: <TrendingUp size={S} />,
  portfolio: <FileEdit size={S} />,
  images: <Palette size={S} />,
  ab: <GitBranch size={S} />,
  quality: <Star size={S} />,
  segments: <Users size={S} />,
  cohorts: <BarChart2 size={S} />,
  alerts: <Bell size={S} />,
  distribution: <BarChart2 size={S} />,
  validation: <AlertTriangle size={S} />,
  compliance: <Shield size={S} />,
  risks: <AlertTriangle size={S} />,
  audit: <ScrollText size={S} />,
  results: <TestTube size={S} />,
  bugs: <Bug size={S} />,
  templates: <Mail size={S} />,
  blocks: <Puzzle size={S} />,
  journeys: <RotateCw size={S} />,
  infrastructure: <HardDrive size={S} />,
  changelog: <FileEdit size={S} />,
  tickets: <Ticket size={S} />,
};

// ─── Metric Card Icons ──────────────────────────────────────────────────────
export const MetricIcons = {
  completed: <CheckCircle2 size={24} />,
  chart: <TrendingUp size={24} />,
  blockers: <Construction size={24} />,
  inbox: <Inbox size={24} />,
  brain: <Brain size={24} />,
  report: <BarChart2 size={24} />,
};

// ─── Content Agent Icons ────────────────────────────────────────────────────
export const ContentIcons = {
  ruler: <Ruler size={S} />,
  target: <Target size={S} />,
  clock: <Clock size={S} />,
  image: <Image size={S} />,
  generate: <Sparkles size={S} />,
  generating: <Loader2 size={S} className="icon-spin" />,
};

// ─── Inbox/PM Icons ─────────────────────────────────────────────────────────
export const InboxIcons = {
  bot: <Bot size={M} />,
  chat: <MessageSquare size={S} />,
  draft: <FileEdit size={S} />,
  project: <Rocket size={S} />,
  discarded: <Trash2 size={S} />,
  telegram: <Smartphone size={S} />,
  agent: <Bot size={S} />,
  dashboardSource: <MonitorSmartphone size={S} />,
  empty: <MessageSquare size={40} />,
};

// ─── Cloud Architect Icons ──────────────────────────────────────────────────
export const CloudIcons = {
  running: <CircleCheck size={S} style={{ color: '#10b981' }} />,
  paused: <CircleDot size={S} style={{ color: '#f59e0b' }} />,
  error: <CircleX size={S} style={{ color: '#ef4444' }} />,
  unknown: <Circle size={S} />,
};

// ─── QA Agent Icons ─────────────────────────────────────────────────────────
export const QaIcons = {
  desktop: <MonitorSmartphone size={S} />,
  mobile: <Smartphone size={S} />,
  tablet: <Tablet size={S} />,
  email: <Mail size={S} />,
  web: <Globe size={S} />,
};

// ─── Calendar Agent Icons ───────────────────────────────────────────────────
export const CalendarIcons = {
  email: <Mail size={S} />,
  push: <Smartphone size={S} />,
  sms: <MessageSquare size={S} />,
};

// ─── Legal Agent Icons ──────────────────────────────────────────────────────
export const LegalIcons = {
  pin: <Pin size={S} />,
  calendar: <Calendar size={S} />,
  user: <User size={S} />,
};

// ─── Report Type Icons (Analytics) ──────────────────────────────────────────
export const ReportTypeIcons = {
  weekly: <BarChart2 size={M} />,
  campaign: <Target size={M} />,
  adhoc: <Search size={M} />,
};

// ─── HTML Dev Icons ─────────────────────────────────────────────────────────
export const HtmlDevIcons = {
  email: <Mail size={S} />,
  block: <Puzzle size={S} />,
};

// ─── Generic Status Dots (colored circles replacing 🟢🟡🔴) ────────────────
export const StatusDots = {
  green: <Circle size={12} fill="#10b981" stroke="none" />,
  yellow: <Circle size={12} fill="#f59e0b" stroke="none" />,
  red: <Circle size={12} fill="#ef4444" stroke="none" />,
  gray: <Circle size={12} fill="#94a3b8" stroke="none" />,
};

// ─── Language Icons (replacing flag emojis) ─────────────────────────────────
export function LangIcon({ lang, size = 14 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 2,
      borderRadius: 3, fontSize: size * 0.65, fontWeight: 700,
      background: 'rgba(99,102,241,0.12)', color: '#6366f1',
      lineHeight: 1, letterSpacing: '0.02em',
    }}>
      {lang.toUpperCase()}
    </span>
  );
}

// ─── Content Type Labels (replacing emoji+text) ─────────────────────────────
export const ContentTypeIcons = {
  'email-subject': <Mail size={S} />,
  'email-body': <MailOpen size={S} />,
  push: <Smartphone size={S} />,
  sms: <MessageSquare size={S} />,
};

// ─── Audit Event Type Icons ─────────────────────────────────────────────────
export const AuditTypeIcons = {
  weekly: <Calendar size={S} />,
  project: <FolderOpen size={S} />,
  task: <CheckCircle2 size={S} />,
  raise: <Siren size={S} />,
  daily: <Repeat size={S} />,
  system: <Cog size={S} />,
  default: <Pin size={S} />,
};

// ─── Data Icons (for mockData identifiers) ──────────────────────────────────
export const DeptIcons = {
  strategic: <Target size={M} />,
  execution: <Rocket size={M} />,
  control: <Shield size={M} />,
};

export const SkillIcons = {
  'campaign-orchestration': <Medal size={S} />,
  'segment-definition': <Target size={S} />,
  'copy-generation': <Pencil size={S} />,
  'brand-compliance': <Shield size={S} />,
  'compliance-validation': <Scale size={S} />,
  'journey-automation': <Cog size={S} />,
  'qa-testing': <Search size={S} />,
  'attribution-modeling': <BarChart2 size={S} />,
  'doc-auditing': <BookOpen size={S} />,
};

export const ToolIcons = {
  'salesforce-mc': <Cloud size={S} />,
  'looker-studio': <BarChart2 size={S} />,
  anthropic: <Bot size={S} />,
  'skywards-api': <Plane size={S} />,
};

export const CapabilityIcons = {
  'email-studio': <Mail size={S} />,
  'journey-builder': <Workflow size={S} />,
  'audience-builder': <Users size={S} />,
  'automation-studio': <Cog size={S} />,
  'content-builder': <FileEdit size={S} />,
  'data-extensions': <Database size={S} />,
  dashboards: <TrendingUp size={S} />,
  'data-blending': <Link2 size={S} />,
  'calculated-fields': <Calculator size={S} />,
  sharing: <Share2 size={S} />,
  attribution: <Target size={S} />,
  explorer: <Search size={S} />,
  'text-generation': <Pencil size={S} />,
  analysis: <Search size={S} />,
  'code-generation': <Code2 size={S} />,
  summarization: <ClipboardList size={S} />,
  reasoning: <Brain size={S} />,
  streaming: <Zap size={S} />,
  'member-lookup': <User size={S} />,
  'points-balance': <Gem size={S} />,
  'tier-calculation': <BarChart2 size={S} />,
  'offer-targeting': <Target size={S} />,
};

export const AgentAvatarIcons = {
  'campaign-manager': <Medal size={M} />,
  'crm-agent': <Gem size={M} />,
  'cloud-architect': <HardDrive size={M} />,
  'content-agent': <Pencil size={M} />,
  'segmentation-agent': <Target size={M} />,
  'automation-architect': <Cog size={M} />,
  'calendar-agent': <Calendar size={M} />,
  'html-developer': <Code2 size={M} />,
  'brand-guardian': <Shield size={M} />,
  'legal-agent': <Scale size={M} />,
  'qa-agent': <Search size={M} />,
  'analytics-agent': <BarChart2 size={M} />,
  'doc-agent': <BookOpen size={M} />,
  'competitive-intel': <Eye size={M} />,
};

// ─── BAU Category Icons ─────────────────────────────────────────────────────
export const BauCategoryIcons = {
  broadcast: <Megaphone size={S} />,
  offers: <Tag size={S} />,
  partner: <Handshake size={S} />,
  route: <Plane size={S} />,
  lifecycle: <RotateCw size={S} />,
  engagement: <BarChart2 size={S} />,
};

// ─── Page Header Icons ──────────────────────────────────────────────────────
export const PageHeaderIcons = {
  audit: <ScrollText size={28} />,
  workflows: <Zap size={28} />,
  weekly: <Calendar size={28} />,
  intelligence: <Brain size={28} />,
  reports: <ClipboardList size={28} />,
};
