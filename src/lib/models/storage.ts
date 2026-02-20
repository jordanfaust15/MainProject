import { Session } from './session';
import { Capture } from './capture';

/**
 * Top-level schema for persisted data.
 *
 * Serialized as JSON to ~/.reentry/data.json.
 * Maps are serialized as plain objects with string keys.
 */
export interface StorageSchema {
  sessions: Record<string, Session>;
  sessionsByProject: Record<string, string[]>;
  captures: Record<string, Capture>;
  version: number;
}

export const CURRENT_SCHEMA_VERSION = 1;

export function createEmptySchema(): StorageSchema {
  return {
    sessions: {},
    sessionsByProject: {},
    captures: {},
    version: CURRENT_SCHEMA_VERSION,
  };
}
