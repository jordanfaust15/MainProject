'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@/lib/models';

interface SessionHistoryProps {
  projectId: string;
  getSessionHistory: (projectId: string) => Promise<Session[]>;
}

export function SessionHistory({ projectId, getSessionHistory }: SessionHistoryProps) {
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sessions = await getSessionHistory(projectId);
        if (!cancelled) setHistory(sessions);
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId, getSessionHistory]);

  if (loading) {
    return <div className="empty-state"><p>Loading...</p></div>;
  }

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h3>No history</h3>
        <p>Session history will appear here once you start working.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {history.map((session) => (
        <div key={session.id} className="capture-area" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Session {session.id.slice(0, 8)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Entry: {new Date(session.entryTime).toLocaleString()}
            <br />
            Exit: {session.exitTime ? new Date(session.exitTime).toLocaleString() : 'Active'}
            {session.feedbackRating ? ` | Rating: ${session.feedbackRating}/5` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
