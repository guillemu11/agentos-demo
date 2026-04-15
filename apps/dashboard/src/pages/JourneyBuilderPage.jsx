import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import JourneyBuilderChat from '../components/journey/JourneyBuilderChat.jsx';
import JourneyCanvas from '../components/journey/JourneyCanvas.jsx';
import JourneyToolbar from '../components/journey/JourneyToolbar.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderPage() {
  const { id } = useParams();
  const [journey, setJourney] = useState(null);
  const [dsl, setDsl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [toolStatus, setToolStatus] = useState(null);

  useEffect(() => {
    fetch(`${API}/journeys/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        setJourney(j);
        setDsl(j.dsl_json);
        setMessages(
          (j.messages || []).map((m) => ({ role: m.role, content: m.content }))
        );
      });
  }, [id]);

  if (!journey) return <div className="loading">…</div>;

  return (
    <div className="journey-builder">
      <JourneyToolbar
        journey={journey}
        dsl={dsl}
        onRename={(name) => setJourney({ ...journey, name })}
      />
      <div className="journey-builder__body">
        <JourneyBuilderChat
          journeyId={id}
          messages={messages}
          onJourneyState={setDsl}
          onToolStatus={setToolStatus}
          onMessage={(m) => setMessages((prev) => [...prev, m])}
        />
        <JourneyCanvas dsl={dsl} toolStatus={toolStatus} />
      </div>
    </div>
  );
}
