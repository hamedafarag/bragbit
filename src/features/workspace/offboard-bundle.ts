/**
 * Pure helpers for assembling the member-removal bundle (ENH-CO-01). Kept free of
 * DB/storage/email imports so the cap + naming logic is unit-testable without the
 * server runtime; `offboard.ts` composes these with the data + email side effects.
 */

/**
 * Greedily keep files whose running total stays within `capBytes`; the rest are
 * skipped. A small file can still fit after a larger one is skipped.
 */
export function pickFilesWithinCap<T extends { sizeBytes: number }>(
  files: T[],
  capBytes: number,
): { included: T[]; skipped: T[] } {
  const included: T[] = [];
  const skipped: T[] = [];
  let total = 0;
  for (const f of files) {
    if (total + f.sizeBytes <= capBytes) {
      included.push(f);
      total += f.sizeBytes;
    } else {
      skipped.push(f);
    }
  }
  return { included, skipped };
}

/** A file name can repeat across brags; make each email attachment name unique. */
export function uniqueName(name: string, seen: Set<string>): string {
  if (!seen.has(name)) {
    seen.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (seen.has(candidate)) {
    i += 1;
    candidate = `${stem} (${i})${ext}`;
  }
  seen.add(candidate);
  return candidate;
}
