import * as fc from 'fast-check';
import { BriefingGenerator } from '../../src/lib/briefing/briefing-generator';
import { SessionManager } from '../../src/lib/session/session-manager';
import { MockDataStore } from '../helpers/mock-data-store';
import { Capture, ContextElements } from '../../src/lib/models';

function setup() {
  const store = new MockDataStore();
  const sessionManager = new SessionManager(store);
  const generator = new BriefingGenerator(store, sessionManager);
  return { store, sessionManager, generator };
}

// ── Generators ───────────────────────────────────────────────

const elementArrayArb = fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
  minLength: 1,
  maxLength: 3,
});

const contextElementsArb = fc.record({
  intent: fc.option(elementArrayArb, { nil: undefined }),
  lastAction: fc.option(elementArrayArb, { nil: undefined }),
  openLoops: fc.option(elementArrayArb, { nil: undefined }),
  nextAction: fc.option(elementArrayArb, { nil: undefined }),
  originalInput: fc.string({ minLength: 1 }),
});

describe('Briefing Properties', () => {
  // Property 8: Briefing is generated on session return
  // For any session return event, the briefing generator should create
  // a restart briefing.
  test('Property 8: briefing is always generated for any session', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { store, sessionManager, generator } = setup();
        const session = await sessionManager.createSession(projectId);

        const briefing = await generator.generateBriefing(session.id);

        expect(briefing).toBeDefined();
        expect(briefing.sessionId).toBe(session.id);
        expect(briefing.generatedAt).toBeInstanceOf(Date);
      }),
      { numRuns: 100 }
    );
  });

  // Property 9: Briefing displays captured context elements
  // For any restart briefing where context elements were captured,
  // those elements should be displayed in the briefing.
  test('Property 9: captured context elements appear in briefing', async () => {
    await fc.assert(
      fc.asyncProperty(contextElementsArb, async (elements) => {
        const { store, sessionManager, generator } = setup();
        const session = await sessionManager.createSession('proj-1');
        await sessionManager.closeSession(
          session.id,
          new Date(session.entryTime.getTime() + 60_000)
        );

        const capture: Capture = {
          id: `cap-${Date.now()}-${Math.random()}`,
          sessionId: session.id,
          type: 'quick',
          originalInput: elements.originalInput,
          contextElements: elements,
          timestamp: new Date(),
        };
        await store.saveCapture(capture);

        const updated = await store.getSession(session.id);
        updated!.captureId = capture.id;
        await store.saveSession(updated!);

        const briefing = await generator.generateBriefing(session.id);

        expect(briefing.hasCapture).toBe(true);

        if (elements.intent) {
          expect(briefing.intent).toEqual(elements.intent);
        }
        if (elements.lastAction) {
          expect(briefing.lastAction).toEqual(elements.lastAction);
        }
        if (elements.openLoops) {
          expect(briefing.openLoops).toEqual(elements.openLoops);
        }
        if (elements.nextAction) {
          expect(briefing.nextAction).toEqual(elements.nextAction);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 10: Briefing always displays time away
  // For any restart briefing, the time away should be displayed
  // regardless of whether other context elements are available.
  test('Property 10: time away is always present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.boolean(), // whether to add a capture
        async (projectId, withCapture) => {
          const { store, sessionManager, generator } = setup();
          const session = await sessionManager.createSession(projectId);
          await sessionManager.closeSession(
            session.id,
            new Date(session.entryTime.getTime() + 60_000)
          );

          if (withCapture) {
            const capture: Capture = {
              id: `cap-${Date.now()}-${Math.random()}`,
              sessionId: session.id,
              type: 'quick',
              originalInput: 'test',
              contextElements: { originalInput: 'test', intent: ['test'] },
              timestamp: new Date(),
            };
            await store.saveCapture(capture);
            const updated = await store.getSession(session.id);
            updated!.captureId = capture.id;
            await store.saveSession(updated!);
          }

          const briefing = await generator.generateBriefing(session.id);

          expect(briefing.timeAway).toBeDefined();
          expect(briefing.timeAway.formatted).toBeDefined();
          expect(typeof briefing.timeAway.formatted).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 11: Briefing indicates missing context
  // For any session without a capture, the generated briefing should
  // indicate that context is missing.
  test('Property 11: no-capture sessions indicate missing context', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { sessionManager, generator } = setup();
        const session = await sessionManager.createSession(projectId);

        const briefing = await generator.generateBriefing(session.id);

        expect(briefing.hasCapture).toBe(false);
        expect(briefing.missingElements.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  // Property 12: Briefing generation meets time constraint
  // For any briefing generation operation, the time from re-entry to
  // briefing display should not exceed 5 seconds.
  test('Property 12: briefing generation completes in <5s', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { sessionManager, generator } = setup();
        const session = await sessionManager.createSession(projectId);

        const start = Date.now();
        await generator.generateBriefing(session.id);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000);
      }),
      { numRuns: 100 }
    );
  });

  // Property 26: Feedback mechanism availability
  // For any displayed restart briefing, an accuracy feedback mechanism
  // should be available to the user.
  test('Property 26: feedback can be submitted for any session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (projectId, rating) => {
          const { store, sessionManager, generator } = setup();
          const session = await sessionManager.createSession(projectId);

          // Should not throw — feedback mechanism is available
          await generator.submitFeedback(session.id, rating);

          const updated = await store.getSession(session.id);
          expect(updated!.feedbackRating).toBe(rating);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 27: Feedback acceptance and storage
  // For any feedback submission, the system should accept it, associate
  // it with the session, store the rating, and record a timestamp.
  test('Property 27: feedback is stored with session and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (projectId, rating) => {
          const { store, sessionManager, generator } = setup();
          const session = await sessionManager.createSession(projectId);
          const before = new Date();

          await generator.submitFeedback(session.id, rating);

          const updated = await store.getSession(session.id);
          expect(updated).not.toBeNull();
          expect(updated!.feedbackRating).toBe(rating);
          expect(updated!.feedbackTime).toBeInstanceOf(Date);
          expect(updated!.feedbackTime!.getTime()).toBeGreaterThanOrEqual(
            before.getTime()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 32: Partial briefing generation without capture
  // For any session without a capture, the system should still generate
  // a partial briefing with available information.
  test('Property 32: partial briefing generated for sessions without capture', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { sessionManager, generator } = setup();
        const session = await sessionManager.createSession(projectId);
        await sessionManager.closeSession(
          session.id,
          new Date(session.entryTime.getTime() + 60_000)
        );

        const briefing = await generator.generateBriefing(session.id);

        expect(briefing).toBeDefined();
        expect(briefing.hasCapture).toBe(false);
        expect(briefing.timeAway).toBeDefined();
        expect(briefing.generatedAt).toBeInstanceOf(Date);
      }),
      { numRuns: 100 }
    );
  });

  // Property 33: Missing elements indication in briefing
  // For any briefing with unavailable context elements, the briefing
  // should explicitly indicate which elements are missing.
  test('Property 33: missing elements are explicitly listed', async () => {
    await fc.assert(
      fc.asyncProperty(contextElementsArb, async (elements) => {
        const { store, sessionManager, generator } = setup();
        const session = await sessionManager.createSession('proj-1');
        await sessionManager.closeSession(
          session.id,
          new Date(session.entryTime.getTime() + 60_000)
        );

        const capture: Capture = {
          id: `cap-${Date.now()}-${Math.random()}`,
          sessionId: session.id,
          type: 'quick',
          originalInput: elements.originalInput,
          contextElements: elements,
          timestamp: new Date(),
        };
        await store.saveCapture(capture);
        const updated = await store.getSession(session.id);
        updated!.captureId = capture.id;
        await store.saveSession(updated!);

        const briefing = await generator.generateBriefing(session.id);

        // Every undefined element should appear in missingElements
        if (!elements.intent) expect(briefing.missingElements).toContain('intent');
        if (!elements.lastAction) expect(briefing.missingElements).toContain('lastAction');
        if (!elements.openLoops) expect(briefing.missingElements).toContain('openLoops');
        if (!elements.nextAction) expect(briefing.missingElements).toContain('nextAction');

        // Every defined element should NOT appear in missingElements
        if (elements.intent) expect(briefing.missingElements).not.toContain('intent');
        if (elements.lastAction) expect(briefing.missingElements).not.toContain('lastAction');
        if (elements.openLoops) expect(briefing.missingElements).not.toContain('openLoops');
        if (elements.nextAction) expect(briefing.missingElements).not.toContain('nextAction');
      }),
      { numRuns: 100 }
    );
  });

  // Property 34: Available elements display in partial briefing
  // For any briefing with some available and some unavailable elements,
  // all available elements should be displayed.
  test('Property 34: available elements are displayed even when others are missing', async () => {
    await fc.assert(
      fc.asyncProperty(contextElementsArb, async (elements) => {
        const { store, sessionManager, generator } = setup();
        const session = await sessionManager.createSession('proj-1');
        await sessionManager.closeSession(
          session.id,
          new Date(session.entryTime.getTime() + 60_000)
        );

        const capture: Capture = {
          id: `cap-${Date.now()}-${Math.random()}`,
          sessionId: session.id,
          type: 'quick',
          originalInput: elements.originalInput,
          contextElements: elements,
          timestamp: new Date(),
        };
        await store.saveCapture(capture);
        const updated = await store.getSession(session.id);
        updated!.captureId = capture.id;
        await store.saveSession(updated!);

        const briefing = await generator.generateBriefing(session.id);

        if (elements.intent) expect(briefing.intent).toEqual(elements.intent);
        if (elements.lastAction) expect(briefing.lastAction).toEqual(elements.lastAction);
        if (elements.openLoops) expect(briefing.openLoops).toEqual(elements.openLoops);
        if (elements.nextAction) expect(briefing.nextAction).toEqual(elements.nextAction);
      }),
      { numRuns: 100 }
    );
  });

  // Property 35: Retroactive reconstruction guidance
  // For any briefing generated without a capture, the briefing should
  // provide guidance on retroactive reconstruction.
  test('Property 35: no-capture briefings include reconstruction guidance', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { sessionManager, generator } = setup();
        const session = await sessionManager.createSession(projectId);

        const briefing = await generator.generateBriefing(session.id);

        expect(briefing.hasCapture).toBe(false);
        expect(briefing.reconstructionGuidance).toBeDefined();
        expect(typeof briefing.reconstructionGuidance).toBe('string');
        expect(briefing.reconstructionGuidance!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  // Property 36: Consistent briefing format
  // For any briefing (complete or partial), the visual format structure
  // should remain consistent regardless of which elements are present.
  test('Property 36: briefing format is consistent across types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.boolean(),
        async (projectId, withCapture) => {
          const { store, sessionManager, generator } = setup();
          const session = await sessionManager.createSession(projectId);
          await sessionManager.closeSession(
            session.id,
            new Date(session.entryTime.getTime() + 60_000)
          );

          if (withCapture) {
            const capture: Capture = {
              id: `cap-${Date.now()}-${Math.random()}`,
              sessionId: session.id,
              type: 'quick',
              originalInput: 'test',
              contextElements: { originalInput: 'test', intent: ['test'] },
              timestamp: new Date(),
            };
            await store.saveCapture(capture);
            const updated = await store.getSession(session.id);
            updated!.captureId = capture.id;
            await store.saveSession(updated!);
          }

          const briefing = await generator.generateBriefing(session.id);

          // Structural consistency: same keys present
          expect(briefing).toHaveProperty('sessionId');
          expect(briefing).toHaveProperty('timeAway');
          expect(briefing).toHaveProperty('missingElements');
          expect(briefing).toHaveProperty('hasCapture');
          expect(briefing).toHaveProperty('generatedAt');

          // Card format consistency
          const card = generator.formatBriefingCard(briefing);
          expect(card).toContain('RESTART BRIEFING');
          expect(card).toContain('Away for:');
        }
      ),
      { numRuns: 100 }
    );
  });
});
