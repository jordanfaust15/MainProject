import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataStore } from '../../src/storage/data-store';
import { Session, Capture, ContextElements } from '../../src/models';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reentry-test-'));
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    projectId: 'proj-1',
    entryTime: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeCapture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: 'cap-1',
    sessionId: 'sess-1',
    type: 'quick',
    originalInput: 'working on auth flow',
    contextElements: {
      intent: ['debugging auth'],
      originalInput: 'working on auth flow',
    },
    timestamp: new Date('2025-01-01T10:30:00Z'),
    ...overrides,
  };
}

describe('DataStore', () => {
  let dir: string;
  let store: DataStore;

  beforeEach(() => {
    dir = tmpDir();
    store = new DataStore(dir);
  });

  afterEach(() => {
    store.stopAutoSave();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ── Session CRUD ───────────────────────────────────────────

  test('saves and retrieves a session', async () => {
    const session = makeSession();
    await store.saveSession(session);

    const retrieved = await store.getSession('sess-1');
    expect(retrieved).toEqual(session);
  });

  test('returns null for non-existent session', async () => {
    const result = await store.getSession('nope');
    expect(result).toBeNull();
  });

  test('retrieves sessions by project', async () => {
    const s1 = makeSession({ id: 'sess-1', projectId: 'proj-A' });
    const s2 = makeSession({ id: 'sess-2', projectId: 'proj-A' });
    const s3 = makeSession({ id: 'sess-3', projectId: 'proj-B' });

    await store.saveSession(s1);
    await store.saveSession(s2);
    await store.saveSession(s3);

    const projA = await store.getSessionsByProject('proj-A');
    expect(projA).toHaveLength(2);
    expect(projA.map((s) => s.id).sort()).toEqual(['sess-1', 'sess-2']);

    const projB = await store.getSessionsByProject('proj-B');
    expect(projB).toHaveLength(1);
  });

  test('returns empty array for project with no sessions', async () => {
    const result = await store.getSessionsByProject('unknown');
    expect(result).toEqual([]);
  });

  // ── Capture CRUD ───────────────────────────────────────────

  test('saves and retrieves a capture', async () => {
    const capture = makeCapture();
    await store.saveCapture(capture);

    const retrieved = await store.getCapture('cap-1');
    expect(retrieved).toEqual(capture);
  });

  test('returns null for non-existent capture', async () => {
    const result = await store.getCapture('nope');
    expect(result).toBeNull();
  });

  // ── Feedback ───────────────────────────────────────────────

  test('saves feedback on an existing session', async () => {
    const session = makeSession();
    await store.saveSession(session);

    const now = new Date();
    await store.saveFeedback('sess-1', 4, now);

    const updated = await store.getSession('sess-1');
    expect(updated?.feedbackRating).toBe(4);
    expect(updated?.feedbackTime).toEqual(now);
  });

  test('saveFeedback is a no-op for unknown session', async () => {
    // Should not throw
    await store.saveFeedback('unknown', 5, new Date());
  });

  // ── Persistence round-trip ─────────────────────────────────

  test('data survives save and load', async () => {
    const session = makeSession({
      exitTime: new Date('2025-01-01T12:00:00Z'),
    });
    const capture = makeCapture();

    await store.saveSession(session);
    await store.saveCapture(capture);
    await store.save();

    // Load in a fresh store
    const store2 = new DataStore(dir);
    await store2.load();

    const loadedSession = await store2.getSession('sess-1');
    expect(loadedSession).not.toBeNull();
    expect(loadedSession!.id).toBe(session.id);
    expect(loadedSession!.entryTime).toEqual(session.entryTime);
    expect(loadedSession!.exitTime).toEqual(session.exitTime);

    const loadedCapture = await store2.getCapture('cap-1');
    expect(loadedCapture).not.toBeNull();
    expect(loadedCapture!.originalInput).toBe(capture.originalInput);
    expect(loadedCapture!.timestamp).toEqual(capture.timestamp);
  });

  // ── Atomic writes ──────────────────────────────────────────

  test('creates data directory if it does not exist', async () => {
    const nestedDir = path.join(dir, 'nested', 'deep');
    const nestedStore = new DataStore(nestedDir);

    await nestedStore.saveSession(makeSession());
    await nestedStore.save();

    expect(fs.existsSync(path.join(nestedDir, 'data.json'))).toBe(true);
  });

  test('temp file is removed after successful save', async () => {
    await store.saveSession(makeSession());
    await store.save();

    const tempFile = path.join(dir, 'data.temp.json');
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  // ── Backup rotation ────────────────────────────────────────

  test('rotates backups on save', async () => {
    // Save 1
    await store.saveSession(makeSession({ id: 'v1' }));
    await store.save();

    // Save 2
    await store.saveSession(makeSession({ id: 'v2' }));
    await store.save();

    // Save 3
    await store.saveSession(makeSession({ id: 'v3' }));
    await store.save();

    // backup.1 should exist (previous version)
    expect(fs.existsSync(path.join(dir, 'data.backup.1.json'))).toBe(true);
    // backup.2 should exist
    expect(fs.existsSync(path.join(dir, 'data.backup.2.json'))).toBe(true);
  });

  // ── Load from backup ───────────────────────────────────────

  test('loads from backup if main file is corrupted', async () => {
    await store.saveSession(makeSession());
    await store.save();

    // Save again to create backup.1
    await store.saveSession(makeSession({ id: 'sess-2' }));
    await store.save();

    // Corrupt main file
    fs.writeFileSync(path.join(dir, 'data.json'), 'CORRUPT!', 'utf-8');

    const store2 = new DataStore(dir);
    await store2.load();

    // Should have loaded from backup — sess-1 should be there
    const session = await store2.getSession('sess-1');
    expect(session).not.toBeNull();
  });

  test('starts fresh if all files are corrupted', async () => {
    // Create a main file and backups, all corrupted
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'data.json'), 'BAD', 'utf-8');
    fs.writeFileSync(path.join(dir, 'data.backup.1.json'), 'BAD', 'utf-8');
    fs.writeFileSync(path.join(dir, 'data.backup.2.json'), 'BAD', 'utf-8');
    fs.writeFileSync(path.join(dir, 'data.backup.3.json'), 'BAD', 'utf-8');

    const store2 = new DataStore(dir);
    await store2.load();

    // Should start with empty data
    const result = await store2.getSession('anything');
    expect(result).toBeNull();
  });

  // ── Dirty tracking ─────────────────────────────────────────

  test('marks store as dirty after writes', async () => {
    expect(store._isDirty()).toBe(false);
    await store.saveSession(makeSession());
    expect(store._isDirty()).toBe(true);
  });

  test('clears dirty flag after save', async () => {
    await store.saveSession(makeSession());
    await store.save();
    expect(store._isDirty()).toBe(false);
  });

  // ── Failure notification ───────────────────────────────────

  test('notifies listeners on save failure', async () => {
    // Use a read-only directory to trigger write failure
    const readOnlyDir = path.join(dir, 'readonly');
    fs.mkdirSync(readOnlyDir);
    fs.writeFileSync(path.join(readOnlyDir, 'data.json'), '{}', 'utf-8');
    fs.chmodSync(readOnlyDir, 0o444);

    const failStore = new DataStore(readOnlyDir);
    const errors: Error[] = [];
    failStore.onFailure((err) => errors.push(err));

    await failStore.saveSession(makeSession());

    await expect(failStore.save()).rejects.toThrow();
    expect(errors).toHaveLength(1);

    // Cleanup: restore permissions so afterEach can delete
    fs.chmodSync(readOnlyDir, 0o755);
  });

  // ── Project index deduplication ────────────────────────────

  test('does not duplicate session in project index on re-save', async () => {
    const session = makeSession();
    await store.saveSession(session);
    await store.saveSession(session); // save same session again

    const sessions = await store.getSessionsByProject('proj-1');
    expect(sessions).toHaveLength(1);
  });
});
