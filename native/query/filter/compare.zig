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
};

pub fn eqBatch(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
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

pub fn eqBatchSmall(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    const vectorLen = 16 / size;
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + size - c.offset .. c.size + @alignOf(T) - c.offset]);
    const vec: @Vector(vectorLen, T) = values[0..][0..vectorLen].*;
    return (std.simd.countElementsWithValue(vec, value) != 0);
}

pub fn eq(comptime T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val == target;
}

pub fn lt(comptime T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val < target;
}

pub fn gt(comptime T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val > target;
}

pub fn le(comptime T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val <= target;
}

pub fn ge(comptime T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + @alignOf(T) - c.offset).*;
    return val >= target;
}

pub fn range(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
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
