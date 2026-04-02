import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const POLL_INTERVAL = 30000; // 30s

export function useAgentPipelineSession(agentId) {
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [pipelineData, setPipelineData] = useState(null);
    const [agents, setAgents] = useState([]);
    const [handoffSession, setHandoffSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef(null);

    // Fetch active sessions for this agent
    const fetchTickets = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/agents/${agentId}/active-sessions`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            setTickets(Array.isArray(data) ? data : []);
        } catch { /* silent */ }
    }, [agentId]);

    // Fetch on mount + poll
    useEffect(() => {
        fetchTickets();
        intervalRef.current = setInterval(fetchTickets, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, [fetchTickets]);

    // Fetch agents list (once)
    useEffect(() => {
        fetch(`${API_URL}/agents`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setAgents(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    // Select a ticket → fetch full pipeline data
    const selectTicket = useCallback(async (ticket) => {
        setSelectedTicket(ticket);
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects/${ticket.project_id}/pipeline`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch pipeline');
            const data = await res.json();
            setPipelineData(data);
        } catch {
            setPipelineData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const clearTicket = useCallback(() => {
        setSelectedTicket(null);
        setPipelineData(null);
        setHandoffSession(null);
    }, []);

    // After handoff completes: refetch tickets, clear selection
    const onHandoffComplete = useCallback(() => {
        setHandoffSession(null);
        setSelectedTicket(null);
        setPipelineData(null);
        fetchTickets();
    }, [fetchTickets]);

    // Derive completed sessions from pipeline data
    const completedSessions = pipelineData?.sessions?.filter(s => s.status === 'completed') || [];
    const stages = pipelineData?.stages || [];

    // Find the current session matching the selected ticket — match by session ID (primary key)
    const currentSession = selectedTicket?.id
        ? (pipelineData?.sessions || []).find(s => s.id === selectedTicket.id)
        : null;

    const hasUrgentTickets = tickets.some(t => t.status === 'awaiting_handoff');

    // Work history count for tab badge
    const [completedWorkCount, setCompletedWorkCount] = useState(null);
    useEffect(() => {
        fetch(`${API_URL}/agents/${agentId}/pipeline-work`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setCompletedWorkCount(Array.isArray(data) ? data.length : 0))
            .catch(() => {});
    }, [agentId]);

    return {
        tickets,
        selectedTicket,
        selectTicket,
        clearTicket,
        pipelineData,
        currentSession,
        completedSessions,
        stages,
        agents,
        handoffSession,
        setHandoffSession,
        onHandoffComplete,
        loading,
        hasUrgentTickets,
        completedWorkCount,
    };
}
