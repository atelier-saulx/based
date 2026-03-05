const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const deflate = @import("./deflate.zig");
const Thread = @import("../../thread/thread.zig");

pub fn parseValue(
    thread: *Thread.Thread,
    q: []u8,
    v: []const u8,
    qI: usize,
    c: *t.FilterCondition,
    comptime fixedLen: bool,
    compare: anytype,
) bool {
    const query: []u8 = q[qI .. c.size + qI];
    var value: []const u8 = undefined;
    if (fixedLen) {
        value = v[1 + c.start .. v[c.start] + 1 + c.start];
    } else if (v.len == 0) {
        return false;
    } else if (v[0] == 1) {
        return deflate.decompress(
            thread,
            void,
            compare,
            query,
            value,
            undefined,
        );
    } else {
        value = v[2 .. v.len - 4];
    }
    return compare(query, value);
}

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

pub fn include(
    query: []const u8,
    value: []const u8,
) bool {
    const l = value.len;
    const ql = query.len;

    // do we want to support ql 0 ?
    if (ql == 0) return true;
    if (l < ql) return false;

    const maxStart = l - ql;

    const useTwoChars = ql >= 2 and switch (query[0]) {
        'a', 'e', 'i', 'o', 'u', 's', 't', 'n', 'r', 'l', 'c', 'd', 'm', 'h', ' ' => true,
        // 'A', 'E', 'I', 'O', 'U', 'S', 'T', 'N', 'R', 'L', 'C', 'D', 'M', 'H' => true,
        else => false,
    };

    const vecLen: usize = if (useTwoChars) vectorLenU8 + 1 else vectorLenU8;

    var i: usize = 0;

    if (l < vecLen) {
        while (i <= maxStart) : (i += 1) {
            if (value[i] == query[0]) {
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[i + j] != query[j]) break;
                }
                if (j == ql) return true;
            }
        }
        return false;
    }

    const queryVector: @Vector(vectorLenU8, u8) = @splat(query[0]);
    const queryVector1: @Vector(vectorLenU8, u8) = @splat(if (useTwoChars) query[1] else 0);

    const startIdx: usize = if (useTwoChars) 2 else 1;
    const lastVector = l - vecLen;

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
        const offset = l - vecLen;
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

pub fn eqVar(
    query: []u8,
    value: []const u8,
) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l != ql) {
        return false;
    }
    if (l < vectorLenU8) {
        while (i < l) : (i += 1) {
            if (value[i] != query[i]) {
                return false;
            }
        }
        return true;
    }
    while (i + vectorLenU8 <= l) : (i += vectorLenU8) {
        const v: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;
        const q: @Vector(vectorLenU8, u8) = query[i..][0..vectorLenU8].*;
        if (!@reduce(.And, v == q)) {
            return false;
        }
    }
    if (i < l) {
        const offset = l - vectorLenU8;
        const v: @Vector(vectorLenU8, u8) = value[offset..][0..vectorLenU8].*;
        const q: @Vector(vectorLenU8, u8) = query[offset..][0..vectorLenU8].*;
        if (!@reduce(.And, v == q)) {
            return false;
        }
    }
    return true;
}

// different format
pub fn eqCrc32(
    q: []u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
) bool {
    if (v[0] == 1) {
        // compressed different pathway (different positing)
    } else {
        if (utils.readPtr(u32, q, i + 4 + @alignOf(u32) - c.offset).* != v.len - 6) {
            return false;
        }
        if (utils.read(u32, v, v.len - 4) != utils.readPtr(u32, q, i + @alignOf(u32) - c.offset).*) {
            return false;
        }
    }
    return true;
}
