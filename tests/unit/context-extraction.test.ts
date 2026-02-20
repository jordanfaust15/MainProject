import { ContextExtractor } from '../../src/lib/extraction/context-extractor';

describe('ContextExtractor', () => {
  let extractor: ContextExtractor;

  beforeEach(() => {
    extractor = new ContextExtractor();
  });

  // ── Well-formed input ──────────────────────────────────────

  test('extracts all elements from well-formed input', () => {
    const input =
      'I was debugging the authentication flow. Found the token expiry issue. ' +
      'Need to check if refresh tokens are working correctly. ' +
      "Next I should write a test for the refresh flow.";

    const result = extractor.extract(input);

    expect(result.intent).toBeDefined();
    expect(result.intent!.some((i) => i.toLowerCase().includes('authentication'))).toBe(true);

    expect(result.lastAction).toBeDefined();
    expect(result.lastAction!.some((a) => a.toLowerCase().includes('token'))).toBe(true);

    expect(result.openLoops).toBeDefined();
    expect(result.openLoops!.some((o) => o.toLowerCase().includes('refresh token'))).toBe(true);

    expect(result.nextAction).toBeDefined();
    expect(result.nextAction!.some((n) => n.toLowerCase().includes('test'))).toBe(true);
  });

  // ── Intent extraction ──────────────────────────────────────

  test('extracts intent from "I was working on" phrasing', () => {
    const result = extractor.extract('I was working on the user login page.');
    expect(result.intent).toBeDefined();
    expect(result.intent!.length).toBeGreaterThan(0);
  });

  test('extracts intent from "I am trying to" phrasing', () => {
    const result = extractor.extract("I'm trying to fix the API timeout.");
    expect(result.intent).toBeDefined();
  });

  test('extracts intent from "debugging" phrasing', () => {
    const result = extractor.extract('Debugging the payment processing module.');
    expect(result.intent).toBeDefined();
  });

  test('extracts intent from "focused on" phrasing', () => {
    const result = extractor.extract('Focused on improving query performance.');
    expect(result.intent).toBeDefined();
  });

  // ── Last action extraction ─────────────────────────────────

  test('extracts last action from "just finished" phrasing', () => {
    const result = extractor.extract('I just finished the database migration.');
    expect(result.lastAction).toBeDefined();
  });

  test('extracts last action from "found" phrasing', () => {
    const result = extractor.extract('Found the root cause of the memory leak.');
    expect(result.lastAction).toBeDefined();
  });

  test('extracts last action from "wrote" phrasing', () => {
    const result = extractor.extract('Wrote the unit tests for the parser.');
    expect(result.lastAction).toBeDefined();
  });

  test('extracts last action from "got X working" phrasing', () => {
    const result = extractor.extract('I got the websocket connection working.');
    expect(result.lastAction).toBeDefined();
  });

  // ── Open loop extraction ───────────────────────────────────

  test('extracts open loops from "need to check" phrasing', () => {
    const result = extractor.extract('Need to check if the cache invalidation works.');
    expect(result.openLoops).toBeDefined();
  });

  test('extracts open loops from "blocked on" phrasing', () => {
    const result = extractor.extract('Blocked on the API credentials from the team.');
    expect(result.openLoops).toBeDefined();
  });

  test('extracts open loops from "not sure" phrasing', () => {
    const result = extractor.extract('Not sure if we should use Redis or Memcached.');
    expect(result.openLoops).toBeDefined();
  });

  test('extracts open loops from "TODO" phrasing', () => {
    const result = extractor.extract('TODO: review the error handling in the upload flow.');
    expect(result.openLoops).toBeDefined();
  });

  // ── Next action extraction ─────────────────────────────────

  test('extracts next action from "next I should" phrasing', () => {
    const result = extractor.extract('Next I should implement the retry logic.');
    expect(result.nextAction).toBeDefined();
  });

  test('extracts next action from "I will" phrasing', () => {
    const result = extractor.extract('I will add error handling to the API layer.');
    expect(result.nextAction).toBeDefined();
  });

  test('extracts next action from "plan to" phrasing', () => {
    const result = extractor.extract('Planning to refactor the data access layer.');
    expect(result.nextAction).toBeDefined();
  });

  test('extracts next action from "going to" phrasing', () => {
    const result = extractor.extract('Going to write integration tests next.');
    expect(result.nextAction).toBeDefined();
  });

  // ── Missing elements ──────────────────────────────────────

  test('handles input with only intent', () => {
    const result = extractor.extract('I was working on the search feature.');

    expect(result.intent).toBeDefined();
    expect(result.lastAction).toBeUndefined();
    expect(result.openLoops).toBeUndefined();
    expect(result.nextAction).toBeUndefined();
  });

  test('handles minimal input', () => {
    const result = extractor.extract('Stuff.');

    expect(result.originalInput).toBe('Stuff.');
    // May or may not extract elements — the key is it doesn't crash
  });

  test('handles empty-ish input', () => {
    const result = extractor.extract('   ');

    expect(result.originalInput).toBe('   ');
    expect(result.intent).toBeUndefined();
    expect(result.lastAction).toBeUndefined();
    expect(result.openLoops).toBeUndefined();
    expect(result.nextAction).toBeUndefined();
  });

  // ── Original input preservation ────────────────────────────

  test('preserves original input verbatim', () => {
    const input = 'Test input with  extra   spaces!  \n\tand tabs';

    const result = extractor.extract(input);

    expect(result.originalInput).toBe(input);
  });

  test('preserves input with special characters', () => {
    const input = 'Working on <div> & "quotes" — em-dash…ellipsis';

    const result = extractor.extract(input);

    expect(result.originalInput).toBe(input);
  });

  // ── Multiple elements of same type ─────────────────────────

  test('extracts multiple open loops', () => {
    const input =
      'Blocked on the API key. ' +
      'Need to check the database schema. ' +
      'Not sure about the error format.';

    const result = extractor.extract(input);

    expect(result.openLoops).toBeDefined();
    expect(result.openLoops!.length).toBeGreaterThanOrEqual(2);
  });

  test('extracts multiple last actions', () => {
    const input =
      'Fixed the login bug. ' +
      'Updated the user model. ' +
      'Added validation to the form.';

    const result = extractor.extract(input);

    expect(result.lastAction).toBeDefined();
    expect(result.lastAction!.length).toBeGreaterThanOrEqual(2);
  });

  // ── Deduplication ──────────────────────────────────────────

  test('deduplicates identical matches', () => {
    const input = 'I was working on the API. Focused on the api.';

    const result = extractor.extract(input);

    // Should not have duplicate "the API" / "the api"
    if (result.intent) {
      const lowered = result.intent.map((i) => i.toLowerCase());
      const unique = new Set(lowered);
      expect(unique.size).toBe(lowered.length);
    }
  });
});
