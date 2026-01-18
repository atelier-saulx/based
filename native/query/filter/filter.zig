const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

fn alignSingle(T: type, q: []u8, i: *usize) void {
    const size = utils.sizeOf(T) + @alignOf(T);
    const condition = utils.readNext(t.FilterCondition, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + size]);
    }
    i.* += size;
}

fn alignBatch(T: type, q: []u8, i: *usize) void {
    const condition = utils.readNext(t.FilterCondition, q, i);
    const len = utils.readNext(u16, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 5] = utils.alignLeft(u32, q[i.* .. i.* + len * utils.sizeOf(T) + @alignOf(T)]);
    }
    i.* += len * utils.sizeOf(T) + @alignOf(T);
}

// prepare will return the next NOW
// it will also just fill in the current now
pub inline fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .nextOrIndex => alignSingle(usize, q, &i),
            .equalsU32, .notEqualsU32 => alignSingle(u32, q, &i),
            .equalsU32Or, .notEqualsU32Or => alignBatch(u32, q, &i),
            else => {},
        }
    }
}

pub inline fn equalFixedOr(
    T: type,
    q: []u8,
    i: *usize,
    condition: *const t.FilterCondition,
    value: []u8,
) !bool {
    const vectorLen = std.simd.suggestVectorLength(T).?;
    const v = utils.readAligned(T, value, condition.start);

    // make fn
    const len = utils.readNext(u16, q, i);
    const values = utils.sliceNextAligned(T, len, q, i, condition.alignOffset);

    // const tmp: [*]T = @ptrCast(@alignCast(values[8 - offset .. values.len - offset].ptr));
    // const ints: []T = tmp[0..l];

    var j: usize = 0;
    if (vectorLen <= len) {
        while (j <= (len - vectorLen)) : (j += vectorLen) {
            const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
            if (std.simd.countElementsWithValue(vec2, v) != 0) {
                return true;
            }
        }
    }

    while (j < len) : (j += 1) {
        if (values[j] == v) {
            return true;
        }
    }

    return false;
}

pub inline fn equalFixed(
    T: type,
    q: []u8,
    i: *usize,
    condition: *const t.FilterCondition,
    value: []u8,
) !bool {
    return utils.readNextAligned(T, q, i, condition.alignOffset) ==
        utils.readAligned(T, value, condition.start);
}

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var value: []u8 = undefined;
    var prop: u8 = 255; // tmp default
    var nextOrIndex: usize = q.len;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);

        const condition = utils.readNext(t.FilterCondition, q, &i);
        if (prop != condition.prop) {
            prop = condition.prop;
            value = Fields.get(
                typeEntry,
                node,
                try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readNextAligned(usize, q, &i, condition.alignOffset);
                break :blk true;
            },
            .equalsU32 => try equalFixed(u32, q, &i, &condition, value),
            .notEqualsU32 => !try equalFixed(u32, q, &i, &condition, value),
            .equalsU32Or => try equalFixedOr(u32, q, &i, &condition, value),
            .notEqualsU32Or => !try equalFixedOr(u32, q, &i, &condition, value),
            else => false,
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        }
    }
    return pass;
}

// baseline
// pub inline fn filter(
//     _: Node.Node,
//     _: *Query.QueryCtx,
//     _: []u8,
//     _: Node.Type,
// ) !bool {
//     return false;
// }
