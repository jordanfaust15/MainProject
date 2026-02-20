'use client';

interface HeaderProps {
  onHelpClick?: () => void;
}

export function Header({ onHelpClick }: HeaderProps) {
  return (
    <div className="header">
      <h1>REENTRY</h1>
      <div className="subtitle">Personal Restart Assistant</div>
      {onHelpClick && (
        <button className="help-btn" onClick={onHelpClick} aria-label="Open tutorial">
          ?
        </button>
      )}
    </div>
  );
}
