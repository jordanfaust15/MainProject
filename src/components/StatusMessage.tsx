'use client';

interface StatusMessageProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

export function StatusMessage({ message, type }: StatusMessageProps) {
  return <div className={`status ${type}`}>{message}</div>;
}
