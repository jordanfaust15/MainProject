import { MockDataStore } from '../helpers/mock-data-store';
import { Session, Capture } from '../../src/lib/models';

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
  let store: MockDataStore;

  beforeEach(() => {
    store = new MockDataStore();
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

  // ── Persistence round-trip (in-memory) ─────────────────────

  test('data survives save and retrieval', async () => {
    const session = makeSession({
      exitTime: new Date('2025-01-01T12:00:00Z'),
    });
    const capture = makeCapture();

    await store.saveSession(session);
    await store.saveCapture(capture);
    await store.save();

    const loadedSession = await store.getSession('sess-1');
    expect(loadedSession).not.toBeNull();
    expect(loadedSession!.id).toBe(session.id);
    expect(loadedSession!.entryTime).toEqual(session.entryTime);
    expect(loadedSession!.exitTime).toEqual(session.exitTime);

    const loadedCapture = await store.getCapture('cap-1');
    expect(loadedCapture).not.toBeNull();
    expect(loadedCapture!.originalInput).toBe(capture.originalInput);
    expect(loadedCapture!.timestamp).toEqual(capture.timestamp);
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

  // ── Reset ──────────────────────────────────────────────────

  test('reset clears all data', async () => {
    await store.saveSession(makeSession());
    await store.saveCapture(makeCapture());

    store._reset();

    expect(await store.getSession('sess-1')).toBeNull();
    expect(await store.getCapture('cap-1')).toBeNull();
    expect(store._isDirty()).toBe(false);
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
