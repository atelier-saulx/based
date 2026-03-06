const std = @import("std");

// const CAPITAL = 32;

const vectorLenU8 = std.simd.suggestVectorLength(u8) orelse 16;
const indexes = std.simd.iota(u8, vectorLenU8);
const nulls: @Vector(vectorLenU8, u8) = @splat(@as(u8, 255));
const ones: @Vector(vectorLenU8, u8) = @splat(1);
const zeroes: @Vector(vectorLenU8, u8) = @splat(0);
const falses: @Vector(vectorLenU8, bool) = @splat(false); // Helper for Vector AND
const MaskInt = std.meta.Int(.unsigned, vectorLenU8);
const zeroesMask: @Vector(vectorLenU8, MaskInt) = @splat(0);
const indexBitMask: @Vector(vectorLenU8, MaskInt) = blk: {
    var weights: [vectorLenU8]MaskInt = undefined;
    for (&weights, 0..) |*w, idx| w.* = @as(MaskInt, 1) << @intCast(idx);
    break :blk weights;
};
const vecA: @Vector(vectorLenU8, u8) = @splat('A');
const vecZ: @Vector(vectorLenU8, u8) = @splat('Z');
const vec32: @Vector(vectorLenU8, u8) = @splat(32);

inline fn includeBody(
    comptime useTwoChars: bool,
    comptime isLowerCase: bool,
    query: []const u8,
    value: []const u8,
    i: usize,
    qVec: @Vector(vectorLenU8, u8),
    qVecFirstTwo: if (useTwoChars) @Vector(vectorLenU8, u8) else void,
    maxStart: usize,
) ?bool {
    const startIdx: comptime_int = if (useTwoChars) 2 else 1;

    const hRaw: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;

    const h = if (comptime isLowerCase) blk: {
        // This is potentialy not the fastest
        // we can make a seperate operator
        // when we know that query only contains [a-z] to not do these extra operations
        // but onlyh hRaw | vec2;
        const isGe = hRaw >= vecA;
        const isLe = hRaw <= vecZ;
        const isUpper = @select(bool, isGe, isLe, falses);
        // only apply 32 bit bit cast to letters (else lower case makes no sense and breaks using a mask)
        const mask = @select(u8, isUpper, vec32, zeroes);
        break :blk hRaw | mask;
    } else hRaw;

    var matches = h == qVec;

    if (useTwoChars) {
        const h1: @Vector(vectorLenU8, u8) = value[i + 1 ..][0..vectorLenU8].*;
        matches = @select(bool, matches, h1 == qVecFirstTwo, falses);
    }

    if (@reduce(.Or, matches)) {
        if (std.simd.countTrues(matches) == 1) {
            const result = @select(u8, matches, indexes, nulls);
            const start = @reduce(.Min, result) + i;
            if (start > maxStart) return false;
            var j: usize = startIdx;
            while (j < query.len) : (j += 1) {
                if (isLowerCase) {
                    if (std.ascii.toLower(value[start + j]) != query[j]) break;
                } else {
                    if (value[start + j] != query[j]) break;
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
                        if (isLowerCase) {
                            if (std.ascii.toLower(value[start + j]) != query[j]) break;
                        } else {
                            if (value[start + j] != query[j]) break;
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
    comptime isLowerCase: bool,
    query: []const u8,
    value: []const u8,
) bool {
    const vecLen = if (useTwoChars) vectorLenU8 + 1 else vectorLenU8;
    const maxStart = value.len - query.len;
    var i: usize = 0;

    const qVec: @Vector(vectorLenU8, u8) = @splat(query[0]);
    const qVecFirstTwo: if (useTwoChars) @Vector(vectorLenU8, u8) else void =
        if (useTwoChars) @splat(query[1]) else undefined;

    const lastVector = value.len - vecLen;

    while (i <= lastVector) : (i += vectorLenU8) {
        if (includeBody(
            useTwoChars,
            isLowerCase,
            query,
            value,
            i,
            qVec,
            qVecFirstTwo,
            maxStart,
        )) |b| {
            return b;
        }
    }
    if (i <= maxStart) {
        const offset = value.len - vecLen;
        if (includeBody(
            useTwoChars,
            isLowerCase,
            query,
            value,
            offset,
            qVec,
            qVecFirstTwo,
            maxStart,
        )) |b| {
            return b;
        }
    }
    return false;
}

// We can add FAST LOWER CASE if we can use only NUMBERS or LETTERS
pub fn includeInner(
    comptime lowerCase: bool,
    query: []const u8,
    value: []const u8,
) bool {
    if (query.len == 0) return true;
    if (value.len < query.len) return false;
    const useTwoChars = !lowerCase and query.len >= 2 and switch (query[0]) {
        'a', 'e', 'i', 'o', 'u', 's', 't', 'n', 'r', 'l', 'c', 'd', 'm', 'h', ' ' => true,
        // 'A', 'E', 'I', 'O', 'U', 'S', 'T', 'N', 'R', 'L', 'C', 'D', 'M', 'H' => true,
        else => false,
    };

    const vecLen: usize = if (useTwoChars) vectorLenU8 + 1 else vectorLenU8;

    if (value.len < vecLen) {
        var i: usize = 0;
        const maxStart = value.len - query.len;
        while (i <= maxStart) : (i += 1) {
            if (lowerCase) {
                if (std.ascii.toLower(value[i]) == query[0]) {
                    var j: usize = 1;
                    while (j < query.len) : (j += 1) {
                        if (std.ascii.toLower(value[i + j]) != query[j]) {
                            break;
                        }
                    }
                    if (j == query.len) return true;
                }
            } else {
                if (value[i] == query[0]) {
                    var j: usize = 1;
                    while (j < query.len) : (j += 1) {
                        if (value[i + j] != query[j]) {
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
        return includeVector(true, lowerCase, query, value);
    }
    return includeVector(false, lowerCase, query, value);
}
