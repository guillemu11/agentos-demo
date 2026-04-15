import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import JourneyBuilderChat from '../components/journey/JourneyBuilderChat.jsx';
import JourneyCanvas from '../components/journey/JourneyCanvas.jsx';
import JourneyToolbar from '../components/journey/JourneyToolbar.jsx';
import EmailBuilderModal from '../components/journey/EmailBuilderModal.jsx';
import EntrySourceModal from '../components/journey/EntrySourceModal.jsx';
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [journey, setJourney] = useState(null);
  const [dsl, setDsl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [toolStatus, setToolStatus] = useState(null);
  const [seedMessage, setSeedMessage] = useState(null);
  const [emailBuilderActivity, setEmailBuilderActivity] = useState(null);
  const [highlightActivityId, setHighlightActivityId] = useState(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chat');
  const loadedRef = useRef(false);

  const journeyHighPriorityCount = AI_PROPOSALS.journeys.default.filter(p => p.priority === 'urgent' || p.priority === 'high').length;

  useEffect(() => {
    fetch(`${API}/journeys/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        setJourney(j);
        setDsl(j.dsl_json);
        setMessages((j.messages || []).map((m) => ({ role: m.role, content: m.content })));
        const seed = searchParams.get('seed');
        if (seed && !loadedRef.current && (!j.messages || j.messages.length === 0)) {
          loadedRef.current = true;
          setSeedMessage(seed);
          setSearchParams({}, { replace: true });
        }
      });
  }, [id]);

  const handleNodeClick = (node) => {
    if (node.type === 'entry') {
      setEntryModalOpen(true);
      return;
    }
    if (node.data?.activity?.type === 'email_send' && !node.data.activity.mc_email_id) {
      setEmailBuilderActivity(node.data.activity);
    }
  };

  if (!journey) return <div className="journey-builder__loading">…</div>;

  return (
    <div className="journey-builder">
      <JourneyToolbar
        journey={journey}
        dsl={dsl}
        onRename={(name) => setJourney({ ...journey, name })}
      />
      <div className="journey-builder__body">
        <aside className="journey-chat">
          <div className="journey-sidebar-tabs">
            <button
              className={`journey-sidebar-tab${sidebarTab === 'chat' ? ' active' : ''}`}
              onClick={() => setSidebarTab('chat')}
              type="button"
            >
              Chat
            </button>
            <button
              className={`journey-sidebar-tab${sidebarTab === 'ai-ideas' ? ' active' : ''}`}
              onClick={() => setSidebarTab('ai-ideas')}
              type="button"
            >
              ✦ AI Ideas
              {journeyHighPriorityCount > 0 && (
                <span className="ai-tab-badge">{journeyHighPriorityCount}</span>
              )}
            </button>
          </div>

          {sidebarTab === 'chat' ? (
            <JourneyBuilderChat
              journeyId={id}
              messages={messages}
              seedMessage={seedMessage}
              onSeedConsumed={() => setSeedMessage(null)}
              onJourneyState={setDsl}
              onToolStatus={setToolStatus}
              onMessage={(m) => setMessages((prev) => [...prev, m])}
            />
          ) : (
            <AIIdeasTab
              proposals={AI_PROPOSALS.journeys.default}
              onDemand={false}
              metaText="Auto-analysis · 5 min ago"
            />
          )}
        </aside>

        <JourneyCanvas
          dsl={dsl}
          toolStatus={toolStatus}
          onNodeClick={handleNodeClick}
          highlightActivityId={highlightActivityId}
        />
      </div>
      <EmailBuilderModal
        open={!!emailBuilderActivity}
        journeyId={id}
        activity={emailBuilderActivity}
        dsl={dsl}
        onClose={() => setEmailBuilderActivity(null)}
        onConfirmed={(updatedDsl) => {
          setDsl(updatedDsl);
          const actId = emailBuilderActivity?.id;
          setEmailBuilderActivity(null);
          if (actId) {
            setHighlightActivityId(actId);
            setTimeout(() => setHighlightActivityId(null), 900);
          }
        }}
      />
      <EntrySourceModal
        open={entryModalOpen && !!dsl?.entry?.source}
        journeyId={id}
        dsl={dsl}
        onClose={() => setEntryModalOpen(false)}
        onSaved={(newDsl) => { setDsl(newDsl); setEntryModalOpen(false); }}
      />
    </div>
  );
}
