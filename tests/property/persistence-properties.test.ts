import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataStore } from '../../src/storage/data-store';
import { Session, Capture, ContextElements } from '../../src/models';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reentry-prop-'));
}

function cleanDir(dir: string): void {
  const mainFile = path.join(dir, 'data.json');
  if (fs.existsSync(mainFile)) fs.unlinkSync(mainFile);
  for (let i = 1; i <= 3; i++) {
    const bp = path.join(dir, `data.backup.${i}.json`);
    if (fs.existsSync(bp)) fs.unlinkSync(bp);
  }
}

// ── Generators ───────────────────────────────────────────────

const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  .filter((d) => !isNaN(d.getTime()));

const sessionArb: fc.Arbitrary<Session> = fc
  .record({
    id: fc.uuid(),
    projectId: fc.uuid(),
    entryTime: dateArb,
    exitTime: fc.option(dateArb, { nil: undefined }),
    captureId: fc.option(fc.uuid(), { nil: undefined }),
    feedbackRating: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
    feedbackTime: fc.option(dateArb, { nil: undefined }),
  })
  .filter((s) => {
    if (s.exitTime && s.exitTime < s.entryTime) return false;
    if (s.feedbackTime && !s.feedbackRating) return false;
    return true;
  });

const contextElementsArb: fc.Arbitrary<ContextElements> = fc.record({
  intent: fc.option(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), {
    nil: undefined,
  }),
  lastAction: fc.option(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), {
    nil: undefined,
  }),
  openLoops: fc.option(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), {
    nil: undefined,
  }),
  nextAction: fc.option(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), {
    nil: undefined,
  }),
  originalInput: fc.string({ minLength: 1 }),
});

const captureArb: fc.Arbitrary<Capture> = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  type: fc.constantFrom('quick' as const, 'interrupt' as const),
  originalInput: fc.string({ minLength: 1 }),
  contextElements: contextElementsArb,
  timestamp: dateArb,
});

// ── Property Tests ───────────────────────────────────────────

describe('Persistence Properties', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Property 30: Data persistence round-trip
  // For any session or capture data that is persisted, after application
  // restart the loaded data should match the original data.
  test('Property 30: session data survives save/load round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArb, async (session) => {
        cleanDir(dir);

        const store = new DataStore(dir);
        await store.saveSession(session);
        await store.save();

        const store2 = new DataStore(dir);
        await store2.load();

        const loaded = await store2.getSession(session.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(session.id);
        expect(loaded!.projectId).toBe(session.projectId);
        expect(loaded!.entryTime.getTime()).toBe(session.entryTime.getTime());

        if (session.exitTime) {
          expect(loaded!.exitTime!.getTime()).toBe(session.exitTime.getTime());
        } else {
          expect(loaded!.exitTime).toBeUndefined();
        }

        if (session.feedbackRating !== undefined) {
          expect(loaded!.feedbackRating).toBe(session.feedbackRating);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 30 (continued): capture round-trip
  test('Property 30: capture data survives save/load round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(captureArb, async (capture) => {
        cleanDir(dir);

        const store = new DataStore(dir);
        await store.saveCapture(capture);
        await store.save();

        const store2 = new DataStore(dir);
        await store2.load();

        const loaded = await store2.getCapture(capture.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(capture.id);
        expect(loaded!.sessionId).toBe(capture.sessionId);
        expect(loaded!.type).toBe(capture.type);
        expect(loaded!.originalInput).toBe(capture.originalInput);
        expect(loaded!.timestamp.getTime()).toBe(capture.timestamp.getTime());
      }),
      { numRuns: 100 }
    );
  });

  // Property 31: Persistence failure notification
  // For any data persistence operation that fails, the system should
  // notify the user of the failure.
  test('Property 31: persistence failures trigger notification', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArb, async (session) => {
        // Use a non-writable path to force failure
        const badDir = path.join(dir, 'readonly-' + session.id.replace(/[^a-z0-9-]/gi, ''));
        fs.mkdirSync(badDir, { recursive: true });
        fs.chmodSync(badDir, 0o444);

        const store = new DataStore(badDir);
        let notified = false;
        store.onFailure(() => {
          notified = true;
        });

        await store.saveSession(session);

        try {
          await store.save();
        } catch {
          // Expected
        }

        expect(notified).toBe(true);

        // Restore permissions for cleanup
        fs.chmodSync(badDir, 0o755);
      }),
      { numRuns: 20 }
    );
  });
});
