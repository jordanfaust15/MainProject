'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SupabaseDataStore } from '@/lib/storage/supabase-data-store';
import { SessionManager } from '@/lib/session/session-manager';
import { ContextExtractor } from '@/lib/extraction/context-extractor';
import { BriefingGenerator } from '@/lib/briefing/briefing-generator';
import { CaptureModule } from '@/lib/capture/capture-module';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '@/lib/voice/voice-processor';
import type {
  Session,
  CaptureSession,
  CaptureResult,
  RestartBriefing,
  TranscriptionResult,
} from '@/lib/models';

// Stub implementations for voice (actual recording uses useVoiceCapture hook)
class NoopRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

class NoopTranscription implements TranscriptionService {
  async transcribe(): Promise<TranscriptionResult> {
    return { success: false, text: '', confidence: 0, error: 'Use browser speech API' };
  }
}

function createModules() {
  const store = new SupabaseDataStore(getSupabaseClient());
  const sessionManager = new SessionManager(store);
  const extractor = new ContextExtractor();
  const voiceProcessor = new VoiceInputProcessor(new NoopRecorder(), new NoopTranscription());
  const captureModule = new CaptureModule(extractor, voiceProcessor, sessionManager, store);
  const briefingGenerator = new BriefingGenerator(store, sessionManager);
  return { store, sessionManager, captureModule, briefingGenerator };
}

export function useReentry() {
  const modulesRef = useRef<ReturnType<typeof createModules> | null>(null);

  if (!modulesRef.current) {
    modulesRef.current = createModules();
  }

  const { sessionManager, captureModule, briefingGenerator } = modulesRef.current;

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const clearStatus = useCallback(() => setStatus(null), []);

  // Auto-clear status after 4 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(clearStatus, 4000);
      return () => clearTimeout(timer);
    }
  }, [status, clearStatus]);

  const createSession = useCallback(async (projectId: string): Promise<Session> => {
    const session = await sessionManager.createSession(projectId);
    setCurrentSessionId(session.id);
    setStatus({ message: `Session started for "${projectId}"`, type: 'success' });
    return session;
  }, [sessionManager]);

  const closeSession = useCallback(async (sessionId: string): Promise<void> => {
    await sessionManager.closeSession(sessionId, new Date());
  }, [sessionManager]);

  const getMostRecentSession = useCallback(async (projectId: string): Promise<Session | null> => {
    return sessionManager.getMostRecentSession(projectId);
  }, [sessionManager]);

  const getSessionHistory = useCallback(async (projectId: string): Promise<Session[]> => {
    return sessionManager.getSessionHistory(projectId);
  }, [sessionManager]);

  const startQuickCapture = useCallback((sessionId: string): CaptureSession => {
    return captureModule.startQuickCapture(sessionId);
  }, [captureModule]);

  const startInterruptCapture = useCallback((sessionId: string): CaptureSession => {
    return captureModule.startInterruptCapture(sessionId);
  }, [captureModule]);

  const submitTextCapture = useCallback(async (
    captureSession: CaptureSession,
    text: string
  ): Promise<CaptureResult> => {
    const result = await captureModule.submitTextCapture(captureSession, text);
    if (result.success) {
      setCurrentSessionId(null);
      setStatus({ message: 'Capture saved! Context extracted.', type: 'success' });
    } else {
      setStatus({ message: `Capture failed: ${result.error ?? 'Unknown error'}`, type: 'error' });
    }
    return result;
  }, [captureModule]);

  const generateBriefing = useCallback(async (sessionId: string): Promise<RestartBriefing> => {
    return briefingGenerator.generateBriefing(sessionId);
  }, [briefingGenerator]);

  const generateBriefingForProject = useCallback(async (projectId: string): Promise<RestartBriefing | null> => {
    return briefingGenerator.generateBriefingForProject(projectId);
  }, [briefingGenerator]);

  const submitFeedback = useCallback(async (sessionId: string, rating: number): Promise<void> => {
    await briefingGenerator.submitFeedback(sessionId, rating);
  }, [briefingGenerator]);

  return {
    currentSessionId,
    status,
    clearStatus,
    createSession,
    closeSession,
    getMostRecentSession,
    getSessionHistory,
    startQuickCapture,
    startInterruptCapture,
    submitTextCapture,
    generateBriefing,
    generateBriefingForProject,
    submitFeedback,
  };
}
