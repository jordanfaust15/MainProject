import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposes a secure API to the renderer process via contextBridge.
 * The renderer can call window.reentryAPI.* methods.
 */
contextBridge.exposeInMainWorld('reentryAPI', {
  // ── Session ────────────────────────────────────────────────
  createSession: (projectId: string) =>
    ipcRenderer.invoke('session:create', projectId),

  closeSession: (sessionId: string) =>
    ipcRenderer.invoke('session:close', sessionId),

  getMostRecentSession: (projectId: string) =>
    ipcRenderer.invoke('session:getMostRecent', projectId),

  getSessionHistory: (projectId: string) =>
    ipcRenderer.invoke('session:getHistory', projectId),

  // ── Capture ────────────────────────────────────────────────
  startQuickCapture: (sessionId: string) =>
    ipcRenderer.invoke('capture:startQuick', sessionId),

  startInterruptCapture: (sessionId: string) =>
    ipcRenderer.invoke('capture:startInterrupt', sessionId),

  submitTextCapture: (captureSessionId: string, text: string) =>
    ipcRenderer.invoke('capture:submitText', captureSessionId, text),

  // ── Briefing ───────────────────────────────────────────────
  generateBriefing: (sessionId: string) =>
    ipcRenderer.invoke('briefing:generate', sessionId),

  generateBriefingForProject: (projectId: string) =>
    ipcRenderer.invoke('briefing:generateForProject', projectId),

  formatBriefingCard: (briefing: unknown) =>
    ipcRenderer.invoke('briefing:formatCard', briefing),

  // ── Feedback ───────────────────────────────────────────────
  submitFeedback: (sessionId: string, rating: number) =>
    ipcRenderer.invoke('feedback:submit', sessionId, rating),

  // ── Events ─────────────────────────────────────────────────
  onInterruptCaptureTrigger: (callback: () => void) => {
    ipcRenderer.on('interrupt-capture-trigger', () => callback());
  },
});
