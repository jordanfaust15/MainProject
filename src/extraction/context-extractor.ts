import { ContextElements } from '../models';

/**
 * Pattern definitions for each context element type.
 * Each pattern has a regex and a group index for the extracted value.
 */
interface PatternDef {
  regex: RegExp;
  group: number;
}

// ── Intent patterns ──────────────────────────────────────────
// Captures what the user was trying to accomplish.

const INTENT_PATTERNS: PatternDef[] = [
  { regex: /I was (?:trying to |working on |attempting to )(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:my |the )?goal (?:is|was) (?:to )?(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:my |the )?intent(?:ion)? (?:is|was) (?:to )?(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /I(?:'m| am) (?:trying to |working on |attempting to )(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:focused on|focusing on) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:building|implementing|creating|developing|designing) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:debugging|fixing|investigating|troubleshooting) (.+?)(?:\.|,|;|$)/gi, group: 1 },
];

// ── Last action patterns ────────────────────────────────────
// Captures the last thing the user completed.

const LAST_ACTION_PATTERNS: PatternDef[] = [
  { regex: /(?:I )?(?:just |already )?(?:finished|completed|done with) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:I )?(?:just )?(?:found|discovered|identified|noticed) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:I )?(?:just )?(?:wrote|created|added|updated|modified|changed|fixed|refactored) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /last (?:thing I did|action|step) (?:was |is )(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:I )?got (.+?) working/gi, group: 1 },
];

// ── Open loop patterns ──────────────────────────────────────
// Captures unresolved questions, blockers, or pending decisions.

const OPEN_LOOP_PATTERNS: PatternDef[] = [
  { regex: /(?:I )?(?:still )?need to (?:figure out|check|verify|confirm|investigate|look into|understand) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:blocked on|waiting (?:on|for)|stuck on|unsure about) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:not sure|uncertain|unclear) (?:about |if |whether |how )(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:question|concern|issue|problem|worry)(?: is)? (?:about |with |whether |if )?(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:haven't|have not) (?:yet )?(?:figured out|decided|resolved|determined) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:open (?:question|item|issue|loop))(?: is)?:? (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:TODO|to-do|to do):? (.+?)(?:\.|,|;|$)/gi, group: 1 },
];

// ── Next action patterns ────────────────────────────────────
// Captures what the user planned to do next.

const NEXT_ACTION_PATTERNS: PatternDef[] = [
  { regex: /next (?:I(?:'ll| will| should| need to)?|step is(?: to)?|action is(?: to)?) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:I(?:'ll| will| should| need to| want to| plan to| am going to)) (.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:then|after that|afterwards) (?:I(?:'ll| will| should| need to)? )?(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:plan|planning) (?:is )?(?:to )?(.+?)(?:\.|,|;|$)/gi, group: 1 },
  { regex: /(?:going to|gonna) (.+?)(?:\.|,|;|$)/gi, group: 1 },
];

/**
 * Run all patterns of a given type against the input and collect unique matches.
 */
function extractWithPatterns(
  input: string,
  patterns: PatternDef[]
): string[] | undefined {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const { regex, group } of patterns) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input)) !== null) {
      const value = match[group]?.trim();
      if (value && !seen.has(value.toLowerCase())) {
        seen.add(value.toLowerCase());
        results.push(value);
      }
    }
  }

  return results.length > 0 ? results : undefined;
}

export class ContextExtractor {
  /**
   * Extract context elements from free-form input text.
   * Uses pattern matching to identify intent, last action, open loops, and next action.
   * Original input is always preserved verbatim.
   */
  extract(input: string): ContextElements {
    const intent = extractWithPatterns(input, INTENT_PATTERNS);
    const lastAction = extractWithPatterns(input, LAST_ACTION_PATTERNS);
    const openLoops = extractWithPatterns(input, OPEN_LOOP_PATTERNS);
    const nextAction = extractWithPatterns(input, NEXT_ACTION_PATTERNS);

    return {
      intent,
      lastAction,
      openLoops,
      nextAction,
      originalInput: input,
    };
  }
}
