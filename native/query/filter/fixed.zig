const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Instruction = @import("instruction.zig");

pub fn eqBatch(T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    const vectorLen = 16 / utils.sizeOf(T);
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + 16 - c.offset .. i + c.size - c.offset]);
    const len = values.len;
    var j: usize = 0;
    while (j < len - vectorLen) : (j += vectorLen) {
        const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
        if (std.simd.countElementsWithValue(vec2, value) != 0) {
            return true;
        }
    }
    return false;
}

pub fn eqBatchSmall(T: type, q: []u8, v: []const u8, i: usize, c: *t.FilterCondition) bool {
    // 16 will bne simdLen ofc when its configruable
    const vectorLen = 16 / utils.sizeOf(T);
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + 16 - c.offset .. i + c.size - c.offset]);
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

pub inline fn compare(
    T: type,
    comptime op: t.FilterOpCompare,
    q: []u8,
    v: []const u8,
    index: usize,
    c: *t.FilterCondition,
) bool {
    const meta = comptime Instruction.parseOp(op, false);
    const res = switch (meta.func) {
        // --------------------
        .le => le(T, q, v, index, c),
        .lt => lt(T, q, v, index, c),
        .ge => ge(T, q, v, index, c),
        .gt => gt(T, q, v, index, c),
        // --------------------
        .range => range(T, q, v, index, c),
        // --------------------
        .eq => eq(T, q, v, index, c),
        .eqBatch => eqBatch(T, q, v, index, c),
        .eqBatchSmall => eqBatchSmall(T, q, v, index, c),
    };
    return if (meta.invert) !res else res;
}
