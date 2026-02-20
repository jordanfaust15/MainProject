'use client';

import type { RestartBriefing } from '@/lib/models';
import { FeedbackBar } from './FeedbackBar';

interface BriefingCardProps {
  briefing: RestartBriefing;
  onFeedback: (sessionId: string, rating: number) => void;
}

function BriefingElement({
  label,
  className,
  items,
}: {
  label: string;
  className: string;
  items: string[];
}) {
  return (
    <div className="briefing-element">
      <div className={`label ${className}`}>{label}</div>
      <div className="value">
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BriefingCard({ briefing, onFeedback }: BriefingCardProps) {
  return (
    <div className="briefing-card">
      <div className="briefing-header">
        <h2>RESTART BRIEFING</h2>
        <span className="time-away">Away: {briefing.timeAway.formatted}</span>
      </div>
      <div className="briefing-body">
        {!briefing.hasCapture ? (
          <div className="no-capture">
            <div className="icon">?</div>
            <div>No capture available for this session.</div>
          </div>
        ) : (
          <>
            {briefing.intent && (
              <BriefingElement label="Intent" className="intent" items={briefing.intent} />
            )}
            {briefing.lastAction && (
              <BriefingElement label="Last Action" className="last-action" items={briefing.lastAction} />
            )}
            {briefing.openLoops && (
              <BriefingElement label="Open Loops" className="open-loops" items={briefing.openLoops} />
            )}
            {briefing.nextAction && (
              <BriefingElement label="Next Action" className="next-action" items={briefing.nextAction} />
            )}
          </>
        )}
      </div>
      {briefing.missingElements.length > 0 && (
        <div className="missing-elements">
          Missing: {briefing.missingElements.join(', ')}
        </div>
      )}
      {briefing.reconstructionGuidance && (
        <div className="reconstruction-tip">
          Tip: {briefing.reconstructionGuidance}
        </div>
      )}
      <FeedbackBar sessionId={briefing.sessionId} onFeedback={onFeedback} />
    </div>
  );
}
