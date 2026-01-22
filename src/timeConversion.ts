import { Temporal } from '@js-temporal/polyfill';

export type ConvertDirection = 'toLocal' | 'toUTC';
export type Disambiguation = 'compatible' | 'earlier' | 'later' | 'reject';

const OFFSET_RE = /[zZ]|[+-]\d{2}:\d{2}$|[+-]\d{4}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseInstantStrict(value: string): Temporal.Instant {
  if (!OFFSET_RE.test(value)) {
    throw new Error('UTC input requires an explicit offset or Z suffix');
  }
  return Temporal.Instant.from(value);
}

export function parsePlainDateTimeStrict(value: string): Temporal.PlainDateTime {
  if (OFFSET_RE.test(value)) {
    throw new Error('Local time must not include a UTC offset or Z suffix');
  }
  if (DATE_ONLY_RE.test(value)) {
    return Temporal.PlainDate.from(value).toPlainDateTime();
  }
  return Temporal.PlainDateTime.from(value);
}

export function convertToLocal(utcTime: string, timezone: string) {
  const tz = Temporal.TimeZone.from(timezone);
  const instant = parseInstantStrict(utcTime);
  const zonedDateTime = instant.toZonedDateTimeISO(tz);
  return { instant, zonedDateTime, timezone: tz.id };
}

export function convertToUTC(localTime: string, timezone: string, disambiguation: Disambiguation) {
  const tz = Temporal.TimeZone.from(timezone);
  const plainDateTime = parsePlainDateTimeStrict(localTime);
  const zonedDateTime = Temporal.ZonedDateTime.from(
    {
      timeZone: tz,
      calendar: plainDateTime.calendarId,
      year: plainDateTime.year,
      month: plainDateTime.month,
      day: plainDateTime.day,
      hour: plainDateTime.hour,
      minute: plainDateTime.minute,
      second: plainDateTime.second,
      millisecond: plainDateTime.millisecond,
      microsecond: plainDateTime.microsecond,
      nanosecond: plainDateTime.nanosecond
    },
    { disambiguation }
  );
  const instant = zonedDateTime.toInstant();
  return { instant, zonedDateTime, timezone: tz.id };
}

export function computeIsDST(instant: Temporal.Instant, timezone: string): boolean {
  const tz = Temporal.TimeZone.from(timezone);
  const zdt = instant.toZonedDateTimeISO(tz);
  const year = zdt.year;
  const jan = Temporal.ZonedDateTime.from({
    timeZone: tz,
    year,
    month: 1,
    day: 15,
    hour: 12,
    minute: 0,
    second: 0,
    calendar: 'iso8601'
  });
  const jul = Temporal.ZonedDateTime.from({
    timeZone: tz,
    year,
    month: 7,
    day: 15,
    hour: 12,
    minute: 0,
    second: 0,
    calendar: 'iso8601'
  });

  const janOffset = jan.offsetNanoseconds;
  const julOffset = jul.offsetNanoseconds;
  if (janOffset === julOffset) {
    return false;
  }

  const standardOffset = Math.min(janOffset, julOffset);
  return zdt.offsetNanoseconds !== standardOffset;
}

export function instantFromDate(date: Date): Temporal.Instant {
  return Temporal.Instant.from(date.toISOString());
}
