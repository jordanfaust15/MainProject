# Reentry - Personal Restart Assistant

See `PROJECT_DESCRIPTION.md` for the product vision. See `.kiro/specs/reentry-assistant/` for detailed requirements, design, and tasks.

## Tech Stack

- **Runtime**: Electron + React (desktop app)
- **Language**: TypeScript (strict mode)
- **Testing**: Jest + fast-check (property-based testing)
- **Package Manager**: npm
- **Storage**: Local JSON file (`~/.reentry/data.json`) with atomic writes and backup rotation
- **Voice**: Injectable AudioRecorder/TranscriptionService interfaces (Web Speech API primary, Whisper fallback)

## Project Structure

```
src/
  capture/          # Capture Module - quick capture (30s) and interrupt capture (2s)
  extraction/       # Context Extractor - pattern matching for intent, last action, open loops, next action
  voice/            # Voice Input Processor - recording, silence detection, transcription
  briefing/         # Briefing Generator - restart briefing cards + feedback
  session/          # Session Manager - session lifecycle, time away calculation
  storage/          # Data Store - local JSON persistence with backup rotation
  models/           # Shared TypeScript interfaces (Session, Capture, ContextElements, etc.)
  main/             # Electron main process + IPC handlers
  preload/          # Electron preload scripts (secure IPC bridge)
  ui/               # (reserved for future React component extraction)
public/
  index.html        # Electron renderer (self-contained HTML + CSS + JS)
tests/
  unit/             # Unit tests per module (6 suites)
  property/         # Property-based tests (6 suites, 100 iterations minimum)
  integration/      # End-to-end workflow tests
  performance/      # Timing constraint and load testing
```

## Architecture

Six core components + Electron shell:

1. **Capture Module** (`src/capture/`) - accepts voice/text input, enforces timing constraints, delegates to extractor
2. **Context Extractor** (`src/extraction/`) - pattern matching extraction of context elements from free-form input
3. **Voice Input Processor** (`src/voice/`) - audio recording, 2s silence detection, speech-to-text transcription
4. **Briefing Generator** (`src/briefing/`) - builds restart briefing cards, feedback collection
5. **Session Manager** (`src/session/`) - creates/closes sessions per project, calculates time away
6. **Data Store** (`src/storage/`) - local JSON persistence with atomic writes, 3-version backup rotation, in-memory cache
7. **Electron Main** (`src/main/`) - BrowserWindow, IPC handlers, global shortcuts, system tray

## Key Data Models

All defined in `src/models/`:

- `Session` - work period bounded by entry/exit timestamps, tied to a project
- `Capture` - context snapshot (quick or interrupt type) with original input preserved verbatim
- `ContextElements` - extracted intent, lastAction, openLoops, nextAction (all optional string arrays)
- `RestartBriefing` - card displayed on re-entry with context elements, time away, missing element indicators
- `TimeAwayDisplay` - formatted duration using minutes (<60m), hours (<48h), or days (>48h)
- `StorageSchema` - top-level persistence schema with session/capture indexes

## Timing Constraints

- Quick capture: must complete within **30 seconds**
- Interrupt capture: must be accessible within **2 seconds**
- Briefing generation: must display within **5 seconds** of re-entry
- Voice silence detection: **2-second** threshold to auto-stop recording

## Commands

```bash
npm test                    # Run all tests (155 tests, 14 suites)
npm run test:unit           # Unit tests only
npm run test:property       # Property-based tests (100 iterations per property)
npm run test:integration    # End-to-end workflow tests
npm run test:perf           # Timing constraint + load testing
npm run test:coverage       # Tests with coverage report
npm run build               # Compile TypeScript to dist/
npm start                   # Launch Electron app
```

## Testing

- 36 correctness properties defined in design doc — all covered by property-based tests
- Property tests reference the design doc property number in a comment
- 155 total tests across unit, property, integration, and performance suites
- Target 80%+ code coverage on critical paths
- Zero flaky tests tolerated

## Conventions

- All interfaces defined in the design doc — follow them as the contract between components
- Graceful degradation everywhere: partial data is better than failure
- Original user input is always preserved verbatim, never modified
- Missing context elements are marked as `undefined`, not empty arrays
- Atomic file writes (write to temp file, then rename) for data persistence
- All errors surface to the user with actionable next steps, never silent failures
- Voice/audio APIs abstracted behind injectable interfaces for testability
- IPC uses `contextBridge` with `contextIsolation: true` for security
- Use `crypto.randomUUID()` for ID generation (no external uuid dependency)

## Storage

```
~/.reentry/
  data.json             # Current data
  data.backup.1.json    # Previous version
  data.backup.2.json    # 2 versions ago
  data.backup.3.json    # 3 versions ago
```

Data is loaded into an in-memory cache at startup. Saves are debounced (auto-save every 30s if dirty) with immediate save on critical operations (capture completion, session close, feedback submission).
