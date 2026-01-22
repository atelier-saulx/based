const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

pub inline fn eqBatch(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const vectorLen = 16 / utils.sizeOf(T);
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(
        T,
        q[i + utils.sizeOf(T) - c.offset .. c.size + utils.sizeOf(T) - c.offset],
    );
    const len = values.len / utils.sizeOf(T);
    var j: usize = 0;
    while (j <= (len)) : (j += vectorLen) {
        const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
        if (std.simd.countElementsWithValue(vec2, value) != 0) {
            return true;
        }
    }
    return false;
}

pub inline fn eqBatchSmall(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const vectorLen = 16 / utils.sizeOf(T);
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(
        T,
        q[i + utils.sizeOf(T) - c.offset .. c.size + utils.sizeOf(T) - c.offset],
    );
    const vec2: @Vector(vectorLen, T) = values[0..][0..vectorLen].*;
    return (std.simd.countElementsWithValue(vec2, value) != 0);
}

pub inline fn eq(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    return utils.readPtr(T, q, i + utils.sizeOf(T) - c.offset).* ==
        utils.readPtr(T, v, c.start).*;
}

pub inline fn range(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    // x >= 3 && x <= 11
    // (x -% 3) <= (11 - 3)
    // 3,8

    // std.debug.print(
    //     "DERPI v: {any} l: {any} r: {any} \n",
    //     .{
    //         utils.readPtr(T, v, c.start).*,
    //         utils.readPtr(T, q, i + utils.sizeOf(T) - c.offset).*,
    //         utils.readPtr(T, q, i + (utils.sizeOf(T) * 2) - c.offset).*,
    //     },
    // );

    return (utils.readPtr(T, v, c.start).* -% utils.readPtr(T, q, i + size - c.offset).*) <=
        utils.readPtr(T, q, i + (size * 2) - c.offset).*;
}
