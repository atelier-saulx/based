const std = @import("std");
const simd = std.simd;
const read = @import("../../../utils.zig").read;
const selva = @import("../../../selva.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const capitals: @Vector(vectorLen, u8) = @splat(32);
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);

pub inline fn restVectorMatch(
    matches: @Vector(vectorLen, bool),
    i: usize,
    ql: usize,
    l: usize,
    value: []const u8,
    query: []const u8,
) u8 {
    const result = @select(u8, matches, indexes, nulls);
    const index = @reduce(.Min, result) + i;
    if (index + ql - 1 > l) {
        return 1;
    }
    var j: usize = 1;
    while (j < ql) : (j += 1) {
        const v = value[index + j];
        const q = query[j];
        if ((v != q and (v != (q - 32)))) {
            break;
        }
    }
    if (j == ql) {
        return 2;
    } else if (simd.countElementsWithValue(matches, true) != 1) {
        var p: usize = index - i;
        while (p < vectorLen) : (p += 1) {
            if (matches[p]) {
                j = 1;
                if (p + i + ql - 1 > l) {
                    return 1;
                }
                while (j < ql) : (j += 1) {
                    const v = value[p + i + j];
                    const q = query[j];
                    // and v != (q - 32) ?
                    if (v != q and v != (q - 32)) {
                        break;
                    }
                }
                if (j == ql) {
                    return 2;
                }
            }
        }
    }
    return 0;
}

pub fn loose(value: []const u8, query: []const u8) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = q1 - 32;

    if (l < vectorLen) {
        while (i < l) : (i += 1) {
            if (value[i] == q1 or value[i] == q2) {
                if (i + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[i + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
        return false;
    }

    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    const queryVectorCaptial: @Vector(vectorLen, u8) = @splat(q2);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;
        if ((@reduce(.Or, matches))) {
            const result = restVectorMatch(matches, i, ql, l, value, query);
            if (result != 0) {
                return result == 2;
            }
        }
        matches = h == queryVectorCaptial;
        if (@reduce(.Or, matches)) {
            const result = restVectorMatch(matches, i, ql, l, value, query);
            if (result != 0) {
                return result == 2;
            }
        }
    }

    while (i < l and ql <= l - i) : (i += 1) {
        const v0 = value[i];
        if (v0 == q1 or v0 == q2) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                const v = value[i + j];
                const q = query[j];
                if (v != q and v != q - 32) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            }
        }
    }
    return false;
}
