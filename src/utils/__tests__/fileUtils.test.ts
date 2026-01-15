import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  formatFileSize,
  getFileIcon,
} from '../fileUtils';

describe('fileUtils', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.png')).toBe('png');
      expect(getFileExtension('script.js')).toBe('js');
    });

    it('should handle files with multiple dots', () => {
      expect(getFileExtension('my.file.name.txt')).toBe('txt');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('file')).toBe('');
    });

    it('should handle empty string', () => {
      expect(getFileExtension('')).toBe('');
    });

    it('should handle files starting with dot', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2097152)).toBe('2 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
    });

    it('should round to 2 decimal places', () => {
      const result = formatFileSize(1536);
      expect(result).toMatch(/^\d+\.\d{1,2} KB$/);
    });
  });

  describe('getFileIcon', () => {
    it('should return null (not yet implemented)', () => {
      expect(getFileIcon('pdf')).toBeNull();
      expect(getFileIcon('png')).toBeNull();
    });
  });
});

