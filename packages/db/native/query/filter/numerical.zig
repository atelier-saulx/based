const read = @import("../../utils.zig").read;
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
    const q = read(T, query, 0);
    const v = read(T, value, 0);
    const result = operateSwitch(T, op, q, v);
    return result;
}

inline fn operateSwitch(T: type, op: Op, q: T, v: T) bool {
    return switch (op) {
        Op.largerThen => v > q,
        Op.smallerThen => v < q,
        Op.largerThenInclusive => v >= q,
        Op.smallerThenInclusive => v <= q,
        else => false,
    };
}

pub inline fn compare(
    size: u16,
    start: u16,
    op: Op,
    query: []u8,
    v: []u8,
    prop: Prop,
) bool {
    // MODE all this is stored in microbuffers...
    // maybe op is better scince its only for these operations
    const isSigned = Prop.isSigned(prop);

    if (prop == Prop.REFERENCES) {
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
        if (prop == Prop.NUMBER) {
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
