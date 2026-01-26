const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

pub const Op = enum(u8) {
    eq = 1,
    lt = 2,
    gt = 3,
    le = 4,
    ge = 5,
};

pub const Function = enum { Single, Range, Batch, BatchSmall };

pub inline fn batch(comptime op: Op, T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    const vectorLen = 16 / size;
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + size - c.offset .. c.size + size - c.offset]);
    const len = values.len / size;
    var j: usize = 0;
    switch (op) {
        .eq => {
            while (j <= (len)) : (j += vectorLen) {
                const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
                if (std.simd.countElementsWithValue(vec2, value) != 0) {
                    return true;
                }
            }
        },
        else => {
            return false;
        },
    }
    return false;
}

pub inline fn batchSmall(comptime op: Op, T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    const vectorLen = 16 / size;
    const value = utils.readPtr(T, v, c.start).*;
    const values = utils.toSlice(T, q[i + size - c.offset .. c.size + size - c.offset]);
    const vec: @Vector(vectorLen, T) = values[0..][0..vectorLen].*;
    switch (op) {
        .eq => {
            return (std.simd.countElementsWithValue(vec, value) != 0);
        },
        .lt => {
            const valueSplat: @Vector(vectorLen, T) = @splat(value);
            return @reduce(.Or, valueSplat > vec);
        },
        .gt => {
            const valueSplat: @Vector(vectorLen, T) = @splat(value);
            return @reduce(.Or, valueSplat < vec);
        },
        .le => {
            const valueSplat: @Vector(vectorLen, T) = @splat(value);
            return @reduce(.Or, valueSplat >= vec);
        },
        .ge => {
            const valueSplat: @Vector(vectorLen, T) = @splat(value);
            return @reduce(.Or, valueSplat <= vec);
        },
    }
}

pub inline fn single(comptime op: Op, T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    @setEvalBranchQuota(10000);

    const val = utils.readPtr(T, v, c.start).*;
    const target = utils.readPtr(T, q, i + utils.sizeOf(T) - c.offset).*;
    switch (op) {
        .eq => {
            return val == target;
        },
        .lt => {
            return val < target;
        },
        .gt => {
            return val > target;
        },
        .le => {
            return val <= target;
        },
        .ge => {
            return val >= target;
        },
    }
}

pub inline fn range(T: type, q: []u8, v: []u8, i: usize, c: *t.FilterCondition) bool {
    const size = utils.sizeOf(T);
    if (T == f64) {
        // Floats do not support ignore overflow
        return (utils.readPtr(T, v, c.start).* - utils.readPtr(T, q, i + size - c.offset).*) <=
            utils.readPtr(T, q, i + (size * 2) - c.offset).*;
    }
    // x >= 3 && x <= 11
    // (x -% 3) <= (11 - 3)
    // 3,8
    return (utils.readPtr(T, v, c.start).* -% utils.readPtr(T, q, i + size - c.offset).*) <=
        utils.readPtr(T, q, i + (size * 2) - c.offset).*;
}
