# Requirements Document

## Introduction

Reentry is a personal restart assistant that solves the workflow memory problem: when people step away from complex work, they lose their intent and progress state. Reconstructing context costs 15-20 minutes per re-entry, 2-3x daily. Reentry captures working context during exits (planned or abrupt) and provides focused briefings when users return, enabling them to resume meaningful work in under 2 minutes.

The system addresses the critical insight that people don't forget what a project is - they forget where they were in the sequence and what they were trying to do next. This is fundamentally different from knowledge management or task tracking.

## Glossary

- **Reentry_System**: The complete personal restart assistant application
- **Capture_Module**: Component responsible for recording user context during work sessions
- **Briefing_Generator**: Component that creates restart briefing cards from captured context
- **Session**: A continuous period of work on a project, bounded by entry and exit events
- **Intent**: The goal or purpose the user was trying to accomplish during a session
- **Open_Loop**: An unresolved question, blocker, or pending decision
- **Restart_Briefing**: A structured summary card showing intent, progress, loops, and next action
- **Quick_Capture**: Voice or text capture completed in under 30 seconds during planned exits
- **Interrupt_Capture**: Single-sentence capture accessible in under 2 seconds for abrupt interruptions
- **Retroactive_Reconstruction**: Guided process to rebuild context when no capture exists
- **Time_Away**: Duration between the last session exit and current re-entry

## Requirements

### Requirement 1: Quick Capture for Planned Exits

**User Story:** As a user planning to step away from work, I want to quickly capture my current context in under 30 seconds, so that I can resume efficiently later without losing my place.

#### Acceptance Criteria

1. WHEN a user initiates Quick_Capture, THE Capture_Module SHALL accept voice input
2. WHEN a user initiates Quick_Capture, THE Capture_Module SHALL accept text input
3. THE Capture_Module SHALL complete Quick_Capture within 30 seconds
4. WHEN Quick_Capture is completed, THE Capture_Module SHALL extract intent from the input
5. WHEN Quick_Capture is completed, THE Capture_Module SHALL extract last action from the input
6. WHEN Quick_Capture is completed, THE Capture_Module SHALL extract open loops from the input
7. WHEN Quick_Capture is completed, THE Capture_Module SHALL extract next action from the input
8. WHEN Quick_Capture is completed, THE Reentry_System SHALL associate the capture with the current session
9. WHEN Quick_Capture is completed, THE Reentry_System SHALL record the exit timestamp

### Requirement 2: Interrupt-Speed Capture for Abrupt Exits

**User Story:** As a user being pulled away unexpectedly, I want to capture a single sentence of context in under 2 seconds, so that I don't lose critical information when interrupted.

#### Acceptance Criteria

1. THE Reentry_System SHALL provide Interrupt_Capture accessible within 2 seconds
2. WHEN a user initiates Interrupt_Capture, THE Capture_Module SHALL accept a single sentence input
3. WHEN a user initiates Interrupt_Capture, THE Capture_Module SHALL accept voice input
4. WHEN a user initiates Interrupt_Capture, THE Capture_Module SHALL accept text input
5. WHEN Interrupt_Capture is completed, THE Reentry_System SHALL associate the capture with the current session
6. WHEN Interrupt_Capture is completed, THE Reentry_System SHALL record the exit timestamp
7. THE Capture_Module SHALL process Interrupt_Capture input to extract available context elements

### Requirement 3: Restart Briefing Generation

**User Story:** As a user returning to work after a gap, I want to see a focused briefing of where I left off, so that I can resume meaningful work in under 2 minutes.

#### Acceptance Criteria

1. WHEN a user returns to a session, THE Briefing_Generator SHALL create a Restart_Briefing
2. THE Restart_Briefing SHALL display the intent
3. THE Restart_Briefing SHALL display where the user left off
4. THE Restart_Briefing SHALL display open loops
5. THE Restart_Briefing SHALL display the next action
6. THE Restart_Briefing SHALL display Time_Away
7. WHEN no capture exists for a session, THE Briefing_Generator SHALL indicate missing context
8. THE Briefing_Generator SHALL present the Restart_Briefing within 5 seconds of re-entry
9. THE Restart_Briefing SHALL use card-based visual format

### Requirement 4: Session Management

**User Story:** As a user working on multiple projects, I want the system to track separate sessions for each project, so that I can maintain distinct contexts without confusion.

#### Acceptance Criteria

1. WHEN a user starts work on a project, THE Reentry_System SHALL create a new session
2. WHEN a user exits a project, THE Reentry_System SHALL close the current session
3. THE Reentry_System SHALL maintain separate session histories for different projects
4. WHEN a user returns to a project, THE Reentry_System SHALL identify the most recent session
5. THE Reentry_System SHALL store session entry timestamps
6. THE Reentry_System SHALL store session exit timestamps
7. THE Reentry_System SHALL calculate Time_Away from session timestamps

### Requirement 5: Context Element Extraction

**User Story:** As a user providing capture input, I want the system to automatically identify key context elements, so that I don't have to structure my thoughts in a specific format.

#### Acceptance Criteria

1. WHEN capture input is received, THE Capture_Module SHALL identify intent statements
2. WHEN capture input is received, THE Capture_Module SHALL identify last action statements
3. WHEN capture input is received, THE Capture_Module SHALL identify open loop statements
4. WHEN capture input is received, THE Capture_Module SHALL identify next action statements
5. IF multiple elements of the same type are found, THEN THE Capture_Module SHALL store all identified elements
6. IF an element type is not found in the input, THEN THE Capture_Module SHALL mark that element as unavailable
7. THE Capture_Module SHALL preserve the original capture input verbatim

### Requirement 6: Voice Input Processing

**User Story:** As a user who prefers speaking over typing, I want to provide context through voice input, so that I can capture information quickly and naturally.

#### Acceptance Criteria

1. WHEN voice input is initiated, THE Capture_Module SHALL activate audio recording
2. WHEN voice recording is active, THE Capture_Module SHALL provide visual feedback
3. WHEN a user stops speaking, THE Capture_Module SHALL detect silence
4. WHEN silence exceeds 2 seconds, THE Capture_Module SHALL stop recording
5. WHEN recording stops, THE Capture_Module SHALL transcribe audio to text
6. WHEN transcription completes, THE Capture_Module SHALL process the text for context extraction
7. IF transcription fails, THEN THE Reentry_System SHALL prompt the user to retry or use text input

### Requirement 7: Briefing Accuracy Feedback

**User Story:** As a user reviewing a restart briefing, I want to provide feedback on its accuracy, so that the system can improve over time.

#### Acceptance Criteria

1. WHEN a Restart_Briefing is displayed, THE Reentry_System SHALL provide an accuracy feedback mechanism
2. THE Reentry_System SHALL accept positive accuracy feedback
3. THE Reentry_System SHALL accept negative accuracy feedback
4. WHEN feedback is provided, THE Reentry_System SHALL associate the feedback with the session
5. WHEN feedback is provided, THE Reentry_System SHALL store the feedback rating
6. THE Reentry_System SHALL store feedback timestamps

### Requirement 8: Time Away Calculation

**User Story:** As a user returning to work, I want to know how long I've been away, so that I can gauge how much context I might have lost.

#### Acceptance Criteria

1. WHEN a user returns to a session, THE Reentry_System SHALL calculate Time_Away
2. THE Reentry_System SHALL calculate Time_Away as the difference between current time and last exit timestamp
3. WHEN Time_Away is less than 60 minutes, THE Reentry_System SHALL display Time_Away in minutes
4. WHEN Time_Away is between 60 minutes and 48 hours, THE Reentry_System SHALL display Time_Away in hours
5. WHEN Time_Away exceeds 48 hours, THE Reentry_System SHALL display Time_Away in days
6. WHEN no exit timestamp exists, THE Reentry_System SHALL indicate unknown Time_Away

### Requirement 9: Data Persistence

**User Story:** As a user of the system, I want my session data and captures to be reliably stored, so that I don't lose context due to system failures.

#### Acceptance Criteria

1. WHEN a capture is completed, THE Reentry_System SHALL persist the capture data
2. WHEN a session is created, THE Reentry_System SHALL persist the session data
3. WHEN a session is closed, THE Reentry_System SHALL persist the updated session data
4. THE Reentry_System SHALL store data locally on the user's device
5. WHEN the application restarts, THE Reentry_System SHALL load all persisted session data
6. IF data persistence fails, THEN THE Reentry_System SHALL notify the user
7. THE Reentry_System SHALL maintain data integrity across application restarts

### Requirement 10: Graceful Degradation for Missing Context

**User Story:** As a user who forgot to capture context, I want the system to still provide useful information, so that I'm not left with nothing when I return.

#### Acceptance Criteria

1. WHEN no capture exists for a session, THE Briefing_Generator SHALL create a partial Restart_Briefing
2. WHEN an element is unavailable, THE Restart_Briefing SHALL indicate which elements are missing
3. WHEN an element is unavailable, THE Restart_Briefing SHALL display available elements
4. THE Restart_Briefing SHALL display Time_Away even when other elements are missing
5. WHEN no capture exists, THE Restart_Briefing SHALL provide guidance on retroactive reconstruction
6. THE Reentry_System SHALL maintain consistent briefing format regardless of missing elements

