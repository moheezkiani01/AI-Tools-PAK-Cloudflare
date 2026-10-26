/** Calculate one continuous admin page across original and imported catalogues. */
export function unifiedPage(originalCount, page = 1, size = 36, source = "all") {
  const first = (Math.max(1, page) - 1) * size;
  const localCount = source === "imported" ? 0 : originalCount;
  const originalStart = Math.min(first, localCount);
  const originalEnd = Math.min(first + size, localCount);
  const importOffset = Math.max(0, first - localCount);
  const importLimit = source === "original" ? 0 : size - (originalEnd - originalStart);
  return { originalStart, originalEnd, importOffset, importLimit, first };
}

export function unifiedPageCount(originalCount, importedCount, size = 36, source = "all") {
  if (source !== "original" && !Number.isSafeInteger(importedCount)) return null;
  const localCount = source === "imported" ? 0 : originalCount;
  return Math.max(1, Math.ceil((localCount + (source === "original" ? 0 : importedCount)) / size));
}
