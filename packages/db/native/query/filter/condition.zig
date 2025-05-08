const std = @import("std");
const read = @import("../../utils.zig").read;
const batch = @import("./batch.zig");
const has = @import("./has/has.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const Prop = @import("../../types.zig").Prop;
const selva = @import("../../selva.zig");
const crc32Equal = @import("./crc32Equal.zig").crc32Equal;

pub inline fn orVar(dbCtx: *db.DbCtx, q: []u8, v: []u8, i: usize) ConditionsResult {
    const prop: Prop = @enumFromInt(q[2]);
    const valueSize = read(u32, q, i + 6);
    const next = i + 11 + valueSize;
    const query = q[i + 11 .. next];
    const mainLen = read(u16, q, i + 4);
    const op: Op = @enumFromInt(q[i + 10]);
    const start = read(u16, q, i + 2);
    var value: []u8 = undefined;
    if (mainLen != 0) {
        value = v[start + 1 .. v[start] + start + 1];
    } else {
        value = v;
    }
    if (op == Op.equal) {
        var j: usize = 0;
        while (j < query.len) {
            const size = read(u16, query, j);
            const queryPartial = query[j + 2 .. j + 2 + size];
            if (value.len == queryPartial.len) {
                var p: usize = 0;
                while (p < queryPartial.len) : (p += 1) {
                    if (value[p] != queryPartial[p]) {
                        // pass = false;
                        break;
                    }
                }
                if (p == queryPartial.len) {
                    return .{ next, true };
                }
            }
            j += size + 2;
        }
        return .{ next, false };
    } else if (has.has(true, op, prop, value, query, mainLen, dbCtx)) {
        return .{ next, true };
    }
    return .{ next, false };
}

pub inline fn defaultVar(dbCtx: *db.DbCtx, q: []u8, v: []u8, i: usize) ConditionsResult {
    const prop: Prop = @enumFromInt(q[2]);
    const start = read(u16, q, i + 2);
    const mainLen = read(u16, q, i + 4);
    var valueSize = read(u32, q, i + 6);
    const op: Op = @enumFromInt(q[i + 10]);
    const next = i + 11 + valueSize;
    const query = q[i + 11 .. next];
    var value: []u8 = undefined;
    var pass = true;
    if (mainLen != 0) {
        value = v[start + 1 .. v[start] + start + 1];
    } else {
        value = v;
    }

    if (op == Op.equal) {
        if (prop == Prop.TEXT) {
            // this is here and not in fixed check because it has the lang code at then end
            valueSize = read(u32, query, 4);
            if (value.len - 6 != valueSize) {
                pass = false;
            }
            var j: u32 = 0;
            while (j < 4) : (j += 1) {
                if (value[value.len - 4 + j] != query[j]) {
                    pass = false;
                    break;
                }
            }
        } else {
            if (value.len != valueSize) {
                pass = false;
            } else {
                var j: u32 = 0;
                while (j < query.len) : (j += 1) {
                    if (value[j] != query[j]) {
                        pass = false;
                        break;
                    }
                }
            }
        }
    } else if (!has.has(
        false,
        op,
        prop,
        value,
        query,
        mainLen,
        dbCtx,
    )) {
        pass = false;
    }
    return .{ next, pass };
}

pub inline fn reference(q: []u8, v: []u8, i: usize) ConditionsResult {
    const repeat = read(u16, q, i + 4);
    const op: Op = @enumFromInt(q[i + 6]);
    const offset: usize = if (repeat > 1) 18 else 10;
    const next = offset + 4 * repeat;
    if (op == Op.equal) {
        const query = q[i + 10 .. i + repeat * 4 + offset];
        var j: u8 = 0;
        if (repeat > 1) {
            if (!batch.equalsOr(4, v, query)) {
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

pub inline fn default(
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    const prop: Prop = @enumFromInt(q[i + 1]);
    const valueSize = read(u16, q, i + 2);
    const start = read(u16, q, i + 4);
    const op: Op = @enumFromInt(q[i + 6]);
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
            // std.log.err("Start (fixed len fields) + has not supported in filters", .{});
            return .{ next, false };
        }
        if (!batch.simdReferencesHasSingle(read(u32, query, 0), v)) {
            return .{ next, false };
        }
    } else if (Op.isNumerical(op)) {
        if (!num.compare(valueSize, start, op, query, v, prop)) {
            return .{ next, false };
        }
    } else if (op == Op.equalCrc32) {
        return .{ next, crc32Equal(prop, query, v) };
    }
    return .{ next, true };
}

pub inline fn andFixed(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = read(u16, q, i + 2);
    const op: Op = @enumFromInt(q[i + 6]);
    const repeat = read(u16, q, i + 7);
    const query = q[i + 9 + 8 .. i + valueSize * repeat + 17];
    const next = 17 + valueSize * repeat;
    // Can potentialy vectorize this
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

pub inline fn orFixed(
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    const prop: Prop = @enumFromInt(q[i + 1]);
    const valueSize = read(u16, q, i + 2);
    const start = read(u16, q, i + 4);
    const op: Op = @enumFromInt(q[i + 6]);
    const repeat = read(u16, q, i + 7);
    const query = q[i + 9 .. i + valueSize * repeat + 17];
    const next = 17 + valueSize * repeat;
    if (op == Op.equalCrc32) {
        const amountOfConditions = @divTrunc(query.len, 8) + 1;
        var j: usize = 0;
        while (j < amountOfConditions) {
            const qI = j * 8;
            if (crc32Equal(prop, query[qI .. qI + 8], v)) {
                return .{ next, true };
            }
            j += 1;
        }
        return .{ next, false };
        // ---------
    } else if (op == Op.equal) {
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
