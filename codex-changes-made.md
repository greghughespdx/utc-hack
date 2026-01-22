# codex-changes-made.md

## Overview
I updated the project to use Temporal for correct timezone conversions, enforced a strict input contract for `/api/convert`, added DST-safe handling and documentation, expanded tests (including southern hemisphere coverage), and updated dependencies. I also fixed test failures uncovered by running the suite.

## Files Changed / Added

### package.json
- Added dependency: `@js-temporal/polyfill`.
- Reason: Needed Temporal API to avoid manual timezone math and DST errors.

### package-lock.json
- Updated via `npm install` to include the new Temporal dependency.
- Note: `npm install` reported 5 moderate vulnerabilities (not fixed).

### src/timeConversion.ts (new)
- Added Temporal-based helpers:
  - `parseInstantStrict()` requires offset/Z for instant inputs.
  - `parsePlainDateTimeStrict()` requires local wall time (no offset/Z).
  - `convertToLocal()` converts UTC instant → timezone using Temporal.
  - `convertToUTC()` converts local wall time → instant with explicit disambiguation.
  - `computeIsDST()` uses Jan 15 vs Jul 15 offset comparison to determine DST.
  - `instantFromDate()` bridges Date → Temporal.Instant.
- Reason: Replace incorrect manual offset logic with robust Temporal operations, and provide reusable, testable conversion utilities.

### src/server.ts
- Switched `/api/convert` to use `convertToLocal` / `convertToUTC` instead of manual parsing and iterative offset guessing.
- Enforced disambiguation validation for `toUTC` (allowed: `compatible`, `earlier`, `later`, `reject`). Default `reject` to surface gaps/ambiguities.
- Uses `computeIsDST` to determine DST status for the selected instant.
- Keeps output formatting via `Intl.DateTimeFormat`, but now uses resolved timezone string from Temporal.
- Removed unused `formatTime` function in `getSunTimes`.
- Reason: Ensure correct conversions around DST and remove dead code.

### src/timeConversion.test.ts (new)
- Added tests for:
  - UTC → local conversion with offset input.
  - Local → UTC conversion with DST.
  - Rejection of invalid input formats (offset for `toUTC`, missing offset for `toLocal`).
  - DST spring-forward gap rejection and fall-back overlap disambiguation.
  - DST detection for America/New_York and Europe/London.
  - Non-DST zone (Asia/Kolkata).
  - Southern hemisphere DST zone (Australia/Sydney).
- Reason: Ensure conversion correctness across DST scenarios and multiple regions.

### README.md (new)
- Documented API endpoints and response fields.
- Documented strict input contract and `disambiguation` parameter.
- Added DST heuristic note: compares Jan 15 vs Jul 15 offsets, smaller offset treated as standard time.
- Reason: Provide clear API usage expectations for clients and future reviewers.

## Test Runs and Fixes
- Ran `npm test` multiple times and addressed failures:
  1. Temporal TimeZone protocol errors: fixed by passing Temporal.TimeZone object to conversion (not a string).
  2. `Temporal.PlainDateTime.toZonedDateTime` incompatibility with options: switched to `Temporal.ZonedDateTime.from(...)` with explicit fields.
  3. Missing `day` in ISO fields: supplied explicit year/month/day/hour/... from PlainDateTime.
  4. DST detection wrong for some zones: replaced “most frequent offset” heuristic with Jan/Jul offset comparison.
- Final test run: all tests pass.

## Behavior Changes (Important)
- `/api/convert` now strictly enforces input formats:
  - `direction=toLocal` requires an explicit offset or `Z` (instant input).
  - `direction=toUTC` forbids offsets; local wall time only.
- Local times in DST gaps return 400 if `disambiguation=reject` (default).
- Ambiguous times require explicit `disambiguation` if not using `compatible` default behavior.
- DST flag uses Jan/Jul offset heuristic and can differ from old `DT`-string check.

## Open Items / Not Implemented
- Frontend validation/UI changes to enforce new input rules.
- API integration tests beyond unit tests.
- `Intl.supportedValuesOf` fallback for older Node versions.
- Nominatim rate-limiting/backoff.

## Commands Executed
- `npm install` (network) to update lockfile and install Temporal polyfill.
- `npm test` to validate changes.

