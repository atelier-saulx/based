const std = @import("std");
const read = @import("../../utils.zig").read;
const db = @import("../../db/db.zig");
const t = @import("../../types.zig");

inline fn operate(
    T: type,
    op: t.FilterOp,
    query: []u8,
    value: []u8,
) bool {
    const q = read(T, query, 0);
    const v = read(T, value, 0);
    const result = operateSwitch(T, op, q, v);
    return result;
}

inline fn operateSwitch(T: type, op: t.FilterOp, q: T, v: T) bool {
    return switch (op) {
        t.FilterOp.largerThen => v > q,
        t.FilterOp.smallerThen => v < q,
        t.FilterOp.largerThenInclusive => v >= q,
        t.FilterOp.smallerThenInclusive => v <= q,
        else => false,
    };
}

pub inline fn compare(
    size: u16,
    start: u16,
    op: t.FilterOp,
    query: []u8,
    v: []u8,
    prop: t.PropType,
) bool {
    // MODE all this is stored in microbuffers...
    // maybe op is better scince its only for these operations
    const isSigned = t.PropType.isSigned(prop);

    if (prop == t.PropType.references) {
        return operateSwitch(u32, op, read(u32, query, 0), @truncate(v.len / 4));
    }

    const value = v[start .. start + size];
    if (size == 4) {
        if (isSigned) {
            return operate(i32, op, query, value);
        } else {
            return operate(u32, op, query, value);
        }
    } else if (size == 8) {
        // todo update if changing how its written
        if (prop == t.PropType.number) {
            return operate(f64, op, query, value);
        } else if (isSigned) {
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
