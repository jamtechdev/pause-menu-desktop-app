import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatTime,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
} from '../timeUtils';

describe('timeUtils', () => {
  beforeEach(() => {
    // Mock current date to ensure consistent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatTime', () => {
    it('should format time in HH:mm format', () => {
      // Use local time to avoid timezone issues
      const date = new Date(2024, 0, 15, 14, 30, 0);
      expect(formatTime(date)).toBe('14:30');
    });

    it('should handle midnight', () => {
      const date = new Date(2024, 0, 15, 0, 0, 0);
      expect(formatTime(date)).toBe('00:00');
    });

    it('should handle single digit hours and minutes', () => {
      const date = new Date(2024, 0, 15, 9, 5, 0);
      expect(formatTime(date)).toBe('09:05');
    });
  });

  describe('formatDate', () => {
    it('should return "Today" for today\'s date', () => {
      const today = new Date('2024-01-15T12:00:00Z');
      expect(formatDate(today)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday\'s date', () => {
      const yesterday = new Date('2024-01-14T12:00:00Z');
      expect(formatDate(yesterday)).toBe('Yesterday');
    });

    it('should format other dates as "MMM d, yyyy"', () => {
      const date = new Date('2024-01-10T12:00:00Z');
      expect(formatDate(date)).toBe('Jan 10, 2024');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      // Use a date in local time to avoid timezone conversion issues
      // Create date for Jan 15, 2024 at 14:30 in local time
      const date = new Date(2024, 0, 15, 14, 30, 0);
      const formatted = formatDateTime(date);
      // The format should match the pattern, but timezone may vary
      expect(formatted).toMatch(/Jan 15, 2024 \d{2}:\d{2}/);
      // More specific: check that it contains the date and time format
      expect(formatted).toContain('Jan 15, 2024');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time with suffix', () => {
      const pastDate = new Date('2024-01-15T11:00:00Z');
      const result = formatRelativeTime(pastDate);
      expect(result).toContain('ago');
    });

    it('should handle future dates', () => {
      const futureDate = new Date('2024-01-15T13:00:00Z');
      const result = formatRelativeTime(futureDate);
      expect(result).toContain('in');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds as MM:SS', () => {
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(5)).toBe('0:05');
    });

    it('should format hours as HH:MM:SS', () => {
      expect(formatDuration(3665)).toBe('1:01:05');
      expect(formatDuration(7200)).toBe('2:00:00');
    });

    it('should handle zero seconds', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should handle large durations', () => {
      expect(formatDuration(36665)).toBe('10:11:05');
    });
  });
});

