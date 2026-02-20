import { BriefingGenerator } from '../../src/lib/briefing/briefing-generator';
import { SessionManager } from '../../src/lib/session/session-manager';
import { MockDataStore } from '../helpers/mock-data-store';
import { Capture, ContextElements } from '../../src/lib/models';

function makeCapture(
  sessionId: string,
  elements: Partial<ContextElements> = {}
): Capture {
  return {
    id: `cap-${Date.now()}`,
    sessionId,
    type: 'quick',
    originalInput: 'test input',
    contextElements: {
      originalInput: 'test input',
      ...elements,
    },
    timestamp: new Date(),
  };
}

describe('BriefingGenerator', () => {
  let store: MockDataStore;
  let sessionManager: SessionManager;
  let generator: BriefingGenerator;

  beforeEach(() => {
    store = new MockDataStore();
    sessionManager = new SessionManager(store);
    generator = new BriefingGenerator(store, sessionManager);
  });

  // ── Complete briefing ──────────────────────────────────────

  test('generates complete briefing with all context elements', async () => {
    const session = await sessionManager.createSession('proj-1');
    const exitTime = new Date(session.entryTime.getTime() + 3_600_000); // 1hr
    await sessionManager.closeSession(session.id, exitTime);

    const capture = makeCapture(session.id, {
      intent: ['debugging auth'],
      lastAction: ['found token issue'],
      openLoops: ['check refresh tokens'],
      nextAction: ['write test'],
    });
    await store.saveCapture(capture);

    const updated = await store.getSession(session.id);
    updated!.captureId = capture.id;
    await store.saveSession(updated!);

    const briefing = await generator.generateBriefing(session.id);

    expect(briefing.sessionId).toBe(session.id);
    expect(briefing.hasCapture).toBe(true);
    expect(briefing.intent).toEqual(['debugging auth']);
    expect(briefing.lastAction).toEqual(['found token issue']);
    expect(briefing.openLoops).toEqual(['check refresh tokens']);
    expect(briefing.nextAction).toEqual(['write test']);
    expect(briefing.missingElements).toHaveLength(0);
    expect(briefing.timeAway).toBeDefined();
    expect(briefing.generatedAt).toBeInstanceOf(Date);
  });

  // ── Partial briefing ──────────────────────────────────────

  test('generates partial briefing with some elements missing', async () => {
    const session = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 60_000)
    );

    const capture = makeCapture(session.id, {
      intent: ['working on API'],
      // lastAction, openLoops, nextAction missing
    });
    await store.saveCapture(capture);

    const updated = await store.getSession(session.id);
    updated!.captureId = capture.id;
    await store.saveSession(updated!);

    const briefing = await generator.generateBriefing(session.id);

    expect(briefing.hasCapture).toBe(true);
    expect(briefing.intent).toEqual(['working on API']);
    expect(briefing.lastAction).toBeUndefined();
    expect(briefing.missingElements).toContain('lastAction');
    expect(briefing.missingElements).toContain('openLoops');
    expect(briefing.missingElements).toContain('nextAction');
    expect(briefing.missingElements).not.toContain('intent');
  });

  // ── No capture briefing ────────────────────────────────────

  test('generates briefing without capture', async () => {
    const session = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 7_200_000) // 2hr
    );

    const briefing = await generator.generateBriefing(session.id);

    expect(briefing.hasCapture).toBe(false);
    expect(briefing.intent).toBeUndefined();
    expect(briefing.lastAction).toBeUndefined();
    expect(briefing.openLoops).toBeUndefined();
    expect(briefing.nextAction).toBeUndefined();
    expect(briefing.missingElements).toHaveLength(4);
    expect(briefing.reconstructionGuidance).toBeDefined();
    expect(briefing.timeAway).toBeDefined();
  });

  // ── Session not found ──────────────────────────────────────

  test('generates error briefing for non-existent session', async () => {
    const briefing = await generator.generateBriefing('nonexistent');

    expect(briefing.hasCapture).toBe(false);
    expect(briefing.timeAway.unit).toBe('unknown');
    expect(briefing.missingElements).toHaveLength(4);
    expect(briefing.reconstructionGuidance).toBeDefined();
  });

  // ── Time away always present ───────────────────────────────

  test('time away is always present in briefing', async () => {
    const session = await sessionManager.createSession('proj-1');
    const briefing = await generator.generateBriefing(session.id);

    expect(briefing.timeAway).toBeDefined();
    expect(briefing.timeAway.formatted).toBeDefined();
  });

  test('time away shows unknown when no exit timestamp', async () => {
    const session = await sessionManager.createSession('proj-1');
    // No closeSession called

    const briefing = await generator.generateBriefing(session.id);

    expect(briefing.timeAway.unit).toBe('unknown');
    expect(briefing.timeAway.formatted).toBe('unknown');
  });

  // ── Performance ────────────────────────────────────────────

  test('briefing generation completes within 5 seconds', async () => {
    const session = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 60_000)
    );

    const capture = makeCapture(session.id, {
      intent: ['test'],
      lastAction: ['test'],
      openLoops: ['test'],
      nextAction: ['test'],
    });
    await store.saveCapture(capture);

    const updated = await store.getSession(session.id);
    updated!.captureId = capture.id;
    await store.saveSession(updated!);

    const start = Date.now();
    await generator.generateBriefing(session.id);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  // ── Project-level briefing ─────────────────────────────────

  test('generates briefing for most recent session of project', async () => {
    const s1 = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      s1.id,
      new Date(s1.entryTime.getTime() + 60_000)
    );

    await new Promise((r) => setTimeout(r, 10));
    const s2 = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      s2.id,
      new Date(s2.entryTime.getTime() + 60_000)
    );

    const briefing = await generator.generateBriefingForProject('proj-1');

    expect(briefing).not.toBeNull();
    expect(briefing!.sessionId).toBe(s2.id);
  });

  test('returns null for project with no sessions', async () => {
    const briefing = await generator.generateBriefingForProject('empty');
    expect(briefing).toBeNull();
  });

  // ── Feedback ───────────────────────────────────────────────

  test('submits and persists feedback', async () => {
    const session = await sessionManager.createSession('proj-1');

    await generator.submitFeedback(session.id, 4);

    const updated = await store.getSession(session.id);
    expect(updated!.feedbackRating).toBe(4);
    expect(updated!.feedbackTime).toBeInstanceOf(Date);
  });

  test('accepts positive and negative feedback', async () => {
    const s1 = await sessionManager.createSession('proj-1');
    const s2 = await sessionManager.createSession('proj-1');

    await generator.submitFeedback(s1.id, 5);
    await generator.submitFeedback(s2.id, 1);

    const r1 = await store.getSession(s1.id);
    const r2 = await store.getSession(s2.id);

    expect(r1!.feedbackRating).toBe(5);
    expect(r2!.feedbackRating).toBe(1);
  });

  // ── Card formatting ────────────────────────────────────────

  test('formats complete briefing card', async () => {
    const session = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 3_600_000)
    );

    const capture = makeCapture(session.id, {
      intent: ['debugging auth'],
      lastAction: ['found token issue'],
      openLoops: ['check refresh tokens'],
      nextAction: ['write test'],
    });
    await store.saveCapture(capture);

    const updated = await store.getSession(session.id);
    updated!.captureId = capture.id;
    await store.saveSession(updated!);

    const briefing = await generator.generateBriefing(session.id);
    const card = generator.formatBriefingCard(briefing);

    expect(card).toContain('RESTART BRIEFING');
    expect(card).toContain('Away for:');
    expect(card).toContain('Intent');
    expect(card).toContain('debugging auth');
    expect(card).toContain('Last Action');
    expect(card).toContain('found token issue');
    expect(card).toContain('Open Loops');
    expect(card).toContain('check refresh tokens');
    expect(card).toContain('Next Action');
    expect(card).toContain('write test');
  });

  test('formats no-capture briefing card', async () => {
    const session = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 172_800_000) // 2 days
    );

    const briefing = await generator.generateBriefing(session.id);
    const card = generator.formatBriefingCard(briefing);

    expect(card).toContain('RESTART BRIEFING');
    expect(card).toContain('No capture available');
    expect(card).toContain('Missing:');
    expect(card).toContain('Tip:');
  });

  // ── Consistent format ─────────────────────────────────────

  test('both complete and partial briefings have consistent structure', async () => {
    const s1 = await sessionManager.createSession('proj-1');
    await sessionManager.closeSession(
      s1.id,
      new Date(s1.entryTime.getTime() + 60_000)
    );

    const capture = makeCapture(s1.id, { intent: ['test'] });
    await store.saveCapture(capture);
    const u1 = await store.getSession(s1.id);
    u1!.captureId = capture.id;
    await store.saveSession(u1!);

    const s2 = await sessionManager.createSession('proj-2');
    await sessionManager.closeSession(
      s2.id,
      new Date(s2.entryTime.getTime() + 60_000)
    );

    const b1 = await generator.generateBriefing(s1.id);
    const b2 = await generator.generateBriefing(s2.id);

    // Both should have the required structural fields
    for (const key of ['sessionId', 'timeAway', 'missingElements', 'hasCapture', 'generatedAt']) {
      expect(b1).toHaveProperty(key);
      expect(b2).toHaveProperty(key);
    }

    // Both cards should have header and dividers
    const card1 = generator.formatBriefingCard(b1);
    const card2 = generator.formatBriefingCard(b2);
    expect(card1).toContain('RESTART BRIEFING');
    expect(card2).toContain('RESTART BRIEFING');
    expect(card1).toContain('Away for:');
    expect(card2).toContain('Away for:');
  });
});
