# Reentry - Personal Restart Assistant

See `PROJECT_DESCRIPTION.md` for the product vision. See `.kiro/specs/reentry-assistant/` for detailed requirements, design, and tasks.

## Tech Stack

- **Framework**: Next.js 15 + React 19 (web app deployed to Vercel)
- **Language**: TypeScript (strict mode)
- **Testing**: Jest + fast-check (property-based testing)
- **Package Manager**: npm
- **Storage**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Voice**: Web Speech API in browser (injectable AudioRecorder/TranscriptionService interfaces)

## Project Structure

```
src/
  app/              # Next.js App Router (layout, page, globals.css)
  components/       # React components (Header, Navigation, BriefingCard, CaptureForm, etc.)
  hooks/            # React hooks (useReentry, useVoiceCapture, useCaptureTimer)
  lib/
    capture/        # Capture Module - quick capture (30s) and interrupt capture (2s)
    extraction/     # Context Extractor - pattern matching for intent, last action, open loops, next action
    voice/          # Voice Input Processor - recording, silence detection, transcription
    briefing/       # Briefing Generator - restart briefing cards + feedback
    session/        # Session Manager - session lifecycle, time away calculation
    storage/        # IDataStore interface + SupabaseDataStore implementation
    models/         # Shared TypeScript interfaces (Session, Capture, ContextElements, etc.)
    supabase/       # Supabase client singleton
supabase/
  schema.sql        # Database schema (sessions + captures tables)
tests/
  helpers/          # MockDataStore for tests
  unit/             # Unit tests per module (6 suites)
  property/         # Property-based tests (6 suites, 100 iterations minimum)
  integration/      # End-to-end workflow tests
  performance/      # Timing constraint and load testing
```

## Architecture

Six core components + Next.js web shell:

1. **Capture Module** (`src/lib/capture/`) - accepts voice/text input, enforces timing constraints, delegates to extractor
2. **Context Extractor** (`src/lib/extraction/`) - pattern matching extraction of context elements from free-form input
3. **Voice Input Processor** (`src/lib/voice/`) - audio recording, 2s silence detection, speech-to-text transcription
4. **Briefing Generator** (`src/lib/briefing/`) - builds restart briefing cards, feedback collection
5. **Session Manager** (`src/lib/session/`) - creates/closes sessions per project, calculates time away
6. **Data Store** (`src/lib/storage/`) - `IDataStore` interface with `SupabaseDataStore` implementation (persists on every write, no local caching)
7. **React UI** (`src/app/` + `src/components/` + `src/hooks/`) - `useReentry` hook orchestrates all modules, components render the dark-themed UI

## Key Data Models

All defined in `src/lib/models/`:

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
npm run dev                 # Start Next.js dev server
npm run build               # Build for production
npm start                   # Start production server
npm test                    # Run all tests (155 tests, 14 suites)
npm run test:unit           # Unit tests only
npm run test:property       # Property-based tests (100 iterations per property)
npm run test:integration    # End-to-end workflow tests
npm run test:perf           # Timing constraint + load testing
npm run test:coverage       # Tests with coverage report
```

## Testing

- 36 correctness properties defined in design doc — all covered by property-based tests
- Property tests reference the design doc property number in a comment
- 155 total tests across unit, property, integration, and performance suites
- Tests use `MockDataStore` (in-memory `IDataStore` implementation) instead of real Supabase
- Target 80%+ code coverage on critical paths
- Zero flaky tests tolerated

## Conventions

- All interfaces defined in the design doc — follow them as the contract between components
- Graceful degradation everywhere: partial data is better than failure
- Original user input is always preserved verbatim, never modified
- Missing context elements are marked as `undefined`, not empty arrays
- All errors surface to the user with actionable next steps, never silent failures
- Voice/audio APIs abstracted behind injectable interfaces for testability
- Use `globalThis.crypto.randomUUID()` for ID generation (no external uuid dependency)
- Business logic depends on `IDataStore` interface, not concrete implementations
- Path alias `@/*` maps to `src/*`

## Storage (Supabase)

Two tables:
- `sessions` - id, project_id, entry_time, exit_time, capture_id, feedback_rating, feedback_time
- `captures` - id, session_id, type, original_input, context_elements (jsonb), timestamp

Environment variables (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deployment

Deployed to Vercel. Environment variables must be set in Vercel project settings.
