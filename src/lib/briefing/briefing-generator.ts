import { RestartBriefing, TimeAwayDisplay } from '../models';
import { IDataStore } from '../storage';
import { SessionManager } from '../session';

const CONTEXT_ELEMENT_NAMES = ['intent', 'lastAction', 'openLoops', 'nextAction'] as const;

const DEFAULT_RECONSTRUCTION_GUIDANCE =
  'Review recent commits, open files, or notes to reconstruct your working context.';

export class BriefingGenerator {
  constructor(
    private readonly store: IDataStore,
    private readonly sessionManager: SessionManager
  ) {}

  /**
   * Generate a restart briefing for the given session.
   * Must complete within 5 seconds.
   */
  async generateBriefing(sessionId: string): Promise<RestartBriefing> {
    const session = await this.store.getSession(sessionId);

    if (!session) {
      return this.buildErrorBriefing(sessionId, 'Session not found');
    }

    const timeAway = session.exitTime
      ? SessionManager.computeTimeAway(session.exitTime, new Date())
      : { value: 0, unit: 'unknown' as const, formatted: 'unknown' };

    // No capture associated
    if (!session.captureId) {
      return this.buildNoCapttureBriefing(sessionId, timeAway);
    }

    const capture = await this.store.getCapture(session.captureId);

    if (!capture) {
      return this.buildNoCapttureBriefing(sessionId, timeAway);
    }

    // Build full briefing from capture data
    const { contextElements } = capture;
    const missingElements = CONTEXT_ELEMENT_NAMES.filter(
      (name) => !contextElements[name] || contextElements[name]!.length === 0
    );

    return {
      sessionId,
      intent: contextElements.intent,
      lastAction: contextElements.lastAction,
      openLoops: contextElements.openLoops,
      nextAction: contextElements.nextAction,
      timeAway,
      missingElements,
      hasCapture: true,
      reconstructionGuidance:
        missingElements.length > 0 ? DEFAULT_RECONSTRUCTION_GUIDANCE : undefined,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate a briefing for the most recent session of a project.
   */
  async generateBriefingForProject(
    projectId: string
  ): Promise<RestartBriefing | null> {
    const session = await this.sessionManager.getMostRecentSession(projectId);
    if (!session) return null;
    return this.generateBriefing(session.id);
  }

  // ── Feedback ───────────────────────────────────────────────

  /**
   * Submit accuracy feedback for a briefing's session.
   */
  async submitFeedback(
    sessionId: string,
    rating: number
  ): Promise<void> {
    await this.store.saveFeedback(sessionId, rating, new Date());
    await this.store.immediateSave();
  }

  // ── Formatting ─────────────────────────────────────────────

  /**
   * Format a briefing as a text card for display.
   */
  formatBriefingCard(briefing: RestartBriefing): string {
    const lines: string[] = [];
    const width = 45;
    const hr = '-'.repeat(width);

    lines.push(hr);
    lines.push('RESTART BRIEFING');
    lines.push(`Away for: ${briefing.timeAway.formatted}`);
    lines.push(hr);

    if (!briefing.hasCapture) {
      lines.push('');
      lines.push('No capture available.');
      lines.push('');
      if (briefing.missingElements.length > 0) {
        lines.push(`Missing: ${briefing.missingElements.join(', ')}`);
        lines.push('');
      }
      if (briefing.reconstructionGuidance) {
        lines.push(`Tip: ${briefing.reconstructionGuidance}`);
      }
    } else {
      if (briefing.intent) {
        lines.push('');
        lines.push('Intent');
        for (const item of briefing.intent) {
          lines.push(`  ${item}`);
        }
      }

      if (briefing.lastAction) {
        lines.push('');
        lines.push('Last Action');
        for (const item of briefing.lastAction) {
          lines.push(`  ${item}`);
        }
      }

      if (briefing.openLoops) {
        lines.push('');
        lines.push('Open Loops');
        for (const item of briefing.openLoops) {
          lines.push(`  - ${item}`);
        }
      }

      if (briefing.nextAction) {
        lines.push('');
        lines.push('Next Action');
        for (const item of briefing.nextAction) {
          lines.push(`  ${item}`);
        }
      }

      if (briefing.missingElements.length > 0) {
        lines.push('');
        lines.push(`Missing: ${briefing.missingElements.join(', ')}`);
      }
    }

    lines.push(hr);
    return lines.join('\n');
  }

  // ── Private helpers ────────────────────────────────────────

  private buildNoCapttureBriefing(
    sessionId: string,
    timeAway: TimeAwayDisplay
  ): RestartBriefing {
    return {
      sessionId,
      timeAway,
      missingElements: [...CONTEXT_ELEMENT_NAMES],
      hasCapture: false,
      reconstructionGuidance: DEFAULT_RECONSTRUCTION_GUIDANCE,
      generatedAt: new Date(),
    };
  }

  private buildErrorBriefing(
    sessionId: string,
    _error: string
  ): RestartBriefing {
    return {
      sessionId,
      timeAway: { value: 0, unit: 'unknown', formatted: 'unknown' },
      missingElements: [...CONTEXT_ELEMENT_NAMES],
      hasCapture: false,
      reconstructionGuidance: DEFAULT_RECONSTRUCTION_GUIDANCE,
      generatedAt: new Date(),
    };
  }
}
