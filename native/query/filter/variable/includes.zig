const std = @import("std");

const CAPITAL = 32;

const vectorLenU8 = std.simd.suggestVectorLength(u8) orelse 16;
const indexes = std.simd.iota(u8, vectorLenU8);
const nulls: @Vector(vectorLenU8, u8) = @splat(@as(u8, 255));
const ones: @Vector(vectorLenU8, u8) = @splat(1);
const zeros: @Vector(vectorLenU8, u8) = @splat(0);
const falses: @Vector(vectorLenU8, bool) = @splat(false); // Helper for Vector AND
const MaskInt = std.meta.Int(.unsigned, vectorLenU8);
const zeroesMask: @Vector(vectorLenU8, MaskInt) = @splat(0);
const indexBitMask: @Vector(vectorLenU8, MaskInt) = blk: {
    var weights: [vectorLenU8]MaskInt = undefined;
    for (&weights, 0..) |*w, idx| w.* = @as(MaskInt, 1) << @intCast(idx);
    break :blk weights;
};

inline fn includeVector(
    comptime useTwoChars: bool,
    comptime _: bool,
    query: []const u8,
    value: []const u8,
) bool {
    const vecLen = if (useTwoChars) vectorLenU8 + 1 else vectorLenU8;
    const maxStart = value.len - query.len;
    var i: usize = 0;
    const queryVector: @Vector(vectorLenU8, u8) = @splat(query[0]);

    const queryVector1: if (useTwoChars) @Vector(vectorLenU8, u8) else void =
        if (useTwoChars) @splat(query[1]) else undefined;

    const startIdx: usize = if (useTwoChars) 2 else 1;
    const lastVector = value.len - vecLen;
    while (i <= lastVector) : (i += vectorLenU8) {
        const h: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;
        var matches = h == queryVector;
        if (useTwoChars) {
            const h1: @Vector(vectorLenU8, u8) = value[i + 1 ..][0..vectorLenU8].*;
            matches = @select(bool, matches, h1 == queryVector1, falses);
        }
        if (@reduce(.Or, matches)) {
            if (@reduce(.Add, @select(u8, matches, ones, zeros)) == 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index > maxStart) return false;
                if (index >= 0) {
                    var j: usize = startIdx;
                    while (j < query.len) : (j += 1) {
                        if (value[index + j] != query[j]) break;
                    }
                    if (j == query.len) return true;
                }
            } else {
                const masked = @select(MaskInt, matches, indexBitMask, zeroesMask);
                var mask = @reduce(.Add, masked);
                while (mask != 0) {
                    const k = @ctz(mask);
                    const start = i + k;
                    if (start <= maxStart) {
                        var j: usize = startIdx;
                        while (j < query.len) : (j += 1) {
                            if (value[start + j] != query[j]) break;
                        }
                        if (j == query.len) return true;
                    } else {
                        return false;
                    }
                    mask &= (mask - 1);
                }
            }
        }
    }
    if (i <= maxStart) {
        const offset = value.len - vecLen;
        const h: @Vector(vectorLenU8, u8) = value[offset..][0..vectorLenU8].*;
        var matches = h == queryVector;
        if (useTwoChars) {
            const h1: @Vector(vectorLenU8, u8) = value[offset + 1 ..][0..vectorLenU8].*;
            matches = @select(bool, matches, h1 == queryVector1, falses);
        }
        if (@reduce(.Or, matches)) {
            if (@reduce(.Add, @select(u8, matches, ones, zeros)) == 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + offset;
                if (index > maxStart) return false;
                if (index >= i) {
                    var j: usize = startIdx;
                    while (j < query.len) : (j += 1) {
                        if (value[index + j] != query[j]) break;
                    }
                    if (j == query.len) return true;
                }
            } else {
                const masked = @select(MaskInt, matches, indexBitMask, zeroesMask);
                var mask = @reduce(.Add, masked);
                while (mask != 0) {
                    const k = @ctz(mask);
                    const start = offset + k;
                    if (start <= maxStart) {
                        if (start >= i) {
                            var j: usize = startIdx;
                            while (j < query.len) : (j += 1) {
                                if (value[start + j] != query[j]) break;
                            }
                            if (j == query.len) return true;
                        }
                    } else {
                        return false;
                    }
                    mask &= (mask - 1);
                }
            }
        }
    }
    return false;
}

pub fn includeInner(
    comptime lowerCase: bool,
    query: []const u8,
    value: []const u8,
) bool {
    if (query.len == 0) return true;
    if (value.len < query.len) return false;
    const useTwoChars = query.len >= 2 and switch (query[0]) {
        'a', 'e', 'i', 'o', 'u', 's', 't', 'n', 'r', 'l', 'c', 'd', 'm', 'h', ' ' => true,
        // 'A', 'E', 'I', 'O', 'U', 'S', 'T', 'N', 'R', 'L', 'C', 'D', 'M', 'H' => true,
        else => false,
    };

    const vecLen: usize = if (useTwoChars) vectorLenU8 + 1 else vectorLenU8;

    if (value.len < vecLen) {
        var i: usize = 0;
        const maxStart = value.len - query.len;
        // if (lowerCase) {
        //     const firstCharCapital = query[0] - CAPITAL;
        //     while (i <= maxStart) : (i += 1) {
        //         if (value[i] == query[0] or value[i] == firstCharCapital) {
        //             var j: usize = 1;
        //             while (j < query.len) : (j += 1) {
        //                 if (value[i + j] != query[j] or
        //                     value[i + j] != query[j] - CAPITAL)
        //                 {
        //                     break;
        //                 }
        //             }
        //             if (j == query.len) return true;
        //         }
        //     }
        // } else {
        while (i <= maxStart) : (i += 1) {
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
        // }
        return false;
    }
    if (useTwoChars) {
        return includeVector(true, lowerCase, query, value);
    }
    return includeVector(false, lowerCase, query, value);
}
