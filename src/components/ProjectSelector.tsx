'use client';

interface ProjectSelectorProps {
  projectId: string;
  onChange: (projectId: string) => void;
}

export function ProjectSelector({ projectId, onChange }: ProjectSelectorProps) {
  return (
    <div className="project-input">
      <input
        type="text"
        placeholder="Project name..."
        value={projectId}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
