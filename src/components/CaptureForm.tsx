'use client';

import { useState, useCallback } from 'react';
import { useCaptureTimer } from '@/hooks/useCaptureTimer';
import type { CaptureSession, CaptureResult } from '@/lib/models';

interface CaptureFormProps {
  currentSessionId: string | null;
  onCreateSession: (projectId: string) => Promise<{ id: string }>;
  onStartQuickCapture: (sessionId: string) => CaptureSession;
  onStartInterruptCapture: (sessionId: string) => CaptureSession;
  onSubmitTextCapture: (captureSession: CaptureSession, text: string) => Promise<CaptureResult>;
  projectId: string;
}

export function CaptureForm({
  currentSessionId,
  onCreateSession,
  onStartQuickCapture,
  onStartInterruptCapture,
  onSubmitTextCapture,
  projectId,
}: CaptureFormProps) {
  const [text, setText] = useState('');
  const [captureStatus, setCaptureStatus] = useState<{ message: string; type: string } | null>(null);
  const timer = useCaptureTimer();

  const submitCapture = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await onCreateSession(projectId);
        sessionId = session.id;
      }

      const capSession = onStartQuickCapture(sessionId);
      const result = await onSubmitTextCapture(capSession, trimmed);

      if (result.success) {
        setText('');
        timer.stop();
        setCaptureStatus({ message: 'Capture saved! Context extracted.', type: 'success' });
      } else {
        setCaptureStatus({ message: `Capture failed: ${result.error ?? 'Unknown error'}`, type: 'error' });
      }
    } catch (err) {
      setCaptureStatus({ message: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, type: 'error' });
    }
  }, [text, currentSessionId, projectId, onCreateSession, onStartQuickCapture, onSubmitTextCapture, timer]);

  const startInterrupt = useCallback(async () => {
    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await onCreateSession(projectId);
        sessionId = session.id;
      }

      const capSession = onStartInterruptCapture(sessionId);
      const inputText = text.trim() || 'Quick interrupt - no details captured';
      const result = await onSubmitTextCapture(capSession, inputText);

      if (result.success) {
        setText('');
        setCaptureStatus({ message: 'Interrupt capture saved!', type: 'success' });
      }
    } catch (err) {
      setCaptureStatus({ message: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, type: 'error' });
    }
  }, [text, currentSessionId, projectId, onCreateSession, onStartInterruptCapture, onSubmitTextCapture]);

  return (
    <>
      <div className="capture-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>What were you working on?</span>
          {timer.remaining !== null && (
            <span className={`timer ${timer.remaining <= 10 ? 'urgent' : ''}`}>
              {timer.remaining}s
            </span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I was working on... Found that... Need to check... Next I should..."
        />
        <div className="capture-controls">
          <button className="btn btn-primary" onClick={submitCapture}>
            Save Capture
          </button>
          <button className="btn btn-secondary btn-small" onClick={startInterrupt}>
            Interrupt (2s)
          </button>
        </div>
      </div>
      {captureStatus && (
        <div className={`status ${captureStatus.type}`}>{captureStatus.message}</div>
      )}
    </>
  );
}
