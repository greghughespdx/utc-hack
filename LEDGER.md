# UTC Hack Project Ledger

**Last Updated:** 2026-01-21 23:55 UTC
**Maintainers:** Claude (Anthropic), Codex (OpenAI)
**Purpose:** Shared project memory and agent coordination across sessions

---

## Current State

### Production Status
- **Status:** ✅ Production Ready
- **Version:** Latest commit `60cb9d8`
- **Branch:** main
- **Server:** Running on localhost:3000
- **Tests:** 17/17 passing

### Key Metrics
- **Test Coverage:** 3 test files, 17 tests total
- **Dependencies:** 4 production, 5 dev
- **Known Issues:** None
- **Technical Debt:** None critical

---

## Active Work

### [PENDING] Tasks
None currently

### [IN_PROGRESS] Tasks
None currently

### [BLOCKED] Tasks
None currently

---

## Agent Handoffs

### Pending Handoffs
**Format:** `[AGENT_NAME] → [AGENT_NAME]: Task description`

None currently - all handoffs completed

### Completed Handoffs Archive

#### 2026-01-21: Codex → Claude → Codex (Full Cycle)
1. **Codex → Claude**: Test Temporal integration after implementation
   - Claude executed comprehensive API and browser tests
   - Result: ✅ All systems working, found disambiguation clarification needed

2. **Claude → Codex**: Clarify gap vs overlap in documentation
   - Codex validated and added notes to README.md
   - Result: ✅ Documentation updated

---

## Recent Changes

### 2026-01-21 (Today)
- **60cb9d8** - Major refactor: Temporal API integration and production hardening
  - Added @js-temporal/polyfill for correct timezone conversions
  - Replaced broken manual offset math with Temporal API
  - Added disambiguation UI for DST gaps/overlaps
  - Added Nominatim caching (12h geocoding, 24h airports)
  - Added retry/backoff for API failures
  - Added 16 new tests (10 unit + 6 integration)
  - Created comprehensive API documentation
  - Files: +670 insertions, -114 deletions across 9 files

- **377d93b** - Fix all remaining timezone bugs - use UTC methods throughout
  - Changed all .getHours() → .getUTCHours() (7 instances)
  - Changed all .getMinutes() → .getUTCMinutes() (7 instances)
  - Changed all date methods to UTC equivalents
  - Fixed browser timezone interference in picker

- **c20faa1** - Fix critical timezone bug in date/time conversion
  - Added 'Z' suffix to force UTC interpretation
  - Prevented browser local timezone from shifting times

- **887f345** - Convert entire app to 24-hour time format
  - Changed all formatters to hour12: false
  - Updated custom spinner widget
  - Generic timezone names (Pacific, Mountain, Eastern)

### Last 7 Days
See above (all work was 2026-01-21)

---

## Architecture Decisions

### Core Technology Choices
1. **Temporal API (@js-temporal/polyfill)** - Chosen for correct DST handling
   - Replaces broken manual offset math
   - Handles gaps/overlaps with disambiguation
   - Jan 15 vs Jul 15 offset comparison for DST detection

2. **24-Hour Time Format** - User requirement
   - All formatters use hour12: false
   - Custom spinner widget for consistent display
   - No AM/PM indicators anywhere

3. **Strict Input Validation** - Prevents common errors
   - toLocal: MUST have Z or offset (instant input)
   - toUTC: MUST NOT have Z or offset (local wall time)
   - Server validates and returns 400 for violations

4. **In-Memory Caching** - Performance and reliability
   - Geocoding: 12-hour TTL
   - Airports: 24-hour TTL
   - Reduces Nominatim API load

### Frontend Patterns
- Custom 24-hour time spinner (replaced native datetime-local)
- UTC methods throughout (getUTCHours, getUTCMinutes, etc.)
- Disambiguation dropdown visible only for LOCAL → UTC
- Client-side validation before API submission

### Backend Patterns
- Express.js REST API
- Socket-free testing (no port binding in tests)
- Retry/backoff for external APIs (Nominatim)
- Error types: rate_limited (429), upstream_unavailable (503)
- Graceful fallbacks (Intl.supportedValuesOf for Node <16)

---

## Testing Status

### Unit Tests (11 tests)
- ✅ `src/index.test.ts` - 1 test (basic functionality)
- ✅ `src/timeConversion.test.ts` - 10 tests
  - UTC → Local conversion with offset validation
  - Local → UTC conversion with DST
  - Input format rejection (invalid Z suffix usage)
  - DST gap rejection (spring-forward)
  - DST overlap disambiguation (fall-back)
  - Multiple timezones (America/New_York, Europe/London, Asia/Kolkata, Australia/Sydney)

### Integration Tests (6 tests)
- ✅ `src/server.test.ts` - 6 tests
  - /api/convert success and validation
  - /api/location state shortcuts and geocoding
  - /api/timezones with fallback behavior
  - Input format enforcement
  - Error handling

### Manual Testing (Completed)
- ✅ Browser UI testing (both conversion directions)
- ✅ Custom time picker functionality
- ✅ Disambiguation dropdown behavior
- ✅ API endpoint testing (curl)
- ✅ DST gap scenario (2025-03-09 02:30)
- ✅ DST overlap scenario (2025-11-02 01:30)
- ✅ Geocoding cache verification
- ✅ 24-hour time format throughout

### Test Commands
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run typecheck     # Type checking only
```

---

## API Documentation

See `README.md` for complete API documentation.

### Endpoints
- `GET /api/location?q=<query>&date=<YYYY-MM-DD>` - Geocoding and sun times
- `POST /api/convert` - Timezone conversion (requires direction, timezone, time)
- `GET /api/timezones` - List of all IANA timezones

### Key Behaviors
- **DST Disambiguation:**
  - Gap (spring-forward): reject=error, compatible=advance forward
  - Overlap (fall-back): earlier=first occurrence, later=second occurrence
  - Default: reject (requires explicit handling)

- **Input Validation:**
  - toLocal: time MUST include Z or offset
  - toUTC: time MUST NOT include Z or offset
  - Violations return 400 with clear error message

- **Caching:**
  - Geocoding cached 12 hours
  - Airport lookups cached 24 hours
  - Reduces external API load

---

## Known Issues

### Active Bugs
None

### Technical Debt
None critical

### Future Considerations
- Consider adding rate limiting on server side
- Consider adding request authentication
- Consider adding more language translations
- Consider adding historical timezone data
- Consider adding timezone abbreviation database

---

## Future Work / Backlog

### Potential Enhancements
- [ ] More comprehensive language translations (currently English + fallbacks)
- [ ] User preferences (save favorite locations)
- [ ] Bulk conversion API endpoint
- [ ] CSV export for conversion results
- [ ] Mobile app version
- [ ] Timezone comparison view (multiple timezones side-by-side)

### Infrastructure
- [ ] CI/CD pipeline
- [ ] Automated deployment
- [ ] Production monitoring
- [ ] Performance metrics
- [ ] Error tracking (Sentry, etc.)

### Documentation
- [ ] Contributing guide
- [ ] Deployment guide
- [ ] Architecture diagram
- [ ] API changelog

---

## Session Notes

### Session: 2026-01-21 (Claude + Codex Collaboration)

**Duration:** ~4 hours
**Agents:** Claude (Anthropic Sonnet 4.5), Codex (OpenAI 5.2)

**Objectives:**
1. Review and integrate Codex's Temporal-based timezone conversion implementation
2. Test and validate all functionality
3. Add production hardening features
4. Create comprehensive documentation

**Work Completed:**

**Phase 1: Codex Initial Implementation**
- Replaced broken manual timezone math with Temporal API
- Created `src/timeConversion.ts` with strict validation
- Added 10 unit tests for DST scenarios
- Fixed incorrect offset iteration (30-day months, 365.25 years)
- Fixed Z-suffix appending bug in toLocal
- Created initial README.md with API documentation

**Phase 2: Claude Testing & Integration**
- Fixed TypeScript error (calendar → calendarId)
- Verified API contracts (Z suffix validation working)
- Tested both conversion directions with curl
- Fixed client-side UTC methods (7 instances each of hours/minutes/date)
- Conducted comprehensive browser testing
- Verified DST gap and overlap scenarios

**Phase 3: Codex Production Hardening** (Tasks 3/4/1/2)
- Task 3: Added Intl.supportedValuesOf fallback for older Node
- Task 4: Implemented Nominatim caching + retry/backoff
- Task 1: Created disambiguation UI with internationalization
- Task 2: Added 6 API integration tests

**Phase 4: Documentation & Collaboration**
- Claude reviewed all documentation
- Created comprehensive commit message
- Committed and pushed to GitHub (60cb9d8)
- Created this LEDGER.md for future agent coordination

**Key Decisions:**
- Use file-based ledger for agent coordination
- Default disambiguation to "reject" for safety
- Cache geocoding for 12h, airports for 24h
- Comprehensive testing before deployment

**Outcomes:**
- ✅ All 17 tests passing
- ✅ Production-ready application
- ✅ Complete API documentation
- ✅ Agent collaboration protocol established

**Lessons Learned:**
- Codex excels at architectural planning and systematic refactoring
- Claude excels at testing, integration, and documentation
- File-based ledger enables effective async collaboration
- Clear handoff messages prevent duplicate work

**Next Session Recommendations:**
1. Check this ledger for any pending tasks
2. Review git log since last session
3. Run `npm test` to verify system state
4. Check `.agent-comms/` for any pending handoffs (future)

---

## Agent Collaboration Protocol

### At Session Start
1. Read this LEDGER.md
2. Check git log for recent changes: `git log --oneline -10`
3. Check for pending tasks in "Active Work" section
4. Check for pending handoffs in "Agent Handoffs" section
5. Run tests: `npm test`

### During Session
1. Update "Active Work" section when starting tasks
2. Mark tasks as [IN_PROGRESS] when working
3. Mark tasks as [PENDING] when handing off
4. Mark tasks as [DONE] when completing

### At Session End
1. Update "Recent Changes" with today's work
2. Add session notes to "Session Notes"
3. Update "Current State" metrics
4. Commit LEDGER.md changes if significant work done
5. Clear [DONE] tasks from "Active Work"
6. Archive completed handoffs

### Handoff Format
```markdown
### [AGENT_NAME] → [AGENT_NAME]: Brief task description
**Assigned:** YYYY-MM-DD HH:MM UTC
**Priority:** High/Medium/Low
**Files:** List of relevant files
**Context:** Background information
**Task:** Specific action items
**Expected Output:** What success looks like
**Status:** PENDING/IN_PROGRESS/DONE/BLOCKED
```

---

## Version History

- **v1.0.0** - 2026-01-21 - Initial production release
  - Temporal API integration
  - 24-hour time format
  - DST disambiguation
  - Production hardening
  - Comprehensive testing

---

**End of Ledger**
*This document should be updated at the end of each significant work session.*
