const readInt = @import("../../utils.zig").readInt;
const t = @import("./types.zig");
const Op = t.Operator;
const std = @import("std");

inline fn operate(
    T: type,
    op: Op,
    query: []u8,
    value: []u8,
) bool {
    const q = readInt(T, query, 0);
    const v = readInt(T, value, 0);

    // std.debug.print("q: {d}, v: {d} op: {any} \n", .{ q, v, op });

    return switch (op) {
        Op.largerThen => v > q,
        Op.smallerThen => v < q,
        Op.largerThenInclusive => v >= q,
        Op.smallerThenInclusive => v <= q,
        // Op.range => v >= q and v <= q,
        // Op.rangeExclude => v <= q and v >= q,
        else => false,
    };
}

pub inline fn compare(
    size: u16,
    op: Op,
    query: []u8,
    value: []u8,
) bool {
    if (size == 4) {
        return operate(u32, op, query, value);
    } else if (size == 8) {
        return operate(u64, op, query, value);
    } else if (size == 1) {
        return operate(u8, op, query, value);
    }
    return false;
}
