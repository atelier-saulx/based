const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const Prop = @import("../../types.zig").Prop;
const fillReferenceFilter = @import("./reference.zig").fillReferenceFilter;

inline fn defaultVar(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const op: Op = @enumFromInt(q[i + 5]);
    const query = q[i + 7 .. i + valueSize + 7];
    var pass = true;
    if (op == Op.equal) {
        // ADD NESTED OR
        if (v.len != valueSize) {
            pass = false;
        } else {
            var j: u32 = 0;
            while (j < query.len) : (j += 1) {
                if (v[j] != query[j]) {
                    pass = false;
                    break;
                }
            }
        }
    }
    // add HAS
    return .{ i + 7 + valueSize, pass };
}

inline fn reference(ctx: *db.DbCtx, q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const repeat = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 5]);
    const next = 10 + valueSize;
    if (op == Op.equal) {
        const refType = q[i + 7];
        if (refType == 2) {
            return .{ next, false };
        } else if (refType == 0) {
            if (!fillReferenceFilter(ctx, q[i + 7 .. i + 10 + repeat * 8])) {
                return .{ next, true };
            }
        }
        var j: u8 = 0;
        const query = q[i + 10 .. i + repeat * 8 + 10];
        if (repeat > 1) {
            if (!batch.equalsOr(8, v, query)) {
                return .{ next, false };
            }
        } else {
            while (j < query.len) : (j += 1) {
                if (v[j] != query[j]) {
                    return .{ next, false };
                }
            }
        }
    }
    return .{ next, true };
}

inline fn andFixed(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const op: Op = @enumFromInt(q[i + 5]);
    const repeat = readInt(u16, q, i + 7);
    const query = q[i + 9 .. i + valueSize * repeat + 9];
    const next = 9 + valueSize * repeat;
    // can potentialy vectorize this
    if (op == Op.equal) {
        if (v.len / valueSize != repeat) {
            return .{ next, false };
        }
        var j: u8 = 0;
        while (j < query.len) : (j += 1) {
            if (v[j] != query[j]) {
                return .{ next, false };
            }
        }
    }
    return .{ next, true };
}

inline fn default(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const start = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 5]);
    const prop: Prop = @enumFromInt(q[i + 6]);
    const query = q[i + 7 .. i + valueSize + 7];
    const next = 7 + valueSize;
    if (op == Op.equal) {
        const value = v[start .. start + valueSize];
        var j: u8 = 0;
        while (j < query.len) : (j += 1) {
            if (value[j] != query[j]) {
                return .{ next, false };
            }
        }
    } else if (op == Op.has) {
        if (start > 0) {
            std.log.err("Start (fixed len fields) + has not supported in filters", .{});
            return .{ next, false };
        }
        if (!batch.simdReferencesHasSingle(readInt(u32, query, 0), v)) {
            return .{ next, false };
        }
    } else if (Op.isNumerical(op)) {
        if (!num.compare(valueSize, start, op, query, v, prop)) {
            return .{ next, false };
        }
    }
    return .{ next, true };
}

inline fn orFixed(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const start = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 5]);
    const prop: Prop = @enumFromInt(q[i + 6]);
    const repeat = readInt(u16, q, i + 7);
    const query = q[i + 9 .. i + valueSize * repeat + 9];
    const next = 9 + valueSize * repeat;
    if (op == Op.equal) {
        const value = v[start .. start + valueSize];
        if (!batch.equalsOr(valueSize, value, query)) {
            return .{ next, false };
        }
    } else if (op == Op.has and prop == Prop.REFERENCES) {
        if (!batch.simdReferencesHas(query, v)) {
            return .{ next, false };
        }
    }
    return .{ next, true };
}

inline fn condition(
    mode: Mode,
    ctx: *db.DbCtx,
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    return switch (mode) {
        Mode.default => default(q, v, i),
        Mode.defaultVar => defaultVar(q, v, i),
        Mode.andFixed => andFixed(q, v, i),
        Mode.orFixed => orFixed(q, v, i),
        // Mode.orVar => ,
        Mode.reference => reference(ctx, q, v, i),
        else => .{ 0, false },
    };
}

pub fn runConditions(ctx: *db.DbCtx, q: []u8, v: []u8) bool {
    var i: usize = 0;
    // const topLevelType: Type = @enumFromInt(q[i]);
    // std.debug.print("T: {any} \n", .{topLevelType});

    while (i < q.len) {
        i += 1;
        const mode: Mode = @enumFromInt(q[i]);
        const r = condition(mode, ctx, q, v, i);
        if (r[1] == false) {
            return false;
        }
        i += r[0];
    }
    return true;
}
