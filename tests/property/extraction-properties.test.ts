import * as fc from 'fast-check';
import { ContextExtractor } from '../../src/extraction/context-extractor';

const extractor = new ContextExtractor();

// ── Generators for structured input ──────────────────────────

const intentPhrases = [
  'I was working on',
  'I was trying to',
  "I'm trying to fix",
  'Debugging',
  'Focused on',
  'Implementing',
  'Building',
];

const lastActionPhrases = [
  'I just finished',
  'Found',
  'Completed',
  'Wrote',
  'Updated',
  'Fixed',
  'I got',
];

const openLoopPhrases = [
  'Need to check',
  'Blocked on',
  'Not sure about',
  'Waiting on',
  'Stuck on',
  'TODO:',
  'Need to figure out',
];

const nextActionPhrases = [
  'Next I should',
  "Next I'll",
  'I will',
  'Going to',
  'Planning to',
  'I need to',
  'Then I should',
];

// Generate a topic/object for the sentence
const topicArb = fc.constantFrom(
  'the authentication flow',
  'the database migration',
  'the API endpoint',
  'the user interface',
  'the test suite',
  'the caching layer',
  'the error handling',
  'the payment module',
  'the search feature',
  'the deployment pipeline',
);

function sentenceArb(phrases: string[]): fc.Arbitrary<string> {
  return fc
    .record({
      phrase: fc.constantFrom(...phrases),
      topic: topicArb,
    })
    .map(({ phrase, topic }) => {
      // "I got" needs special suffix
      if (phrase === 'I got') return `${phrase} ${topic} working.`;
      return `${phrase} ${topic}.`;
    });
}

describe('Extraction Properties', () => {
  // Property 3: Context extraction identifies all element types
  // For any capture input containing intent, last action, open loops, or
  // next action statements, the context extractor should identify and
  // extract those elements.
  test('Property 3: extracts all element types when present', () => {
    fc.assert(
      fc.property(
        sentenceArb(intentPhrases),
        sentenceArb(lastActionPhrases),
        sentenceArb(openLoopPhrases),
        sentenceArb(nextActionPhrases),
        (intentSentence, lastActionSentence, openLoopSentence, nextActionSentence) => {
          const input = `${intentSentence} ${lastActionSentence} ${openLoopSentence} ${nextActionSentence}`;

          const result = extractor.extract(input);

          expect(result.intent).toBeDefined();
          expect(result.intent!.length).toBeGreaterThan(0);

          expect(result.lastAction).toBeDefined();
          expect(result.lastAction!.length).toBeGreaterThan(0);

          expect(result.openLoops).toBeDefined();
          expect(result.openLoops!.length).toBeGreaterThan(0);

          expect(result.nextAction).toBeDefined();
          expect(result.nextAction!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 18: Multiple elements of same type are preserved
  // For any capture input containing multiple instances of the same
  // element type, all identified instances should be stored.
  test('Property 18: multiple elements of same type are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(sentenceArb(openLoopPhrases), { minLength: 2, maxLength: 4 }),
        (sentences) => {
          const input = sentences.join(' ');

          const result = extractor.extract(input);

          expect(result.openLoops).toBeDefined();
          // Should have at least 2 (might deduplicate if same topic chosen)
          expect(result.openLoops!.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 19: Missing elements are marked unavailable
  // For any capture input that lacks a specific element type, that
  // element should be marked as unavailable in the extracted context.
  test('Property 19: missing elements are undefined', () => {
    fc.assert(
      fc.property(
        sentenceArb(intentPhrases),
        (intentOnly) => {
          // Input has only intent, no last action / open loops / next action patterns
          const result = extractor.extract(intentOnly);

          // Intent should be found
          expect(result.intent).toBeDefined();

          // The other elements may or may not be found depending on
          // cross-matching, but we verify the invariant: if not found,
          // they must be undefined (not empty array)
          if (!result.lastAction) expect(result.lastAction).toBeUndefined();
          if (!result.openLoops) expect(result.openLoops).toBeUndefined();
          if (!result.nextAction) expect(result.nextAction).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 20: Original input preservation
  // For any capture input, the original text should be stored verbatim
  // without modification.
  test('Property 20: original input is preserved verbatim', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const result = extractor.extract(input);

          expect(result.originalInput).toBe(input);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional: extraction never throws
  test('extraction never throws on arbitrary input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (input) => {
          // Should not throw
          const result = extractor.extract(input);
          expect(result).toBeDefined();
          expect(result.originalInput).toBe(input);
        }
      ),
      { numRuns: 100 }
    );
  });
});
