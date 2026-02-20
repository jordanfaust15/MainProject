# Implementation Plan: Reentry Assistant

## Overview

This implementation plan breaks down the Reentry Assistant feature into discrete, actionable coding tasks. The system consists of six core components (Capture Module, Context Extractor, Voice Processor, Briefing Generator, Session Manager, Data Store) plus a UI layer. Implementation follows a bottom-up approach: data models first, then core services, then integration, and finally UI.

The plan includes property-based tests for all 36 correctness properties and unit tests for edge cases. Tasks are organized to enable incremental validation - each major component is tested before moving to the next.

## Tasks

- [ ] 1. Set up project structure and dependencies
  - Create directory structure for components, models, tests
  - Install dependencies: TypeScript, fast-check (property testing), testing framework
  - Configure TypeScript compiler options
  - Set up test runner configuration
  - _Requirements: All (foundational)_

- [ ] 2. Implement data models and type definitions
  - [ ] 2.1 Create core data model interfaces
    - Define Session, Capture, ContextElements, RestartBriefing interfaces
    - Define TimeAwayDisplay, CaptureSession, CaptureResult types
    - Define RecordingSession, TranscriptionResult types
    - Define StorageSchema interface
    - _Requirements: 1.8, 1.9, 2.5, 2.6, 3.1-3.9, 4.1-4.7, 5.1-5.7, 9.1-9.7_
  
  - [ ]* 2.2 Write property test for data model invariants
    - **Property 30: Data persistence round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.7**
    - Test that session/capture data survives serialization and deserialization
  
  - [ ]* 2.3 Write unit tests for data model edge cases
    - Test session with entry time equal to exit time
    - Test capture with empty context elements
    - Test invalid timestamp handling
    - _Requirements: 4.5, 4.6, 9.7_

- [ ] 3. Implement Data Store component
  - [ ] 3.1 Create DataStore class with in-memory storage
    - Implement session CRUD operations (save, get, getByProject)
    - Implement capture CRUD operations (save, get)
    - Implement feedback storage operations
    - Maintain sessionsByProject index for fast lookups
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  
  - [ ] 3.2 Implement file persistence layer
    - Implement atomic write with temp file and rename
    - Implement backup rotation (keep 3 versions)
    - Implement load with backup fallback
    - Implement data validation on load
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_
  
  - [ ] 3.3 Add error handling and notifications
    - Handle disk full, permission denied, corruption errors
    - Implement failure notification mechanism
    - Implement recovery from backups
    - _Requirements: 9.6_
  
  - [ ]* 3.4 Write property test for persistence operations
    - **Property 30: Data persistence round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.7**
    - Generate random sessions/captures, persist, reload, verify equality
  
  - [ ]* 3.5 Write property test for persistence failure handling
    - **Property 31: Persistence failure notification**
    - **Validates: Requirements 9.6**
    - Simulate write failures, verify user notification occurs
  
  - [ ]* 3.6 Write unit tests for Data Store
    - Test atomic write behavior
    - Test backup rotation
    - Test corruption recovery
    - Test concurrent access scenarios
    - _Requirements: 9.1-9.7_

- [ ] 4. Implement Session Manager component
  - [ ] 4.1 Create SessionManager class
    - Implement createSession with unique ID generation
    - Implement closeSession with exit timestamp
    - Implement getMostRecentSession with project filtering
    - Implement getSessionHistory
    - Integrate with DataStore for persistence
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ] 4.2 Implement time away calculation
    - Implement calculateTimeAway with timestamp diff logic
    - Implement formatting logic (minutes/hours/days)
    - Handle missing timestamps (unknown time away)
    - _Requirements: 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ]* 4.3 Write property test for session creation
    - **Property 13: Session creation on project start**
    - **Validates: Requirements 4.1, 4.5**
    - Generate random project IDs, create sessions, verify unique IDs and timestamps
  
  - [ ]* 4.4 Write property test for session closure
    - **Property 14: Session closure on project exit**
    - **Validates: Requirements 4.2, 4.6**
    - Create sessions, close with timestamps, verify exit time recorded
  
  - [ ]* 4.5 Write property test for session isolation
    - **Property 15: Session isolation by project**
    - **Validates: Requirements 4.3**
    - Create sessions for multiple projects, verify no cross-contamination
  
  - [ ]* 4.6 Write property test for most recent session identification
    - **Property 16: Most recent session identification**
    - **Validates: Requirements 4.4**
    - Create multiple sessions per project, verify correct most recent selection
  
  - [ ]* 4.7 Write property test for time away calculation
    - **Property 17: Time away calculation from timestamps**
    - **Validates: Requirements 4.7, 8.1, 8.2**
    - Generate random timestamp pairs, verify calculation accuracy
  
  - [ ]* 4.8 Write property test for time away formatting
    - **Property 28: Time away display formatting by duration**
    - **Validates: Requirements 8.3, 8.4, 8.5**
    - Generate durations across boundaries (59min, 60min, 47hr, 48hr), verify format
  
  - [ ]* 4.9 Write property test for unknown time away
    - **Property 29: Unknown time away indication**
    - **Validates: Requirements 8.6**
    - Create sessions without exit timestamps, verify "unknown" indication
  
  - [ ]* 4.10 Write unit tests for Session Manager
    - Test session ID collision handling
    - Test exit before entry timestamp rejection
    - Test time away at exact boundary values
    - Test multiple active sessions scenario
    - _Requirements: 4.1-4.7, 8.1-8.6_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Context Extractor component
  - [ ] 6.1 Create ContextExtractor class with pattern matching
    - Implement regex patterns for intent, last action, open loops, next action
    - Implement sentence boundary detection
    - Implement element extraction with pattern matching
    - Preserve original input verbatim
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 6.2 Add AI-based extraction fallback (optional enhancement)
    - Integrate with language model API for semantic understanding
    - Implement prompt engineering for element identification
    - Merge pattern matching and AI results
    - Handle AI service unavailability gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 6.3 Write property test for context extraction
    - **Property 3: Context extraction identifies all element types**
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4**
    - Generate inputs with all element types, verify extraction
  
  - [ ]* 6.4 Write property test for multiple elements preservation
    - **Property 18: Multiple elements of same type are preserved**
    - **Validates: Requirements 5.5**
    - Generate inputs with multiple open loops, verify all stored
  
  - [ ]* 6.5 Write property test for missing elements handling
    - **Property 19: Missing elements are marked unavailable**
    - **Validates: Requirements 5.6**
    - Generate inputs missing specific elements, verify marked unavailable
  
  - [ ]* 6.6 Write property test for original input preservation
    - **Property 20: Original input preservation**
    - **Validates: Requirements 5.7**
    - Generate random inputs with special characters, verify verbatim storage
  
  - [ ]* 6.7 Write unit tests for Context Extractor
    - Test well-formed input with all elements
    - Test minimal input (single sentence)
    - Test input with only whitespace
    - Test input with extra spaces and special characters
    - Test input with multiple instances of same element type
    - _Requirements: 1.4-1.7, 5.1-5.7_

- [ ] 7. Implement Voice Input Processor component
  - [ ] 7.1 Create VoiceInputProcessor class
    - Implement startRecording with microphone access
    - Implement audio level monitoring
    - Implement silence detection (2-second threshold)
    - Implement stopRecording (manual and automatic)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 7.2 Implement audio transcription
    - Integrate with Web Speech API (primary)
    - Add fallback to cloud transcription service (Whisper API)
    - Implement confidence score checking
    - Handle transcription failures with retry prompts
    - _Requirements: 6.5, 6.6, 6.7_
  
  - [ ] 7.3 Add error handling for voice input
    - Handle microphone access denied
    - Handle network errors for cloud transcription
    - Handle low confidence transcriptions
    - Provide text input fallback
    - _Requirements: 6.7_
  
  - [ ]* 7.4 Write property test for voice recording lifecycle
    - **Property 21: Voice recording activation**
    - **Validates: Requirements 6.1, 6.2**
    - Initiate recording, verify active state and visual feedback
  
  - [ ]* 7.5 Write property test for silence detection
    - **Property 22: Silence detection and auto-stop**
    - **Validates: Requirements 6.3, 6.4**
    - Simulate silence periods, verify auto-stop after 2 seconds
  
  - [ ]* 7.6 Write property test for transcription flow
    - **Property 23: Transcription follows recording**
    - **Validates: Requirements 6.5**
    - Stop recording, verify transcription attempt
  
  - [ ]* 7.7 Write property test for transcription to extraction flow
    - **Property 24: Context extraction follows transcription**
    - **Validates: Requirements 6.6**
    - Complete transcription, verify extraction processing
  
  - [ ]* 7.8 Write property test for transcription failure handling
    - **Property 25: Transcription failure handling**
    - **Validates: Requirements 6.7**
    - Simulate transcription failure, verify retry/fallback prompt
  
  - [ ]* 7.9 Write unit tests for Voice Input Processor
    - Test microphone permission flow
    - Test silence detection at exact 2-second threshold
    - Test manual stop before silence threshold
    - Test transcription with low confidence score
    - Test network failure during cloud transcription
    - _Requirements: 6.1-6.7_

- [ ] 8. Implement Capture Module component
  - [ ] 8.1 Create CaptureModule class
    - Implement startQuickCapture (30-second timeout)
    - Implement startInterruptCapture (2-second accessibility)
    - Implement submitTextCapture
    - Implement submitVoiceCapture with Voice Processor integration
    - Coordinate with Context Extractor for element extraction
    - Associate captures with sessions via Session Manager
    - Persist captures via Data Store
    - _Requirements: 1.1, 1.2, 1.3, 1.4-1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ] 8.2 Implement timing constraints
    - Add 30-second timeout for quick capture
    - Add 2-second accessibility for interrupt capture
    - Handle timeout with partial input submission
    - _Requirements: 1.3, 2.1_
  
  - [ ]* 8.3 Write property test for input modality acceptance
    - **Property 1: Capture accepts both input modalities**
    - **Validates: Requirements 1.1, 1.2, 2.3, 2.4**
    - Test both voice and text input for quick and interrupt captures
  
  - [ ]* 8.4 Write property test for quick capture timing
    - **Property 2: Quick capture completes within time constraint**
    - **Validates: Requirements 1.3**
    - Measure end-to-end time, verify < 30 seconds
  
  - [ ]* 8.5 Write property test for capture-session association
    - **Property 4: Captures are associated with sessions**
    - **Validates: Requirements 1.8, 2.5**
    - Create captures, verify session ID association
  
  - [ ]* 8.6 Write property test for exit timestamp recording
    - **Property 5: Exit timestamps are recorded**
    - **Validates: Requirements 1.9, 2.6**
    - Complete capture, verify exit timestamp on session
  
  - [ ]* 8.7 Write property test for interrupt capture accessibility
    - **Property 6: Interrupt capture is accessible within time constraint**
    - **Validates: Requirements 2.1**
    - Measure time to interface accessibility, verify < 2 seconds
  
  - [ ]* 8.8 Write property test for interrupt capture processing
    - **Property 7: Interrupt capture processes single sentence input**
    - **Validates: Requirements 2.2, 2.7**
    - Submit single sentence, verify processing and extraction
  
  - [ ]* 8.9 Write unit tests for Capture Module
    - Test quick capture with voice input
    - Test quick capture with text input
    - Test interrupt capture with voice input
    - Test interrupt capture with text input
    - Test timeout handling (30s for quick, 2s for interrupt)
    - Test capture without active session (emergency session creation)
    - _Requirements: 1.1-1.9, 2.1-2.7_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Briefing Generator component
  - [ ] 10.1 Create BriefingGenerator class
    - Implement generateBriefing with session retrieval
    - Implement capture data loading
    - Implement context element formatting
    - Implement time away calculation integration
    - Implement missing element detection
    - Implement retroactive reconstruction guidance
    - Ensure generation completes within 5 seconds
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ] 10.2 Implement briefing formatting logic
    - Create complete briefing format with all elements
    - Create partial briefing format for missing elements
    - Maintain consistent format structure
    - Add visual indicators for element types
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 10.6_
  
  - [ ]* 10.3 Write property test for briefing generation on return
    - **Property 8: Briefing is generated on session return**
    - **Validates: Requirements 3.1**
    - Simulate session return, verify briefing creation
  
  - [ ]* 10.4 Write property test for captured context display
    - **Property 9: Briefing displays captured context elements**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
    - Generate briefing with complete capture, verify all elements displayed
  
  - [ ]* 10.5 Write property test for time away display
    - **Property 10: Briefing always displays time away**
    - **Validates: Requirements 3.6, 10.4**
    - Generate briefings with/without captures, verify time away always present
  
  - [ ]* 10.6 Write property test for missing context indication
    - **Property 11: Briefing indicates missing context**
    - **Validates: Requirements 3.7**
    - Generate briefing without capture, verify missing context indication
  
  - [ ]* 10.7 Write property test for briefing generation timing
    - **Property 12: Briefing generation meets time constraint**
    - **Validates: Requirements 3.8**
    - Measure generation time, verify < 5 seconds
  
  - [ ]* 10.8 Write property test for partial briefing generation
    - **Property 32: Partial briefing generation without capture**
    - **Validates: Requirements 10.1**
    - Generate briefing for session without capture, verify partial briefing created
  
  - [ ]* 10.9 Write property test for missing elements indication
    - **Property 33: Missing elements indication in briefing**
    - **Validates: Requirements 10.2**
    - Generate briefing with missing elements, verify explicit indication
  
  - [ ]* 10.10 Write property test for available elements display
    - **Property 34: Available elements display in partial briefing**
    - **Validates: Requirements 10.3**
    - Generate partial briefing, verify available elements shown
  
  - [ ]* 10.11 Write property test for retroactive reconstruction guidance
    - **Property 35: Retroactive reconstruction guidance**
    - **Validates: Requirements 10.5**
    - Generate briefing without capture, verify guidance provided
  
  - [ ]* 10.12 Write property test for consistent briefing format
    - **Property 36: Consistent briefing format**
    - **Validates: Requirements 10.6**
    - Generate complete and partial briefings, verify format consistency
  
  - [ ]* 10.13 Write unit tests for Briefing Generator
    - Test complete briefing with all elements
    - Test partial briefing with some elements
    - Test briefing with no capture
    - Test briefing with session not found
    - Test briefing generation performance (< 5s)
    - Test time away formatting in briefing
    - _Requirements: 3.1-3.9, 10.1-10.6_

- [ ] 11. Implement feedback mechanism
  - [ ] 11.1 Add feedback storage to Briefing Generator
    - Implement feedback acceptance (positive/negative)
    - Associate feedback with session ID
    - Store feedback rating and timestamp
    - Persist feedback via Data Store
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 11.2 Write property test for feedback mechanism availability
    - **Property 26: Feedback mechanism availability**
    - **Validates: Requirements 7.1**
    - Display briefing, verify feedback mechanism present
  
  - [ ]* 11.3 Write property test for feedback acceptance and storage
    - **Property 27: Feedback acceptance and storage**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**
    - Submit feedback, verify storage with session association and timestamp
  
  - [ ]* 11.4 Write unit tests for feedback mechanism
    - Test positive feedback submission
    - Test negative feedback submission
    - Test feedback timestamp recording
    - Test feedback retrieval by session
    - _Requirements: 7.1-7.6_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement User Interface layer
  - [ ] 13.1 Create quick capture UI component
    - Build capture initiation button/trigger
    - Build voice/text input toggle
    - Build countdown timer display (30s)
    - Build visual feedback for voice recording (waveform/pulse)
    - Build submission confirmation
    - _Requirements: 1.1, 1.2, 1.3, 6.2_
  
  - [ ] 13.2 Create interrupt capture UI component
    - Build global keyboard shortcut handler (Cmd+Shift+I)
    - Build always-visible trigger (floating button or menu bar)
    - Build minimal single-sentence input interface
    - Optimize for < 2-second accessibility
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ] 13.3 Create restart briefing UI component
    - Build briefing card layout
    - Build element display sections (intent, last action, open loops, next action)
    - Build time away display
    - Build missing element indicators
    - Build retroactive reconstruction guidance display
    - Build feedback buttons (positive/negative)
    - Implement card-based visual format
    - _Requirements: 3.1-3.9, 7.1, 10.1-10.6_
  
  - [ ] 13.4 Integrate UI with backend components
    - Wire quick capture UI to Capture Module
    - Wire interrupt capture UI to Capture Module
    - Wire briefing UI to Briefing Generator
    - Wire feedback UI to feedback storage
    - Handle loading states and errors
    - _Requirements: All_
  
  - [ ]* 13.5 Write integration tests for UI workflows
    - Test complete capture → briefing flow
    - Test voice input → transcription → extraction → display flow
    - Test feedback submission → storage → retrieval flow
    - Test error handling and fallback flows
    - _Requirements: All_

- [ ] 14. Implement error handling and graceful degradation
  - [ ] 14.1 Add error handling to all components
    - Implement microphone access denied handling
    - Implement transcription failure handling
    - Implement AI service unavailability handling
    - Implement storage failure handling
    - Implement session state error handling
    - _Requirements: 6.7, 9.6, 10.1-10.6_
  
  - [ ] 14.2 Implement user notification system
    - Create notification component for errors
    - Implement severity levels (critical, warning, info)
    - Implement actionable error messages
    - _Requirements: 9.6_
  
  - [ ]* 14.3 Write unit tests for error handling
    - Test all error scenarios from design document
    - Test graceful degradation paths
    - Test user notification triggers
    - _Requirements: 6.7, 9.6, 10.1-10.6_

- [ ] 15. Performance optimization and testing
  - [ ] 15.1 Optimize timing-critical paths
    - Profile quick capture flow (target < 30s)
    - Profile interrupt capture accessibility (target < 2s)
    - Profile briefing generation (target < 5s)
    - Optimize data loading and caching
    - _Requirements: 1.3, 2.1, 3.8_
  
  - [ ]* 15.2 Write performance tests
    - Test quick capture timing constraint
    - Test interrupt capture accessibility timing
    - Test briefing generation timing constraint
    - Test with large session histories (1000+ sessions)
    - Test with large captures (100+ per session)
    - _Requirements: 1.3, 2.1, 3.8_
  
  - [ ]* 15.3 Write load and stress tests
    - Test memory usage during extended operation
    - Test data persistence with large files (10MB+)
    - Test concurrent operations
    - _Requirements: 9.1-9.7_

- [ ] 16. Final integration and end-to-end testing
  - [ ] 16.1 Wire all components together
    - Ensure all component dependencies are properly injected
    - Verify data flow through entire system
    - Test complete user workflows end-to-end
    - _Requirements: All_
  
  - [ ]* 16.2 Write end-to-end integration tests
    - Test planned exit → capture → return → briefing workflow
    - Test interrupt exit → capture → return → briefing workflow
    - Test multiple sessions across multiple projects
    - Test application restart with data persistence
    - _Requirements: All_
  
  - [ ]* 16.3 Run full property test suite
    - Execute all 36 property tests with 100 iterations each
    - Verify all properties pass
    - Generate test coverage report (target 80%+)
    - _Requirements: All_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property tests validate universal correctness across all 36 design properties
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end workflows
- Performance tests validate timing constraints (30s, 2s, 5s)
- Checkpoints ensure incremental validation at major milestones
- TypeScript is used throughout based on the design document interfaces
- The implementation follows a bottom-up approach: models → services → integration → UI
