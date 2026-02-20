import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  Session,
  Capture,
  StorageSchema,
  createEmptySchema,
  CURRENT_SCHEMA_VERSION,
} from '../models';

const DATA_DIR = path.join(os.homedir(), '.reentry');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const TEMP_FILE = path.join(DATA_DIR, 'data.temp.json');
const BACKUP_COUNT = 3;
const AUTO_SAVE_INTERVAL_MS = 30_000;

function backupPath(n: number): string {
  return path.join(DATA_DIR, `data.backup.${n}.json`);
}

/** Listener called when a persistence operation fails. */
export type FailureListener = (error: Error) => void;

/**
 * Local JSON data store with in-memory cache, atomic writes, and backup rotation.
 */
export class DataStore {
  private data: StorageSchema;
  private dirty = false;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private failureListeners: FailureListener[] = [];

  constructor(private readonly dataDir: string = DATA_DIR) {
    this.data = createEmptySchema();
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async load(): Promise<void> {
    const mainFile = path.join(this.dataDir, 'data.json');

    // Try main file first
    const loaded = await this.tryLoadFile(mainFile);
    if (loaded) {
      this.data = loaded;
      return;
    }

    // Try backups in order
    for (let i = 1; i <= BACKUP_COUNT; i++) {
      const backup = path.join(this.dataDir, `data.backup.${i}.json`);
      const backupData = await this.tryLoadFile(backup);
      if (backupData) {
        this.data = backupData;
        return;
      }
    }

    // All files failed — start fresh
    this.data = createEmptySchema();
  }

  startAutoSave(): void {
    if (this.autoSaveTimer) return;
    this.autoSaveTimer = setInterval(async () => {
      if (this.dirty) {
        await this.save();
      }
    }, AUTO_SAVE_INTERVAL_MS);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  onFailure(listener: FailureListener): void {
    this.failureListeners.push(listener);
  }

  private notifyFailure(error: Error): void {
    for (const listener of this.failureListeners) {
      listener(error);
    }
  }

  // ── Session operations ─────────────────────────────────────

  async saveSession(session: Session): Promise<void> {
    this.data.sessions[session.id] = session;

    // Maintain project index
    if (!this.data.sessionsByProject[session.projectId]) {
      this.data.sessionsByProject[session.projectId] = [];
    }
    const projectSessions = this.data.sessionsByProject[session.projectId];
    if (!projectSessions.includes(session.id)) {
      projectSessions.push(session.id);
    }

    this.dirty = true;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.data.sessions[sessionId] ?? null;
  }

  async getSessionsByProject(projectId: string): Promise<Session[]> {
    const ids = this.data.sessionsByProject[projectId] ?? [];
    return ids
      .map((id) => this.data.sessions[id])
      .filter((s): s is Session => s !== undefined);
  }

  // ── Capture operations ─────────────────────────────────────

  async saveCapture(capture: Capture): Promise<void> {
    this.data.captures[capture.id] = capture;
    this.dirty = true;
  }

  async getCapture(captureId: string): Promise<Capture | null> {
    return this.data.captures[captureId] ?? null;
  }

  // ── Feedback operations ────────────────────────────────────

  async saveFeedback(
    sessionId: string,
    rating: number,
    timestamp: Date
  ): Promise<void> {
    const session = this.data.sessions[sessionId];
    if (!session) return;
    session.feedbackRating = rating;
    session.feedbackTime = timestamp;
    this.dirty = true;
  }

  // ── Persistence ────────────────────────────────────────────

  async save(): Promise<void> {
    const mainFile = path.join(this.dataDir, 'data.json');
    const tempFile = path.join(this.dataDir, 'data.temp.json');

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      const json = JSON.stringify(this.serialize(), null, 2);

      // Write to temp file
      fs.writeFileSync(tempFile, json, 'utf-8');

      // Rotate backups if main file exists
      if (fs.existsSync(mainFile)) {
        this.rotateBackups();
      }

      // Atomic rename
      fs.renameSync(tempFile, mainFile);
      this.dirty = false;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error));
      this.notifyFailure(err);
      throw err;
    }
  }

  /** Immediately persist (used for critical operations like capture completion). */
  async immediateSave(): Promise<void> {
    await this.save();
  }

  // ── Internals ──────────────────────────────────────────────

  private rotateBackups(): void {
    const mainFile = path.join(this.dataDir, 'data.json');

    // Shift backups: 2→3, 1→2
    for (let i = BACKUP_COUNT; i > 1; i--) {
      const older = path.join(this.dataDir, `data.backup.${i - 1}.json`);
      const newer = path.join(this.dataDir, `data.backup.${i}.json`);
      if (fs.existsSync(older)) {
        fs.copyFileSync(older, newer);
      }
    }

    // Current main → backup.1
    const backup1 = path.join(this.dataDir, `data.backup.1.json`);
    fs.copyFileSync(mainFile, backup1);
  }

  private async tryLoadFile(
    filePath: string
  ): Promise<StorageSchema | null> {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return this.deserialize(raw);
    } catch {
      return null;
    }
  }

  private safeISOString(d: Date | undefined): string | undefined {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }

  /**
   * Serialize the in-memory data to a JSON-safe object.
   * Dates are stored as ISO strings.
   */
  private serialize(): object {
    return {
      ...this.data,
      sessions: Object.fromEntries(
        Object.entries(this.data.sessions).map(([id, s]) => [
          id,
          {
            ...s,
            entryTime: this.safeISOString(s.entryTime) ?? new Date().toISOString(),
            exitTime: this.safeISOString(s.exitTime),
            feedbackTime: this.safeISOString(s.feedbackTime),
          },
        ])
      ),
      captures: Object.fromEntries(
        Object.entries(this.data.captures).map(([id, c]) => [
          id,
          {
            ...c,
            timestamp: this.safeISOString(c.timestamp) ?? new Date().toISOString(),
          },
        ])
      ),
    };
  }

  /**
   * Deserialize JSON string back into StorageSchema, reviving Date fields.
   */
  private deserialize(raw: string): StorageSchema {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.version !== 'number'
    ) {
      throw new Error('Invalid storage schema');
    }

    // Revive session dates
    const sessions: Record<string, Session> = {};
    for (const [id, s] of Object.entries(parsed.sessions ?? {})) {
      const session = s as Record<string, unknown>;
      sessions[id] = {
        ...session,
        entryTime: new Date(session.entryTime as string),
        exitTime: session.exitTime
          ? new Date(session.exitTime as string)
          : undefined,
        feedbackTime: session.feedbackTime
          ? new Date(session.feedbackTime as string)
          : undefined,
      } as Session;
    }

    // Revive capture dates
    const captures: Record<string, Capture> = {};
    for (const [id, c] of Object.entries(parsed.captures ?? {})) {
      const capture = c as Record<string, unknown>;
      captures[id] = {
        ...capture,
        timestamp: new Date(capture.timestamp as string),
      } as Capture;
    }

    return {
      sessions,
      sessionsByProject: parsed.sessionsByProject ?? {},
      captures,
      version: parsed.version,
    };
  }

  // ── Test helpers ───────────────────────────────────────────

  /** Reset in-memory data (for tests). */
  _reset(): void {
    this.data = createEmptySchema();
    this.dirty = false;
  }

  /** Get current dirty state (for tests). */
  _isDirty(): boolean {
    return this.dirty;
  }
}
