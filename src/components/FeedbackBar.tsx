'use client';

import { useState } from 'react';

interface FeedbackBarProps {
  sessionId: string;
  onFeedback: (sessionId: string, rating: number) => void;
}

export function FeedbackBar({ sessionId, onFeedback }: FeedbackBarProps) {
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (rating: number) => {
    onFeedback(sessionId, rating);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="feedback">
        <span className="confirmed">Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="feedback">
      <span>Was this helpful?</span>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button key={rating} onClick={() => handleFeedback(rating)}>
          {rating}
        </button>
      ))}
    </div>
  );
}
