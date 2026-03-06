const std = @import("std");
const simd = std.simd; // tmp
const selva = @import("../../../selva/selva.zig");
const read = @import("../../../utils.zig").read;

const TO_CAPITAL = 32;

// Have to add a SAFE mode (for correct matches e.g. } -> ] etc)

const vectorLen = std.simd.suggestVectorLength(u8) orelse 16;
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);
const capitals: @Vector(vectorLen, u8) = @splat(TO_CAPITAL);
const seperatorChars: @Vector(8, u8) = .{ '\n', ' ', '"', '\'', '-', '.', ':', ';' };
// const minDist = 2; // 0,1 is fine

inline fn isSeparator(ch: u8) bool {
    return simd.countElementsWithValue(seperatorChars, ch) > 0;
}

inline fn min(a: usize, b: usize) usize {
    if (a < b) return a;
    return b;
}

fn hamming_ascii(
    value: []const u8,
    i: usize,
    query: []const u8,
) u8 {
    const queryD = query[1..query.len];
    const ql = queryD.len;
    const d: u8 = @truncate(selva.c.strsearch_hamming(
        value[i + 1 .. min(value.len, i + 1 + ql)].ptr,
        queryD.ptr,
        ql,
    ));

    return d;
}

fn hamming_mbs(
    value: []const u8,
    i: usize,
    query: []const u8,
) u8 {
    const mbs = value[i + 1 .. value.len];
    const t = query[1..query.len];
    const d: u8 = @truncate(selva.c.strsearch_hamming_mbs(mbs.ptr, mbs.len, t.ptr, t.len));
    return d;
}

fn hamming(
    value: []const u8,
    i: usize,
    query: []const u8,
) u8 {
    var j: usize = 1;
    const l = min(value.len, 5 * query.len);
    var res: bool = false;
    while (j + 8 < l) : (j += 8) {
        const x: u64 = read(u64, value, j);
        res = res or (x & 0x8080808080808080) != 0;
    }
    while (j + 4 < l) : (j += 4) {
        const x: u32 = read(u32, value, j);
        res = res or (x & 0x80808080) != 0;
    }
    while (j < l) : (j += 1) {
        res = res or (value[j] & 0x80) != 0;
    }
    if (res) {
        return hamming_mbs(value, i, query);
    }
    return hamming_ascii(value, i, query);
}

fn resultMatcher(
    minDist: u8,
    dx: u8,
    matches: @Vector(vectorLen, bool),
    i: usize,
    value: []const u8,
    query: []const u8,
) u8 {
    var d: u8 = dx;
    const ql = query.len;
    const l = value.len;
    const result = @select(u8, matches, indexes, nulls);
    const index: usize = @reduce(.Min, result) + i;

    if (index + ql > l) {
        return d;
    }

    if (index == 0 or index > 0 and isSeparator(value[index - 1])) {
        const nd = hamming(value, index, query);
        if (nd < minDist) {
            return nd;
        } else if (nd < d) {
            d = nd;
        }
    }

    if (simd.countTrues(matches) != 1) {
        var p: usize = index - i + 1;
        while (p < vectorLen) : (p += 1) {
            if (matches[p]) {
                if (isSeparator(value[p + i - 1])) {
                    const nd = hamming(value, p + i, query);
                    if (nd < minDist) {
                        return nd;
                    } else if (nd < d) {
                        d = nd;
                    }
                }
            }
        }
    }
    return d;
}

pub fn like(
    minDist: u8,
    query: []const u8,
    value: []const u8,
) u8 {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = query[0] - TO_CAPITAL;
    var d: u8 = 10;

    if (l < vectorLen) {
        while (i < l) : (i += 1) {
            // needs to start at 0...
            if ((value[i] == q1 or value[i] == q2) and (i == 0 or isSeparator(value[i - 1]))) {
                if (i + ql > l) {
                    return d;
                }
                const nd = hamming(value, i, query);
                if (nd < minDist) {
                    return nd;
                } else if (nd < d) {
                    d = nd;
                }
            }
        }
        return d;
    }

    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    const queryVectorCapital: @Vector(vectorLen, u8) = @splat(q2);

    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;

        // do simliar is include here
        // also use std.ascitoLower

        if (@reduce(.Or, matches)) {
            d = resultMatcher(minDist, d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }

        matches = h == queryVectorCapital;

        if (@reduce(.Or, matches)) {
            d = resultMatcher(minDist, d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }
    }

    // Use trailing vec here (similair with offset)
    while (i < l - 1) : (i += 1) {
        if ((value[i + 1] == q1 or value[i + 1] == q2) and isSeparator(value[i])) {
            if (i + ql - 1 > l) {
                return d;
            }
            const nd = hamming(value, i + 1, query);
            if (nd < minDist) {
                return nd;
            } else if (nd < d) {
                d = nd;
            }
        }
    }

    return d;
}
