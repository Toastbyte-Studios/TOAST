/**
 * Formats a byte count as a human-readable approximate size string.
 * Uses binary (1024-based) units by default to match device storage conventions.
 *
 * @example
 * formatBytes(28_450_000) // '≈ 27 MB'
 * formatBytes(1_500_000_000) // '≈ 1.4 GB'
 * formatBytes(512) // '≈ 512 B'
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `≈ ${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `≈ ${(bytes / 1024).toFixed(0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `≈ ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `≈ ${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
