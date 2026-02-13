const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

pub const Function = enum(u8) {
    eq,
    lt,
    gt,
    le,
    ge,
    range,
    eqBatch,
    eqBatchSmall,
    inc,
};

pub fn eqBatch(T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    const vectorLen = 16 / size;
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + size - c.offset .. c.size + @alignOf(T) - c.offset]);
    const len = values.len / size;
    var j: usize = 0;
    while (j <= (len)) : (j += vectorLen) {
        const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
        if (std.simd.countElementsWithValue(vec2, value) != 0) {
            return true;
        }
    }
    return false;
}

pub fn eqBatchSmall(T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    const vectorLen = 16 / size;
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + size - c.offset .. c.size + @alignOf(T) - c.offset]);
    const vec: @Vector(vectorLen, T) = values[0..][0..vectorLen].*;
    return (std.simd.countElementsWithValue(vec, value) != 0);
}

pub fn eq(comptime T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val == target;
}

pub fn lt(comptime T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val < target;
}

pub fn gt(comptime T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val > target;
}

pub fn le(comptime T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val <= target;
}

pub fn ge(comptime T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val >= target;
}

pub fn range(T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    if (T == f64) {
        // Floats do not support ignore overflow
        return (utils.readPtr(T, v, c.start).* - utils.readPtr(T, q, i + @alignOf(T) - c.offset).*) <=
            utils.readPtr(T, q, i + (size * 2) - c.offset).*;
    }
    // x >= 3 && x <= 11
    // (x -% 3) <= (11 - 3)
    // 3,8
    return (utils.readPtr(T, v, c.start).* -% utils.readPtr(T, q, i + @alignOf(T) - c.offset).*) <=
        utils.readPtr(T, q, i + (size * 2) - c.offset).*;
}

// put this in variableSize
// this with batching => [a,b,c] quite nice
const vectorLenU8 = std.simd.suggestVectorLength(u8).?;
const indexes = std.simd.iota(u8, vectorLenU8);
const nulls: @Vector(vectorLenU8, u8) = @splat(@as(u8, 255));

pub fn include(q: []u8, v: []const u8, qI: usize, c: *t.FilterCondition) bool {
    const query: []u8 = q[qI .. c.size + qI];
    var value: []const u8 = undefined;

    // Make the has seperate we also need to use LIKE
    // FIX COMPRESS
    if (v[0] == 1) {
        // compressed
        value = v[0..3];
    } else {
        value = v[2 .. v.len - 4];
    }

    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l < vectorLenU8) {
        while (i < l) : (i += 1) {
            if (value[i] == query[0]) {
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

    const queryVector: @Vector(vectorLenU8, u8) = @splat(query[0]);

    while (i <= (l - vectorLenU8)) : (i += vectorLenU8) {
        const h: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            if (l > 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }
    while (i < l and ql <= l - i) : (i += 1) {
        const id2 = value[i];
        if (id2 == query[0]) {
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
            return true;
        }
    }
    return false;
}
