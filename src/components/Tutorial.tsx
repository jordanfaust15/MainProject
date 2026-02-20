'use client';

import { useState } from 'react';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: 'Welcome to Reentry',
    description:
      'Reentry helps you pick up where you left off. It captures your work context before you step away, then gives you a personalized restart briefing when you return.',
  },
  {
    title: 'Set Your Project',
    description:
      'Enter a project name to organize your sessions. All captures and briefings are grouped by project.',
  },
  {
    title: 'Start a Session',
    description:
      "On the Briefing tab, hit 'Start Session' to begin tracking a work period.",
  },
  {
    title: 'Capture Your Context',
    description:
      'Before stepping away, switch to Quick Capture and describe what you were working on. You have 30 seconds \u2014 just brain-dump your current state: what you intended, what you did last, any open loops, and your next action.',
  },
  {
    title: 'Get Your Briefing',
    description:
      'When you come back, the Briefing tab shows a restart card with your intent, last action, open loops, and next steps \u2014 everything you need to get back in flow.',
  },
];

export function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const current = steps[step];

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <div className="tutorial-overlay" onClick={handleClose}>
      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-step-indicator">{step + 1} / {steps.length}</div>
        <div className="tutorial-content">
          <h2>{current.title}</h2>
          <p>{current.description}</p>
        </div>
        <div className="tutorial-dots">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === step ? ' active' : ''}`}
            />
          ))}
        </div>
        <div className="tutorial-nav">
          {!isFirst ? (
            <button className="btn btn-secondary btn-small" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <button className="btn btn-secondary btn-small" onClick={handleClose}>
              Skip
            </button>
          )}
          {isLast ? (
            <button className="btn btn-primary btn-small" onClick={handleClose}>
              Get Started
            </button>
          ) : (
            <button className="btn btn-primary btn-small" onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
