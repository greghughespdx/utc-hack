import { describe, it, expect } from 'vitest';
import {
  computeIsDST,
  convertToLocal,
  convertToUTC
} from './timeConversion.js';

describe('time conversion with Temporal', () => {
  it('converts UTC instant to local time with offset input', () => {
    const { zonedDateTime } = convertToLocal('2025-01-15T12:00:00Z', 'America/New_York');
    expect(zonedDateTime.toPlainDateTime().toString()).toBe('2025-01-15T07:00:00');
  });

  it('converts local time to UTC respecting DST', () => {
    const { instant } = convertToUTC('2025-07-01T12:30:00', 'America/New_York', 'reject');
    expect(instant.toString()).toBe('2025-07-01T16:30:00Z');
  });

  it('rejects offset input for toUTC', () => {
    expect(() =>
      convertToUTC('2025-07-01T12:30:00Z', 'America/New_York', 'reject')
    ).toThrow();
  });

  it('rejects missing offset input for toLocal', () => {
    expect(() => convertToLocal('2025-07-01T12:30:00', 'America/New_York')).toThrow();
  });

  it('rejects nonexistent local times during DST spring-forward', () => {
    expect(() =>
      convertToUTC('2025-03-09T02:30:00', 'America/New_York', 'reject')
    ).toThrow();
  });

  it('disambiguates overlapping local times during DST fall-back', () => {
    const earlier = convertToUTC('2025-11-02T01:30:00', 'America/New_York', 'earlier');
    const later = convertToUTC('2025-11-02T01:30:00', 'America/New_York', 'later');
    expect(earlier.instant.toString()).toBe('2025-11-02T05:30:00Z');
    expect(later.instant.toString()).toBe('2025-11-02T06:30:00Z');
  });

  it('computes DST flag based on the dominant offset in the year', () => {
    const winter = convertToUTC('2025-01-15T12:00:00', 'America/New_York', 'reject');
    const summer = convertToUTC('2025-07-01T12:00:00', 'America/New_York', 'reject');
    expect(computeIsDST(winter.instant, 'America/New_York')).toBe(false);
    expect(computeIsDST(summer.instant, 'America/New_York')).toBe(true);
  });

  it('handles Europe/London DST transitions', () => {
    const winter = convertToUTC('2025-01-15T12:00:00', 'Europe/London', 'reject');
    const summer = convertToUTC('2025-07-01T12:00:00', 'Europe/London', 'reject');
    expect(winter.instant.toString()).toBe('2025-01-15T12:00:00Z');
    expect(summer.instant.toString()).toBe('2025-07-01T11:00:00Z');
    expect(computeIsDST(winter.instant, 'Europe/London')).toBe(false);
    expect(computeIsDST(summer.instant, 'Europe/London')).toBe(true);
  });

  it('handles non-DST zones consistently', () => {
    const time = convertToUTC('2025-07-01T12:00:00', 'Asia/Kolkata', 'reject');
    expect(time.instant.toString()).toBe('2025-07-01T06:30:00Z');
    expect(computeIsDST(time.instant, 'Asia/Kolkata')).toBe(false);
  });

  it('handles southern hemisphere DST zones', () => {
    const summer = convertToUTC('2025-01-15T12:00:00', 'Australia/Sydney', 'reject');
    const winter = convertToUTC('2025-07-15T12:00:00', 'Australia/Sydney', 'reject');
    expect(summer.instant.toString()).toBe('2025-01-15T01:00:00Z');
    expect(winter.instant.toString()).toBe('2025-07-15T02:00:00Z');
    expect(computeIsDST(summer.instant, 'Australia/Sydney')).toBe(true);
    expect(computeIsDST(winter.instant, 'Australia/Sydney')).toBe(false);
  });
});
