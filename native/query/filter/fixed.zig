const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

pub inline fn equalOr(
    T: type,
    q: []u8,
    i: *usize,
    condition: *const t.FilterCondition,
    value: []u8,
) !bool {
    const vectorLen = std.simd.suggestVectorLength(T).?;
    const v = utils.readAligned(T, value, condition.start);
    const len = utils.readNext(u16, q, i);
    const values = utils.sliceNextAligned(T, len, q, i, condition.alignOffset);
    i.* += 16;
    var j: usize = 0;
    while (j <= (len)) : (j += vectorLen) {
        const vec2: @Vector(vectorLen, T) = values[j..][0..vectorLen].*;
        if (std.simd.countElementsWithValue(vec2, v) != 0) {
            return true;
        }
    }
    return false;
}

pub inline fn equal(
    T: type,
    q: []u8,
    i: *usize,
    condition: *const t.FilterCondition,
    value: []u8,
) !bool {
    // const val = utils.readAligned(T, value, condition.start);
    // const f = utils.readNextAligned(T, q, i, condition.alignOffset);
    // std.debug.print("EQ v: {any} f: {any} \n", .{ val, f });
    // return val == f;
    return utils.readNextAligned(T, q, i, condition.alignOffset) ==
        utils.readAligned(T, value, condition.start);
}
