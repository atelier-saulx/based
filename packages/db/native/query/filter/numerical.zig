const readInt = @import("../../utils.zig").readInt;
const t = @import("./types.zig");
const Op = t.Operator;
const Mode = t.Mode;
const std = @import("std");
const db = @import("../../db/db.zig");
const Prop = @import("../../types.zig").Prop;

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
    fieldSchema: db.FieldSchema,
) bool {
    // MOD for negative check info OR OP
    // maybe op is better scince its only for these operations
    const isSigned = Prop.isSigned(@enumFromInt(fieldSchema.type));
    if (size == 4) {
        if (isSigned) {
            return operate(i32, op, query, value);
        } else {
            return operate(u32, op, query, value);
        }
    } else if (size == 8) {
        if (isSigned) {
            // maybe f?
            return operate(i64, op, query, value);
        } else {
            return operate(u64, op, query, value);
        }
    } else if (size == 1) {
        if (isSigned) {
            return operate(i8, op, query, value);
        } else {
            return operate(u8, op, query, value);
        }
    } else if (size == 2) {
        if (isSigned) {
            return operate(i16, op, query, value);
        } else {
            return operate(u16, op, query, value);
        }
    }
    return false;
}
