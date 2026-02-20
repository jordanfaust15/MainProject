import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { DataStore } from '../storage';
import { SessionManager } from '../session';
import { ContextExtractor } from '../extraction';
import { BriefingGenerator } from '../briefing';
import { CaptureModule } from '../capture';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '../voice';
import { CaptureSession, TranscriptionResult } from '../models';

// ── Placeholder audio implementations for main process ───────
// In production these would use platform-native APIs.
// The actual recording happens in the renderer via Web Speech API.

class MainProcessRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

class MainProcessTranscription implements TranscriptionService {
  async transcribe(): Promise<TranscriptionResult> {
    return { success: false, text: '', confidence: 0, error: 'Use renderer transcription' };
  }
}

// ── Application state ────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const store = new DataStore();
const sessionManager = new SessionManager(store);
const extractor = new ContextExtractor();
const voiceProcessor = new VoiceInputProcessor(
  new MainProcessRecorder(),
  new MainProcessTranscription()
);
const captureModule = new CaptureModule(extractor, voiceProcessor, sessionManager, store);
const briefingGenerator = new BriefingGenerator(store, sessionManager);

// Track active capture sessions by ID for IPC lookups
const activeCapturesSessions = new Map<string, CaptureSession>();

// ── Window creation ──────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'Reentry',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'public', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Tray ─────────────────────────────────────────────────────

function createTray(): void {
  // Use a 16x16 empty image as placeholder icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quick Capture',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', 'quick-capture');
      },
    },
    {
      label: 'View Briefing',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', 'briefing');
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Reentry');
  tray.setContextMenu(contextMenu);
}

// ── IPC Handlers ─────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Session
  ipcMain.handle('session:create', async (_event, projectId: string) => {
    const session = await sessionManager.createSession(projectId);
    return JSON.parse(JSON.stringify(session));
  });

  ipcMain.handle('session:close', async (_event, sessionId: string) => {
    await sessionManager.closeSession(sessionId, new Date());
  });

  ipcMain.handle('session:getMostRecent', async (_event, projectId: string) => {
    const session = await sessionManager.getMostRecentSession(projectId);
    return session ? JSON.parse(JSON.stringify(session)) : null;
  });

  ipcMain.handle('session:getHistory', async (_event, projectId: string) => {
    const history = await sessionManager.getSessionHistory(projectId);
    return JSON.parse(JSON.stringify(history));
  });

  // Capture
  ipcMain.handle('capture:startQuick', async (_event, sessionId: string) => {
    const capSession = captureModule.startQuickCapture(sessionId);
    activeCapturesSessions.set(capSession.id, capSession);
    return JSON.parse(JSON.stringify(capSession));
  });

  ipcMain.handle('capture:startInterrupt', async (_event, sessionId: string) => {
    const capSession = captureModule.startInterruptCapture(sessionId);
    activeCapturesSessions.set(capSession.id, capSession);
    return JSON.parse(JSON.stringify(capSession));
  });

  ipcMain.handle(
    'capture:submitText',
    async (_event, captureSessionId: string, text: string) => {
      const capSession = activeCapturesSessions.get(captureSessionId);
      if (!capSession) {
        return { success: false, error: 'Capture session not found' };
      }
      const result = await captureModule.submitTextCapture(capSession, text);
      activeCapturesSessions.delete(captureSessionId);
      return JSON.parse(JSON.stringify(result));
    }
  );

  // Briefing
  ipcMain.handle('briefing:generate', async (_event, sessionId: string) => {
    const briefing = await briefingGenerator.generateBriefing(sessionId);
    return JSON.parse(JSON.stringify(briefing));
  });

  ipcMain.handle('briefing:generateForProject', async (_event, projectId: string) => {
    const briefing = await briefingGenerator.generateBriefingForProject(projectId);
    return briefing ? JSON.parse(JSON.stringify(briefing)) : null;
  });

  ipcMain.handle('briefing:formatCard', async (_event, briefing: unknown) => {
    return briefingGenerator.formatBriefingCard(briefing as any);
  });

  // Feedback
  ipcMain.handle(
    'feedback:submit',
    async (_event, sessionId: string, rating: number) => {
      await briefingGenerator.submitFeedback(sessionId, rating);
    }
  );
}

// ── Global shortcuts ─────────────────────────────────────────

function registerShortcuts(): void {
  // Cmd+Shift+I (Mac) / Ctrl+Shift+I (Win/Linux) for interrupt capture
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.send('interrupt-capture-trigger');
    }
  });
}

// ── App lifecycle ────────────────────────────────────────────

app.whenReady().then(async () => {
  await store.load();
  store.startAutoSave();

  registerIpcHandlers();
  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  store.stopAutoSave();
  // Final save
  try {
    await store.immediateSave();
  } catch {
    // Best effort
  }
});
