const std = @import("std");

const TO_CAPITAL = 32;

const vectorLen = std.simd.suggestVectorLength(u8) orelse 16;
const indexes = std.simd.iota(u8, vectorLen);
const nulls: @Vector(vectorLen, u8) = @splat(@as(u8, 255));
const ones: @Vector(vectorLen, u8) = @splat(1);
const zeroes: @Vector(vectorLen, u8) = @splat(0);
const falses: @Vector(vectorLen, bool) = @splat(false); // Helper for Vector AND
const MaskInt = std.meta.Int(.unsigned, vectorLen);
const zeroesMask: @Vector(vectorLen, MaskInt) = @splat(0);
const indexBitMask: @Vector(vectorLen, MaskInt) = blk: {
    var weights: [vectorLen]MaskInt = undefined;
    for (&weights, 0..) |*w, idx| w.* = @as(MaskInt, 1) << @intCast(idx);
    break :blk weights;
};
const vecA: @Vector(vectorLen, u8) = @splat('A');
const vecZ: @Vector(vectorLen, u8) = @splat('Z');
const vecZMinA: @Vector(vectorLen, u8) = @splat('Z' - 'A');
const captialMask: @Vector(vectorLen, u8) = @splat(TO_CAPITAL);

inline fn safeToLowerVec(
    comptime case: Case,
    vec: @Vector(vectorLen, u8),
) @Vector(vectorLen, u8) {
    return switch (case) {
        .default => vec,
        .lowerFast => vec | captialMask,
        .lower => {
            const isUpper = vec -% vecA <= vecZMinA;
            const mask = @select(u8, isUpper, captialMask, zeroes);
            return vec | mask;
        },
    };
}

pub const Case = enum {
    default, // exact
    lowerFast, // `| 32` mask (for a-z 0-9 queries)
    lower, // if special chars e.g. { , ], @.
};

inline fn includeBody(
    comptime useTwoChars: bool,
    comptime case: Case,
    query: []const u8,
    value: []const u8,
    i: usize,
    qVec: @Vector(vectorLen, u8),
    qVecFirstTwo: if (useTwoChars) @Vector(vectorLen, u8) else void,
    maxStart: usize,
) ?bool {
    // batch requires re-use of the qVec
    const startIdx: comptime_int = if (useTwoChars) 2 else 1;
    const h = safeToLowerVec(case, value[i..][0..vectorLen].*);
    var matches = h == qVec;
    if (useTwoChars) {
        const h1: @Vector(vectorLen, u8) = safeToLowerVec(case, value[i + 1 ..][0..vectorLen].*);
        matches = @select(bool, matches, h1 == qVecFirstTwo, falses);
    }
    if (@reduce(.Or, matches)) {
        if (std.simd.countTrues(matches) == 1) {
            const result = @select(u8, matches, indexes, nulls);
            const start = @reduce(.Min, result) + i;
            if (start > maxStart) return false;
            var j: usize = startIdx;
            while (j < query.len) : (j += 1) {
                if (case == .default) {
                    if (value[start + j] != query[j]) break;
                } else {
                    if (std.ascii.toLower(value[start + j]) != query[j]) break;
                }
            }
            if (j == query.len) return true;
        } else {
            const masked = @select(MaskInt, matches, indexBitMask, zeroesMask);
            var mask = @reduce(.Add, masked);
            while (mask != 0) {
                const k = @ctz(mask);
                const start = i + k;
                if (start <= maxStart) {
                    var j: usize = startIdx;
                    while (j < query.len) : (j += 1) {
                        if (case == .default) {
                            if (value[start + j] != query[j]) break;
                        } else {
                            if (std.ascii.toLower(value[start + j]) != query[j]) break;
                        }
                    }
                    if (j == query.len) return true;
                } else {
                    return false;
                }
                mask &= (mask - 1);
            }
        }
    }
    return null;
}

inline fn includeVector(
    comptime useTwoChars: bool,
    comptime case: Case,
    query: []const u8,
    value: []const u8,
) bool {
    const vecLen = if (useTwoChars) vectorLen + 1 else vectorLen;
    const maxStart = value.len - query.len;
    const lastVector = value.len - vecLen;
    var i: usize = 0;

    const q: @Vector(vectorLen, u8) = @splat(query[0]);
    const qFirstTwo: if (useTwoChars) @Vector(vectorLen, u8) else void =
        if (useTwoChars) @splat(query[1]) else undefined;

    while (i <= lastVector) : (i += vectorLen) {
        if (includeBody(useTwoChars, case, query, value, i, q, qFirstTwo, maxStart)) |pass| {
            return pass;
        }
    }

    if (i <= maxStart) {
        const offset = value.len - vecLen;
        if (includeBody(useTwoChars, case, query, value, offset, q, qFirstTwo, maxStart)) |pass| {
            return pass;
        }
    }

    return false;
}

// will add another which is BATCH

// for batch have to prep the queries in a vector in the actualy query we loaded
// this means we need to allocated 16bytes extra in the query ... not great
// other option is to make some shared mem that we use for this

pub fn include(
    comptime case: Case,
    query: []const u8,
    value: []const u8,
) bool {
    if (query.len == 0) return true;
    if (value.len < query.len) return false;
    const useTwoChars = query.len >= 2 and switch (query[0]) {
        'a', 'e', 'i', 'o', 'u', 's', 't', 'n', 'r', 'l', 'c', 'd', 'm', 'h', ' ' => true,
        // might not need this
        // 'A', 'E', 'I', 'O', 'U', 'S', 'T', 'N', 'R', 'L', 'C', 'D', 'M', 'H' => true,
        else => false,
    };

    const vecLen: usize = if (useTwoChars) vectorLen + 1 else vectorLen;

    if (value.len < vecLen) {
        var i: usize = 0;
        const maxStart = value.len - query.len;
        while (i <= maxStart) : (i += 1) {
            if (case == .default) {
                if (value[i] == query[0]) {
                    var j: usize = 1;
                    while (j < query.len) : (j += 1) {
                        if (value[i + j] != query[j]) {
                            break;
                        }
                    }
                    if (j == query.len) return true;
                }
            } else {
                if (std.ascii.toLower(value[i]) == query[0]) {
                    var j: usize = 1;
                    while (j < query.len) : (j += 1) {
                        if (std.ascii.toLower(value[i + j]) != query[j]) {
                            break;
                        }
                    }
                    if (j == query.len) return true;
                }
            }
        }
        return false;
    }

    if (useTwoChars) {
        return includeVector(true, case, query, value);
    }

    return includeVector(false, case, query, value);
}
