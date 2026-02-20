'use client';

export type WorkflowStep = 1 | 2 | 3;

interface WorkflowGuideProps {
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
}

const steps: { num: WorkflowStep; label: string; hint: string }[] = [
  { num: 1, label: 'Start Session', hint: 'Begin a work period' },
  { num: 2, label: 'Capture Context', hint: 'Save what you\'re working on' },
  { num: 3, label: 'Get Briefing', hint: 'Review on return' },
];

export function WorkflowGuide({ currentStep, onStepClick }: WorkflowGuideProps) {
  return (
    <div className="workflow-guide">
      {steps.map((step, i) => {
        const isDone = step.num < currentStep;
        const isActive = step.num === currentStep;
        let className = 'workflow-step';
        if (isDone) className += ' done';
        if (isActive) className += ' active';

        return (
          <div key={step.num} className="workflow-step-wrapper">
            <button
              className={className}
              onClick={() => onStepClick(step.num)}
            >
              <span className="workflow-num">
                {isDone ? '\u2713' : step.num}
              </span>
              <span className="workflow-label">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`workflow-connector${isDone ? ' done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
