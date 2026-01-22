import express from 'express';
import path from 'path';
import { find } from 'geo-tz';
import SunCalc from 'suncalc';
import {
  computeIsDST,
  convertToLocal,
  convertToUTC,
  instantFromDate,
  type Disambiguation
} from './timeConversion.js';

const app = express();
const PORT = 3000;

type LocationSuccess = { lat: number; lon: number; displayName: string };
type LocationError = { error: 'rate_limited' | 'upstream_unavailable' | 'invalid_response' };
type LocationResult = LocationSuccess | LocationError | null;

const GEO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const AIRPORT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const geocodeCache = new Map<string, { expiresAt: number; value: LocationSuccess }>();
const airportCache = new Map<string, { expiresAt: number; value: LocationSuccess }>();

function getCachedLocation(
  cache: Map<string, { expiresAt: number; value: LocationSuccess }>,
  key: string
): LocationSuccess | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedLocation(
  cache: Map<string, { expiresAt: number; value: LocationSuccess }>,
  key: string,
  value: LocationSuccess,
  ttlMs: number
) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(url: string, retries = 2, baseDelayMs = 300): Promise<T> {
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UTCTimeConverter/1.0 (educational project)'
      }
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    lastStatus = response.status;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === retries) {
      const error = new Error(`Nominatim API error: ${response.status}`);
      (error as { status?: number }).status = response.status;
      throw error;
    }

    const retryAfter = response.headers.get('retry-after');
    const retryDelay = retryAfter ? Number(retryAfter) * 1000 : baseDelayMs * (attempt + 1);
    await sleep(Number.isFinite(retryDelay) ? retryDelay : baseDelayMs);
  }

  const error = new Error(`Nominatim API error: ${lastStatus ?? 'unknown'}`);
  (error as { status?: number }).status = lastStatus ?? undefined;
  throw error;
}

// Check if input looks like an airport code (ICAO or IATA)
function isAirportCode(input: string): { isAirport: boolean; icaoCode: string } {
  const code = input.trim().toUpperCase();

  // 3-letter IATA code (assume US airport, prepend K)
  if (/^[A-Z]{3}$/.test(code)) {
    return { isAirport: true, icaoCode: 'K' + code };
  }

  // 4-letter ICAO code
  if (/^[A-Z]{4}$/.test(code)) {
    // Common region prefixes
    const validPrefixes = ['K', 'C', 'E', 'L', 'U', 'Z', 'R', 'V', 'W', 'Y', 'P', 'N', 'S', 'F', 'D', 'H', 'O', 'B', 'G', 'M', 'T', 'A'];
    if (validPrefixes.includes(code[0])) {
      return { isAirport: true, icaoCode: code };
    }
  }

  return { isAirport: false, icaoCode: '' };
}

// Lookup airport by ICAO code using Nominatim
async function lookupAirport(icaoCode: string): Promise<LocationResult> {
  try {
    const code = icaoCode.trim().toUpperCase();
    const cached = getCachedLocation(airportCache, code);
    if (cached) return cached;
    // Search for airport by ICAO code
    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(code + ' airport')}&format=json&limit=5&addressdetails=1`;

    const results = await fetchJsonWithRetry<Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      class?: string;
    }>>(url);

    // Find result that's actually an airport/aerodrome
    const airport = results.find(r =>
      r.class === 'aeroway' ||
      r.type === 'aerodrome' ||
      r.display_name.toLowerCase().includes('airport') ||
      r.display_name.toLowerCase().includes('aerodrome')
    ) || results[0];

    if (!airport) return null;

    const result = {
      lat: parseFloat(airport.lat),
      lon: parseFloat(airport.lon),
      displayName: `${code} - ${airport.display_name}`
    };
    setCachedLocation(airportCache, code, result, AIRPORT_CACHE_TTL_MS);
    return result;
  } catch (error) {
    console.error('Airport lookup error:', error);
    const status = (error as { status?: number }).status;
    if (status === 429) return { error: 'rate_limited' };
    return { error: 'upstream_unavailable' };
  }
}

// Calculate sun times for a location
function getSunTimes(lat: number, lon: number, date: Date) {
  const times = SunCalc.getTimes(date, lat, lon);

  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    civilDawn: times.dawn,      // Civil twilight begins
    civilDusk: times.dusk,      // Civil twilight ends
    nauticalDawn: times.nauticalDawn,
    nauticalDusk: times.nauticalDusk,
    goldenHour: times.goldenHour,
    goldenHourEnd: times.goldenHourEnd
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Single-timezone US states (no API call needed)
const singleTimezoneStates: Record<string, { timezone: string; displayName: string }> = {
  // Pacific
  'washington': { timezone: 'America/Los_Angeles', displayName: 'Washington, United States' },
  'wa': { timezone: 'America/Los_Angeles', displayName: 'Washington, United States' },
  'california': { timezone: 'America/Los_Angeles', displayName: 'California, United States' },
  'ca': { timezone: 'America/Los_Angeles', displayName: 'California, United States' },
  'nevada': { timezone: 'America/Los_Angeles', displayName: 'Nevada, United States' },
  'nv': { timezone: 'America/Los_Angeles', displayName: 'Nevada, United States' },

  // Mountain
  'montana': { timezone: 'America/Denver', displayName: 'Montana, United States' },
  'mt': { timezone: 'America/Denver', displayName: 'Montana, United States' },
  'wyoming': { timezone: 'America/Denver', displayName: 'Wyoming, United States' },
  'wy': { timezone: 'America/Denver', displayName: 'Wyoming, United States' },
  'colorado': { timezone: 'America/Denver', displayName: 'Colorado, United States' },
  'co': { timezone: 'America/Denver', displayName: 'Colorado, United States' },
  'utah': { timezone: 'America/Denver', displayName: 'Utah, United States' },
  'ut': { timezone: 'America/Denver', displayName: 'Utah, United States' },
  'new mexico': { timezone: 'America/Denver', displayName: 'New Mexico, United States' },
  'nm': { timezone: 'America/Denver', displayName: 'New Mexico, United States' },
  // NOTE: Arizona excluded - Navajo Nation observes DST, needs geo-tz lookup

  // Central
  'minnesota': { timezone: 'America/Chicago', displayName: 'Minnesota, United States' },
  'mn': { timezone: 'America/Chicago', displayName: 'Minnesota, United States' },
  'wisconsin': { timezone: 'America/Chicago', displayName: 'Wisconsin, United States' },
  'wi': { timezone: 'America/Chicago', displayName: 'Wisconsin, United States' },
  'iowa': { timezone: 'America/Chicago', displayName: 'Iowa, United States' },
  'ia': { timezone: 'America/Chicago', displayName: 'Iowa, United States' },
  'missouri': { timezone: 'America/Chicago', displayName: 'Missouri, United States' },
  'mo': { timezone: 'America/Chicago', displayName: 'Missouri, United States' },
  'arkansas': { timezone: 'America/Chicago', displayName: 'Arkansas, United States' },
  'ar': { timezone: 'America/Chicago', displayName: 'Arkansas, United States' },
  'louisiana': { timezone: 'America/Chicago', displayName: 'Louisiana, United States' },
  'la': { timezone: 'America/Chicago', displayName: 'Louisiana, United States' },
  'mississippi': { timezone: 'America/Chicago', displayName: 'Mississippi, United States' },
  'ms': { timezone: 'America/Chicago', displayName: 'Mississippi, United States' },
  'alabama': { timezone: 'America/Chicago', displayName: 'Alabama, United States' },
  'al': { timezone: 'America/Chicago', displayName: 'Alabama, United States' },
  'oklahoma': { timezone: 'America/Chicago', displayName: 'Oklahoma, United States' },
  'ok': { timezone: 'America/Chicago', displayName: 'Oklahoma, United States' },

  // Eastern
  'maine': { timezone: 'America/New_York', displayName: 'Maine, United States' },
  'me': { timezone: 'America/New_York', displayName: 'Maine, United States' },
  'new hampshire': { timezone: 'America/New_York', displayName: 'New Hampshire, United States' },
  'nh': { timezone: 'America/New_York', displayName: 'New Hampshire, United States' },
  'vermont': { timezone: 'America/New_York', displayName: 'Vermont, United States' },
  'vt': { timezone: 'America/New_York', displayName: 'Vermont, United States' },
  'massachusetts': { timezone: 'America/New_York', displayName: 'Massachusetts, United States' },
  'ma': { timezone: 'America/New_York', displayName: 'Massachusetts, United States' },
  'rhode island': { timezone: 'America/New_York', displayName: 'Rhode Island, United States' },
  'ri': { timezone: 'America/New_York', displayName: 'Rhode Island, United States' },
  'connecticut': { timezone: 'America/New_York', displayName: 'Connecticut, United States' },
  'ct': { timezone: 'America/New_York', displayName: 'Connecticut, United States' },
  'new york': { timezone: 'America/New_York', displayName: 'New York, United States' },
  'ny': { timezone: 'America/New_York', displayName: 'New York, United States' },
  'new jersey': { timezone: 'America/New_York', displayName: 'New Jersey, United States' },
  'nj': { timezone: 'America/New_York', displayName: 'New Jersey, United States' },
  'pennsylvania': { timezone: 'America/New_York', displayName: 'Pennsylvania, United States' },
  'pa': { timezone: 'America/New_York', displayName: 'Pennsylvania, United States' },
  'delaware': { timezone: 'America/New_York', displayName: 'Delaware, United States' },
  'de': { timezone: 'America/New_York', displayName: 'Delaware, United States' },
  'maryland': { timezone: 'America/New_York', displayName: 'Maryland, United States' },
  'md': { timezone: 'America/New_York', displayName: 'Maryland, United States' },
  'virginia': { timezone: 'America/New_York', displayName: 'Virginia, United States' },
  'va': { timezone: 'America/New_York', displayName: 'Virginia, United States' },
  'west virginia': { timezone: 'America/New_York', displayName: 'West Virginia, United States' },
  'wv': { timezone: 'America/New_York', displayName: 'West Virginia, United States' },
  'ohio': { timezone: 'America/New_York', displayName: 'Ohio, United States' },
  'oh': { timezone: 'America/New_York', displayName: 'Ohio, United States' },
  'north carolina': { timezone: 'America/New_York', displayName: 'North Carolina, United States' },
  'nc': { timezone: 'America/New_York', displayName: 'North Carolina, United States' },
  'south carolina': { timezone: 'America/New_York', displayName: 'South Carolina, United States' },
  'sc': { timezone: 'America/New_York', displayName: 'South Carolina, United States' },
  'georgia': { timezone: 'America/New_York', displayName: 'Georgia, United States' },
  'ga': { timezone: 'America/New_York', displayName: 'Georgia, United States' },

  // Hawaii
  'hawaii': { timezone: 'Pacific/Honolulu', displayName: 'Hawaii, United States' },
  'hi': { timezone: 'Pacific/Honolulu', displayName: 'Hawaii, United States' },
};

// Check if query contains a single-timezone state (and no city that might be in a split area)
function checkSingleTimezoneState(query: string): { timezone: string; displayName: string } | null {
  const normalized = query.toLowerCase().trim();

  // Split by comma to get parts
  const parts = normalized.split(',').map(p => p.trim());

  // Check if last part (or only part) is a single-timezone state
  for (const part of parts.reverse()) {
    if (singleTimezoneStates[part]) {
      // If query is JUST the state (no city), return the state timezone
      if (parts.length === 1 || (parts.length === 2 && parts[0] === 'usa')) {
        return singleTimezoneStates[part];
      }
      // If there's a city specified, we should use the API to be accurate
      // But we can still use state timezone as it's a single-timezone state
      const stateInfo = singleTimezoneStates[part];
      // Update display name to include the city
      const city = parts.find(p => p !== part && p !== 'usa');
      return {
        timezone: stateInfo.timezone,
        displayName: city
          ? `${city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}, ${stateInfo.displayName}`
          : stateInfo.displayName
      };
    }
  }

  return null;
}

// Geocode a location using OpenStreetMap Nominatim (free, no API key)
async function geocodeLocation(query: string): Promise<LocationResult> {
  try {
    // Add "USA" to query if it doesn't contain country info, to prioritize US results
    const searchQuery = query.toLowerCase().includes('usa') || query.includes(',')
      ? query
      : `${query}, USA`;

    const cached = getCachedLocation(geocodeCache, searchQuery);
    if (cached) return cached;

    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`;

    const results = await fetchJsonWithRetry<Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>>(url);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    const locationResult = {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name
    };
    setCachedLocation(geocodeCache, searchQuery, locationResult, GEO_CACHE_TTL_MS);
    return locationResult;
  } catch (error) {
    console.error('Geocoding error:', error);
    const status = (error as { status?: number }).status;
    if (status === 429) return { error: 'rate_limited' };
    return { error: 'upstream_unavailable' };
  }
}

// Get generic timezone name without DST/standard designation
function getGenericTimezoneName(timezone: string): string {
  // Map of IANA timezone identifiers to generic names
  const timezoneMap: Record<string, string> = {
    'America/Los_Angeles': 'Pacific',
    'America/Denver': 'Mountain',
    'America/Phoenix': 'Mountain', // Arizona doesn't observe DST
    'America/Chicago': 'Central',
    'America/New_York': 'Eastern',
    'America/Anchorage': 'Alaska',
    'Pacific/Honolulu': 'Hawaii',
    'America/Halifax': 'Atlantic',
    'America/St_Johns': 'Newfoundland'
  };

  // Return mapped name or fallback to timezone name
  return timezoneMap[timezone] || timezone.split('/').pop() || timezone;
}

// API: Lookup timezone for any location
app.get('/api/location', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const dateParam = req.query.date as string; // Optional date for sun times

  if (!query) {
    return res.status(400).json({ error: 'Location query required' });
  }

  let timezone: string;
  let displayName: string;
  let lat: number | null = null;
  let lon: number | null = null;

  // First, check if this is an airport code
  const airportCheck = isAirportCode(query);

  if (airportCheck.isAirport) {
    const airport = await lookupAirport(airportCheck.icaoCode);
    if (airport && 'error' in airport) {
      const message = airport.error === 'rate_limited'
        ? 'Airport lookup rate-limited. Please try again shortly.'
        : 'Airport lookup failed. Please try again.';
      return res.status(airport.error === 'rate_limited' ? 429 : 503).json({ error: message });
    }
    if (airport && !('error' in airport)) {
      lat = airport.lat;
      lon = airport.lon;
      displayName = airport.displayName;
      const timezones = find(lat, lon);
      timezone = timezones[0] || 'UTC';
      console.log(`[Airport] ${query} -> ${airportCheck.icaoCode} -> ${timezone}`);
    } else {
      return res.status(404).json({
        error: 'Airport not found',
        suggestion: `Could not find airport with code "${airportCheck.icaoCode}". Try the full airport name instead.`
      });
    }
  }
  // Check if this is a single-timezone US state (no API call needed)
  else if (checkSingleTimezoneState(query)) {
    const stateMatch = checkSingleTimezoneState(query)!;
    timezone = stateMatch.timezone;
    displayName = stateMatch.displayName;
    console.log(`[Optimized] Skipped API call for: ${query} -> ${timezone}`);
  } else {
    // Fall back to geocoding API for other locations
    const location = await geocodeLocation(query);

    if (location && 'error' in location) {
      const message = location.error === 'rate_limited'
        ? 'Location lookup rate-limited. Please try again shortly.'
        : 'Location lookup failed. Please try again.';
      return res.status(location.error === 'rate_limited' ? 429 : 503).json({ error: message });
    }

    if (!location) {
      return res.status(404).json({
        error: 'Location not found',
        suggestion: 'Try including the state, e.g., "Lincoln, Montana" or "Missoula, MT"'
      });
    }

    lat = location.lat;
    lon = location.lon;

    // Get timezone from coordinates using geo-tz
    const timezones = find(lat, lon);

    if (timezones.length === 0) {
      return res.status(404).json({ error: 'Could not determine timezone for location' });
    }

    timezone = timezones[0];
    displayName = location.displayName;
  }

  // Get generic timezone name (without current DST/standard designation)
  const genericTzName = getGenericTimezoneName(timezone);

  // Calculate sun times if we have coordinates
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  let sunTimes = null;
  if (lat !== null && lon !== null) {
    const times = getSunTimes(lat, lon, targetDate);

    const formatSunTime = (d: Date) => {
      if (!d || isNaN(d.getTime())) return null;
      return {
        utc: d.toISOString(),
        zulu: d.toLocaleTimeString('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) + 'Z',
        local: d.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      };
    };

    sunTimes = {
      civilDawn: formatSunTime(times.civilDawn),
      sunrise: formatSunTime(times.sunrise),
      sunset: formatSunTime(times.sunset),
      civilDusk: formatSunTime(times.civilDusk)
    };
  }

  res.json({
    timezone,
    tzGenericName: genericTzName,
    displayName,
    coordinates: lat !== null ? { lat, lon } : null,
    sunTimes
  });
});

// API: Convert time between UTC and a timezone (bidirectional)
app.post('/api/convert', (req, res) => {
  const { time, timezone, direction, disambiguation } = req.body;

  if (!time || !timezone || !direction) {
    return res.status(400).json({ error: 'time, timezone, and direction required' });
  }

  if (direction !== 'toLocal' && direction !== 'toUTC') {
    return res.status(400).json({ error: 'direction must be "toLocal" or "toUTC"' });
  }

  try {
    let utcDate: Date;
    let resolvedTimezone = timezone as string;

    if (direction === 'toLocal') {
      // Input is UTC, convert to local
      const { instant, timezone: tz } = convertToLocal(time, timezone);
      resolvedTimezone = tz;
      utcDate = new Date(instant.epochMilliseconds);
    } else {
      // Input is local time in the given timezone, convert to UTC
      const allowedDisambiguations: Disambiguation[] = ['compatible', 'earlier', 'later', 'reject'];
      const chosenDisambiguation = (disambiguation ?? 'reject') as Disambiguation;
      if (!allowedDisambiguations.includes(chosenDisambiguation)) {
        return res.status(400).json({
          error: 'disambiguation must be "compatible", "earlier", "later", or "reject"'
        });
      }

      const { instant, timezone: tz } = convertToUTC(time, timezone, chosenDisambiguation);
      resolvedTimezone = tz;
      utcDate = new Date(instant.epochMilliseconds);
    }

    if (isNaN(utcDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Format for display using 24-hour format
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });

    const localFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });

    // Get timezone abbreviation for the SELECTED date (not current date)
    const shortFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimezone,
      timeZoneName: 'short'
    });

    const shortParts = shortFormatter.formatToParts(utcDate);
    const tzAbbr = shortParts.find(p => p.type === 'timeZoneName')?.value || '';
    const isDST = computeIsDST(instantFromDate(utcDate), resolvedTimezone);

    res.json({
      utcFormatted: utcFormatter.format(utcDate),
      localFormatted: localFormatter.format(utcDate),
      utcISO: utcDate.toISOString(),
      timezone: resolvedTimezone,
      tzAbbreviation: tzAbbr,
      isDST
    });
  } catch (error) {
    console.error('Conversion error:', error);
    const message = error instanceof Error ? error.message : 'Invalid timezone or date';
    res.status(400).json({ error: message });
  }
});

// API: Get all IANA timezones
app.get('/api/timezones', (_req, res) => {
  const timezones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
      'America/Anchorage',
      'Pacific/Honolulu'
    ];
  res.json(timezones);
});

// Serve index.html for all language routes
const supportedLangs = ['de', 'fr', 'es', 'pt', 'it', 'pl', 'nl', 'ru', 'ja', 'zh', 'ko', 'ar'];
supportedLangs.forEach(lang => {
  app.get(`/${lang}`, (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
  app.get(`/${lang}/`, (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌍 UTC Time Converter running at http://localhost:${PORT}`);
  });
}

export { app };
