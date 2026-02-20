import * as fc from 'fast-check';
import { SessionManager } from '../../src/lib/session/session-manager';
import { MockDataStore } from '../helpers/mock-data-store';

describe('Session Properties', () => {
  let store: MockDataStore;
  let manager: SessionManager;

  beforeEach(() => {
    store = new MockDataStore();
    manager = new SessionManager(store);
  });

  // Property 13: Session creation on project start
  // For any project start event, the system should create a new session
  // with a unique ID and entry timestamp.
  test('Property 13: session creation produces unique ID and entry timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        store._reset();
        const session = await manager.createSession(projectId);

        expect(session.id).toBeDefined();
        expect(session.id.length).toBeGreaterThan(0);
        expect(session.projectId).toBe(projectId);
        expect(session.entryTime).toBeInstanceOf(Date);
        expect(session.entryTime.getTime()).toBeLessThanOrEqual(Date.now());
      }),
      { numRuns: 100 }
    );
  });

  // Property 14: Session closure on project exit
  // For any project exit event, the system should close the current
  // session and record an exit timestamp.
  test('Property 14: session closure records exit timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1000, max: 86_400_000 }),
        async (projectId, durationMs) => {
          store._reset();
          const session = await manager.createSession(projectId);
          const exitTime = new Date(session.entryTime.getTime() + durationMs);

          await manager.closeSession(session.id, exitTime);

          const closed = await store.getSession(session.id);
          expect(closed).not.toBeNull();
          expect(closed!.exitTime).toEqual(exitTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 15: Session isolation by project
  // For any two different projects, the session history for one project
  // should not contain sessions from the other project.
  test('Property 15: sessions are isolated by project', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (projA, projB) => {
        // Skip if generated same ID
        fc.pre(projA !== projB);
        store._reset();

        await manager.createSession(projA);
        await manager.createSession(projB);
        await manager.createSession(projA);

        const historyA = await manager.getSessionHistory(projA);
        const historyB = await manager.getSessionHistory(projB);

        expect(historyA).toHaveLength(2);
        expect(historyB).toHaveLength(1);

        for (const s of historyA) {
          expect(s.projectId).toBe(projA);
        }
        for (const s of historyB) {
          expect(s.projectId).toBe(projB);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 16: Most recent session identification
  // For any project with multiple sessions, when returning to that project,
  // the system should identify the session with the most recent entry timestamp.
  test('Property 16: most recent session is identified correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 2, max: 5 }),
        async (projectId, count) => {
          store._reset();

          const sessions = [];
          for (let i = 0; i < count; i++) {
            const s = await manager.createSession(projectId);
            sessions.push(s);
            // Small delay to ensure distinct timestamps
            await new Promise((r) => setTimeout(r, 2));
          }

          const recent = await manager.getMostRecentSession(projectId);
          expect(recent).not.toBeNull();
          // The last created session should be the most recent
          expect(recent!.id).toBe(sessions[sessions.length - 1].id);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 17: Time away calculation from timestamps
  // For any session with an exit timestamp, the time away should be
  // calculated as the difference between the current time and the exit timestamp.
  test('Property 17: time away is calculated correctly from timestamps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // duration in seconds
        (durationSec) => {
          const exit = new Date('2025-01-01T00:00:00Z');
          const current = new Date(exit.getTime() + durationSec * 1000);

          const result = SessionManager.computeTimeAway(exit, current);

          const expectedMinutes = Math.floor(durationSec / 60);
          const expectedHours = Math.floor(durationSec / 3600);
          const expectedDays = Math.floor(durationSec / 86400);

          if (expectedMinutes < 60) {
            expect(result.unit).toBe('minutes');
            expect(result.value).toBe(expectedMinutes);
          } else if (expectedHours < 48) {
            expect(result.unit).toBe('hours');
            expect(result.value).toBe(expectedHours);
          } else {
            expect(result.unit).toBe('days');
            expect(result.value).toBe(expectedDays);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 28: Time away display formatting by duration
  // For any calculated time away, the display format should use minutes
  // if less than 60 minutes, hours if between 60 minutes and 48 hours,
  // and days if exceeding 48 hours.
  test('Property 28: time away formatting uses correct unit boundaries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }), // minutes
        (totalMinutes) => {
          const exit = new Date('2025-01-01T00:00:00Z');
          const current = new Date(exit.getTime() + totalMinutes * 60_000);

          const result = SessionManager.computeTimeAway(exit, current);

          if (totalMinutes < 60) {
            expect(result.unit).toBe('minutes');
            expect(result.formatted).toContain('minute');
          } else if (totalMinutes < 48 * 60) {
            expect(result.unit).toBe('hours');
            expect(result.formatted).toContain('hour');
          } else {
            expect(result.unit).toBe('days');
            expect(result.formatted).toContain('day');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 29: Unknown time away indication
  // For any session without an exit timestamp, the time away should be
  // indicated as unknown.
  test('Property 29: sessions without exit timestamp show unknown time away', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        store._reset();
        const session = await manager.createSession(projectId);
        // Do not close session — no exit timestamp

        const timeAway = await manager.calculateTimeAway(session.id);
        expect(timeAway.unit).toBe('unknown');
        expect(timeAway.formatted).toBe('unknown');
      }),
      { numRuns: 100 }
    );
  });
});
