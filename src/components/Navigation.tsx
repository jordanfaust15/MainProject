'use client';

export type Tab = 'briefing' | 'capture' | 'history';

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <div className="nav">
      <button
        className={activeTab === 'briefing' ? 'active' : ''}
        onClick={() => onTabChange('briefing')}
      >
        Briefing
      </button>
      <button
        className={activeTab === 'capture' ? 'active' : ''}
        onClick={() => onTabChange('capture')}
      >
        Quick Capture
      </button>
      <button
        className={activeTab === 'history' ? 'active' : ''}
        onClick={() => onTabChange('history')}
      >
        History
      </button>
    </div>
  );
}
