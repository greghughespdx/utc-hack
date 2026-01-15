import express from 'express';
import path from 'path';
import { find } from 'geo-tz';

const app = express();
const PORT = 3000;

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
async function geocodeLocation(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  try {
    // Add "USA" to query if it doesn't contain country info, to prioritize US results
    const searchQuery = query.toLowerCase().includes('usa') || query.includes(',')
      ? query
      : `${query}, USA`;

    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UTCTimeConverter/1.0 (educational project)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const results = await response.json() as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// API: Lookup timezone for any location
app.get('/api/location', async (req, res) => {
  const query = (req.query.q as string || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Location query required' });
  }

  let timezone: string;
  let displayName: string;

  // First, check if this is a single-timezone US state (no API call needed)
  const stateMatch = checkSingleTimezoneState(query);

  if (stateMatch) {
    timezone = stateMatch.timezone;
    displayName = stateMatch.displayName;
    console.log(`[Optimized] Skipped API call for: ${query} -> ${timezone}`);
  } else {
    // Fall back to geocoding API for other locations
    const location = await geocodeLocation(query);

    if (!location) {
      return res.status(404).json({
        error: 'Location not found',
        suggestion: 'Try including the state, e.g., "Lincoln, Montana" or "Missoula, MT"'
      });
    }

    // Get timezone from coordinates using geo-tz
    const timezones = find(location.lat, location.lon);

    if (timezones.length === 0) {
      return res.status(404).json({ error: 'Could not determine timezone for location' });
    }

    timezone = timezones[0];
    displayName = location.displayName;
  }

  // Get current time info for this timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short'
  });
  const parts = formatter.formatToParts(now);
  const tzAbbr = parts.find(p => p.type === 'timeZoneName')?.value || '';

  res.json({
    timezone,
    tzAbbreviation: tzAbbr,
    displayName
  });
});

// API: Convert time between UTC and a timezone (bidirectional)
app.post('/api/convert', (req, res) => {
  const { time, timezone, direction } = req.body;

  if (!time || !timezone || !direction) {
    return res.status(400).json({ error: 'time, timezone, and direction required' });
  }

  if (direction !== 'toLocal' && direction !== 'toUTC') {
    return res.status(400).json({ error: 'direction must be "toLocal" or "toUTC"' });
  }

  try {
    let inputDate: Date;
    let utcDate: Date;
    let localDate: Date;

    if (direction === 'toLocal') {
      // Input is UTC, convert to local
      inputDate = new Date(time + (time.includes('Z') ? '' : 'Z'));
      utcDate = inputDate;
      localDate = inputDate; // Same instant, different representation
    } else {
      // Input is local time in the given timezone, convert to UTC
      // This is trickier - we need to interpret the input as being in the target timezone
      inputDate = new Date(time);

      // Get the offset for the target timezone at this time
      const localFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Create a date object treating input as the local time in that timezone
      // We'll use a different approach: find the UTC time that, when converted to the timezone, gives us our input
      const targetParts = time.split(/[-T:]/);
      const year = parseInt(targetParts[0]);
      const month = parseInt(targetParts[1]) - 1;
      const day = parseInt(targetParts[2]);
      const hour = parseInt(targetParts[3] || '0');
      const minute = parseInt(targetParts[4] || '0');

      // Start with a guess (treating input as UTC)
      let guess = new Date(Date.UTC(year, month, day, hour, minute, 0));

      // Iterate to find the correct UTC time
      for (let i = 0; i < 3; i++) {
        const formatted = localFormatter.format(guess);
        const [datePart, timePart] = formatted.split(', ');
        const [m, d, y] = datePart.split('/').map(Number);
        const [h, min] = timePart.split(':').map(Number);

        const diffMs =
          (year - y) * 365.25 * 24 * 60 * 60 * 1000 +
          (month - (m - 1)) * 30 * 24 * 60 * 60 * 1000 +
          (day - d) * 24 * 60 * 60 * 1000 +
          (hour - h) * 60 * 60 * 1000 +
          (minute - min) * 60 * 1000;

        guess = new Date(guess.getTime() + diffMs);
      }

      utcDate = guess;
      localDate = new Date(time);
    }

    if (isNaN(utcDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Format for display
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });

    const localFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'long'
    });

    const shortFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });

    const shortParts = shortFormatter.formatToParts(utcDate);
    const tzAbbr = shortParts.find(p => p.type === 'timeZoneName')?.value || '';
    const isDST = tzAbbr.includes('DT') || tzAbbr.includes('Summer');

    res.json({
      utcFormatted: utcFormatter.format(utcDate),
      localFormatted: localFormatter.format(utcDate),
      utcISO: utcDate.toISOString(),
      timezone,
      tzAbbreviation: tzAbbr,
      isDST
    });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(400).json({ error: 'Invalid timezone or date' });
  }
});

// API: Get all IANA timezones
app.get('/api/timezones', (_req, res) => {
  const timezones = Intl.supportedValuesOf('timeZone');
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

app.listen(PORT, () => {
  console.log(`🌍 UTC Time Converter running at http://localhost:${PORT}`);
});
