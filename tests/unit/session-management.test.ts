import { SessionManager } from '../../src/lib/session/session-manager';
import { MockDataStore } from '../helpers/mock-data-store';

describe('SessionManager', () => {
  let store: MockDataStore;
  let manager: SessionManager;

  beforeEach(() => {
    store = new MockDataStore();
    manager = new SessionManager(store);
  });

  // ── Session creation ───────────────────────────────────────

  test('creates a session with unique ID and entry timestamp', async () => {
    const session = await manager.createSession('proj-1');

    expect(session.id).toBeDefined();
    expect(session.id.length).toBeGreaterThan(0);
    expect(session.projectId).toBe('proj-1');
    expect(session.entryTime).toBeInstanceOf(Date);
    expect(session.exitTime).toBeUndefined();
  });

  test('creates sessions with unique IDs', async () => {
    const s1 = await manager.createSession('proj-1');
    const s2 = await manager.createSession('proj-1');

    expect(s1.id).not.toBe(s2.id);
  });

  test('persists created session in store', async () => {
    const session = await manager.createSession('proj-1');

    const retrieved = await store.getSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(session.id);
  });

  // ── Session closure ────────────────────────────────────────

  test('closes session with exit timestamp', async () => {
    const session = await manager.createSession('proj-1');
    const exitTime = new Date(session.entryTime.getTime() + 60_000);

    await manager.closeSession(session.id, exitTime);

    const closed = await store.getSession(session.id);
    expect(closed!.exitTime).toEqual(exitTime);
  });

  test('rejects exit time before entry time', async () => {
    const session = await manager.createSession('proj-1');
    const badExit = new Date(session.entryTime.getTime() - 1000);

    await manager.closeSession(session.id, badExit);

    const unchanged = await store.getSession(session.id);
    expect(unchanged!.exitTime).toBeUndefined();
  });

  test('closing unknown session is a no-op', async () => {
    // Should not throw
    await manager.closeSession('nonexistent', new Date());
  });

  // ── Most recent session ────────────────────────────────────

  test('returns most recent session for a project', async () => {
    const s1 = await manager.createSession('proj-1');
    // Ensure s2 has a later entry time
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await manager.createSession('proj-1');

    const recent = await manager.getMostRecentSession('proj-1');
    expect(recent).not.toBeNull();
    expect(recent!.id).toBe(s2.id);
  });

  test('returns null for project with no sessions', async () => {
    const result = await manager.getMostRecentSession('empty-project');
    expect(result).toBeNull();
  });

  // ── Session history ────────────────────────────────────────

  test('returns session history sorted newest first', async () => {
    const s1 = await manager.createSession('proj-1');
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await manager.createSession('proj-1');
    await new Promise((r) => setTimeout(r, 10));
    const s3 = await manager.createSession('proj-1');

    const history = await manager.getSessionHistory('proj-1');
    expect(history).toHaveLength(3);
    expect(history[0].id).toBe(s3.id);
    expect(history[2].id).toBe(s1.id);
  });

  // ── Time away calculation ──────────────────────────────────

  test('returns unknown for session without exit timestamp', async () => {
    const session = await manager.createSession('proj-1');

    const timeAway = await manager.calculateTimeAway(session.id);
    expect(timeAway.unit).toBe('unknown');
    expect(timeAway.formatted).toBe('unknown');
  });

  test('returns unknown for non-existent session', async () => {
    const timeAway = await manager.calculateTimeAway('nope');
    expect(timeAway.unit).toBe('unknown');
  });
});

describe('SessionManager.computeTimeAway', () => {
  // ── Minutes (<60 min) ──────────────────────────────────────

  test('displays minutes for duration under 60 minutes', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T10:45:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('minutes');
    expect(result.value).toBe(45);
    expect(result.formatted).toBe('45 minutes');
  });

  test('singular minute', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T10:01:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.formatted).toBe('1 minute');
  });

  test('zero minutes', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T10:00:30Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('minutes');
    expect(result.value).toBe(0);
    expect(result.formatted).toBe('0 minutes');
  });

  // ── Boundary: 59 min → 60 min ─────────────────────────────

  test('59 minutes shows as minutes', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T10:59:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('minutes');
    expect(result.value).toBe(59);
  });

  test('60 minutes shows as hours', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T11:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('hours');
    expect(result.value).toBe(1);
    expect(result.formatted).toBe('1 hour');
  });

  // ── Hours (60min–48h) ──────────────────────────────────────

  test('displays hours for duration between 1 and 48 hours', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-01T14:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('hours');
    expect(result.value).toBe(4);
    expect(result.formatted).toBe('4 hours');
  });

  // ── Boundary: 47h → 48h ───────────────────────────────────

  test('47 hours shows as hours', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-03T09:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('hours');
    expect(result.value).toBe(47);
  });

  test('48 hours shows as days', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-03T10:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('days');
    expect(result.value).toBe(2);
    expect(result.formatted).toBe('2 days');
  });

  // ── Days (>48h) ────────────────────────────────────────────

  test('displays days for duration exceeding 48 hours', () => {
    const exit = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-04T10:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('days');
    expect(result.value).toBe(3);
    expect(result.formatted).toBe('3 days');
  });

  // ── Edge: negative duration ────────────────────────────────

  test('handles current time before exit time', () => {
    const exit = new Date('2025-01-02T10:00:00Z');
    const now = new Date('2025-01-01T10:00:00Z');

    const result = SessionManager.computeTimeAway(exit, now);

    expect(result.unit).toBe('unknown');
  });
});
