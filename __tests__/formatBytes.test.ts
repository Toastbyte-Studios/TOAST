import { formatBytes } from '../src/navigation/utils/formatBytes';

describe('formatBytes', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('≈ 0 B');
    expect(formatBytes(512)).toBe('≈ 512 B');
    expect(formatBytes(1023)).toBe('≈ 1023 B');
  });

  it('formats KB range', () => {
    expect(formatBytes(1024)).toBe('≈ 1 KB');
    expect(formatBytes(512 * 1024)).toBe('≈ 512 KB');
  });

  it('formats MB range', () => {
    expect(formatBytes(1024 * 1024)).toBe('≈ 1.0 MB');
    expect(formatBytes(28_450_000)).toBe('≈ 27.1 MB');
    expect(formatBytes(500 * 1024 * 1024)).toBe('≈ 500.0 MB');
  });

  it('formats GB range', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('≈ 1.0 GB');
    expect(formatBytes(1_500_000_000)).toBe('≈ 1.4 GB');
  });

  it('boundary: exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('≈ 1 KB');
  });

  it('boundary: exactly 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('≈ 1.0 MB');
  });

  it('boundary: exactly 1 GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('≈ 1.0 GB');
  });
});
