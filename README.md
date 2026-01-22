# UTC Time Converter

## API

### GET /api/location
Query params:
- q: location query (required)
- date: YYYY-MM-DD (optional, used for sun times)

Response:
- timezone: IANA timezone ID
- tzGenericName: generic label (e.g. Pacific)
- displayName: resolved location label
- coordinates: { lat, lon } or null
- sunTimes: { civilDawn, sunrise, sunset, civilDusk } or null

### POST /api/convert
Body:
- time: ISO 8601 string
- timezone: IANA timezone ID
- direction: "toLocal" | "toUTC"
- disambiguation: "compatible" | "earlier" | "later" | "reject" (optional, only used when direction = "toUTC")

Input rules:
- direction=toLocal: time must include an explicit offset or Z (instant input)
- direction=toUTC: time must not include an offset or Z (local wall time)

DST handling:
- If the local time is nonexistent (spring-forward gap) and disambiguation=reject, the API returns 400.
- If the local time is ambiguous (fall-back overlap), set disambiguation to "earlier" or "later".
  - Gap (spring-forward): reject=error, compatible=advance; earlier/later are not applicable.
  - Overlap (fall-back): earlier=first occurrence, later=second occurrence, compatible=first, reject=error.

Response:
- utcFormatted: human-readable UTC time
- localFormatted: human-readable local time
- utcISO: ISO string in UTC
- timezone: resolved IANA timezone ID
- tzAbbreviation: short zone abbreviation
- isDST: boolean for whether the selected instant is in DST
  - DST heuristic: compares offsets on Jan 15 and Jul 15 of the same year; if they differ,
    the more negative (smaller) offset is treated as standard time and the other as DST.

### GET /api/timezones
Response:
- Array of IANA timezone IDs

## Development

```bash
npm install
npm run build
npm start
```
