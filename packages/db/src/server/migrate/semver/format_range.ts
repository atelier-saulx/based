// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.
import { format } from './format.js'
import type { Comparator, Range } from './types.js'
import { isWildcardComparator } from './_shared.js'

function formatComparator(comparator: Comparator): string {
  const { operator } = comparator
  return `${operator === undefined ? '' : operator}${
    isWildcardComparator(comparator) ? '*' : format(comparator)
  }`
}

/**
 * Formats the SemVerrange into a string.
 *
 * @example Usage
 * ```ts
 * import { formatRange, parseRange } from "@std/semver";
 * import { assertEquals } from "@std/assert";
 *
 * const range = parseRange(">=1.2.3 <1.2.4");
 * assertEquals(formatRange(range), ">=1.2.3 <1.2.4");
 * ```
 *
 * @param range The range to format
 * @returns A string representation of the SemVer range
 */
export function formatRange(range: Range): string {
  return range
    .map((c) => c.map((c) => formatComparator(c)).join(' '))
    .join('||')
}
