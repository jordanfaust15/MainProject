'use client';

import { useState, useCallback, useEffect } from 'react';
import { useReentry } from '@/hooks/useReentry';
import { Header } from '@/components/Header';
import { ProjectSelector } from '@/components/ProjectSelector';
import { Navigation, type Tab } from '@/components/Navigation';
import { BriefingCard } from '@/components/BriefingCard';
import { CaptureForm } from '@/components/CaptureForm';
import { SessionHistory } from '@/components/SessionHistory';
import { StatusMessage } from '@/components/StatusMessage';
import { Tutorial } from '@/components/Tutorial';
import type { RestartBriefing } from '@/lib/models';

export function ReentryApp() {
  const reentry = useReentry();
  const [projectId, setProjectId] = useState('default');
  const [activeTab, setActiveTab] = useState<Tab>('briefing');
  const [briefing, setBriefing] = useState<RestartBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('reentry-tutorial-seen')) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialClose = useCallback(() => {
    localStorage.setItem('reentry-tutorial-seen', 'true');
    setShowTutorial(false);
  }, []);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const b = await reentry.generateBriefingForProject(projectId || 'default');
      setBriefing(b);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }, [projectId, reentry]);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (tab === 'briefing') loadBriefing();
    },
    [loadBriefing]
  );

  const handleStartSession = useCallback(async () => {
    await reentry.createSession(projectId || 'default');
  }, [reentry, projectId]);

  const handleFeedback = useCallback(
    async (sessionId: string, rating: number) => {
      await reentry.submitFeedback(sessionId, rating);
    },
    [reentry]
  );

  return (
    <div id="app">
      <Header onHelpClick={() => setShowTutorial(true)} />
      <Tutorial isOpen={showTutorial} onClose={handleTutorialClose} />
      <ProjectSelector projectId={projectId} onChange={setProjectId} />
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Briefing Section */}
      {activeTab === 'briefing' && (
        <div className="section active">
          <div id="briefing-content">
            {reentry.status && (
              <StatusMessage message={reentry.status.message} type={reentry.status.type} />
            )}
            {briefingLoading ? (
              <div className="empty-state"><p>Loading briefing...</p></div>
            ) : briefing ? (
              <BriefingCard briefing={briefing} onFeedback={handleFeedback} />
            ) : (
              <div className="empty-state">
                <h3>No sessions yet</h3>
                <p>Start a session and make a capture to see your restart briefing here.</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleStartSession}>
              Start Session
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={loadBriefing}>
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Capture Section */}
      {activeTab === 'capture' && (
        <div className="section active">
          <CaptureForm
            currentSessionId={reentry.currentSessionId}
            onCreateSession={reentry.createSession}
            onStartQuickCapture={reentry.startQuickCapture}
            onStartInterruptCapture={reentry.startInterruptCapture}
            onSubmitTextCapture={reentry.submitTextCapture}
            projectId={projectId || 'default'}
          />
        </div>
      )}

      {/* History Section */}
      {activeTab === 'history' && (
        <div className="section active">
          <SessionHistory
            projectId={projectId || 'default'}
            getSessionHistory={reentry.getSessionHistory}
          />
        </div>
      )}
    </div>
  );
}
