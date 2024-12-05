const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const has = @import("./has.zig");
const search = @import("./search.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const Prop = @import("../../types.zig").Prop;
const fillReferenceFilter = @import("./reference.zig").fillReferenceFilter;
const selva = @import("../../selva.zig");

pub inline fn orVar(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u32, q, i + 5);
    const next = i + 11 + valueSize;
    const query = q[i + 11 .. next];
    const prop: Prop = @enumFromInt(q[11]);
    const mainLen = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 9]);
    const start = readInt(u16, q, i + 1);
    var value: []u8 = undefined;
    if (mainLen != 0) {
        value = v[start + 1 .. v[start] + start + 1];
    } else {
        value = v;
    }

    if (op == Op.has) {
        if (prop == Prop.STRING and mainLen == 0) {
            if (value[0] == 1) {
                var j: usize = 0;
                while (j < query.len) {
                    const size = readInt(u16, query, j);
                    if (has.compressed(value, query[j + 2 .. j + 2 + size])) {
                        return .{ next, true };
                    }
                    j += size + 2;
                }
            } else {
                var j: usize = 0;
                while (j < query.len) {
                    const size = readInt(u16, query, j);
                    if (has.default(value[1..value.len], query[j + 2 .. j + 2 + size])) {
                        return .{ next, true };
                    }
                    j += size + 2;
                }
                return .{ next, false };
            }
        } else {
            var j: usize = 0;
            while (j < query.len) {
                const size = readInt(u16, query, j);
                if (has.default(value, query[j + 2 .. j + 2 + size])) {
                    return .{ next, true };
                }
                j += size + 2;
            }
            return .{ next, false };
        }
    }

    return .{ next, false };
}

pub inline fn defaultVar(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u32, q, i + 5);
    const start = readInt(u16, q, i + 1);
    const mainLen = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 9]);
    const next = i + 11 + valueSize;
    const prop: Prop = @enumFromInt(q[11]);
    const query = q[i + 11 .. next];
    var value: []u8 = undefined;
    var pass = true;
    if (mainLen != 0) {
        value = v[start + 1 .. v[start] + start + 1];
    } else {
        value = v;
    }

    // extract this and use in OR
    if (op == Op.search) {
        if (value[0] == 1) {
            return .{ next, false };
        } else if (!search.default(value[1..value.len], query)) {
            return .{ next, false };
        }
        // -------------------
    } else if (op == Op.equal) {
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
    } else if (op == Op.has) {
        if (prop == Prop.STRING and mainLen == 0) {
            if (value[0] == 1) {
                if (!has.compressed(value, query)) {
                    return .{ next, false };
                }
            } else if (!has.default(value[1..value.len], query)) {
                return .{ next, false };
            }
        } else if (!has.default(value, query)) {
            return .{ next, false };
        }
    } else if (op == Op.hasLoose) {
        if (prop == Prop.STRING and mainLen == 0) {
            if (value[0] == 1) {
                if (!has.looseCompressed(value, query)) {
                    return .{ next, false };
                }
            } else if (!has.loose(value[1..value.len], query)) {
                return .{ next, false };
            }
        } else if (!has.loose(value, query)) {
            return .{ next, false };
        }
    }
    return .{ next, pass };
}

pub inline fn reference(ctx: *db.DbCtx, q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const repeat = readInt(u16, q, i + 3);
    const op: Op = @enumFromInt(q[i + 5]);
    const next = 10 + valueSize * repeat;
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

pub inline fn andFixed(q: []u8, v: []u8, i: usize) ConditionsResult {
    const valueSize = readInt(u16, q, i + 1);
    const op: Op = @enumFromInt(q[i + 5]);
    const repeat = readInt(u16, q, i + 7);
    const query = q[i + 9 .. i + valueSize * repeat + 9];
    const next = 9 + valueSize * repeat;
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

pub inline fn default(
    q: []u8,
    v: []u8,
    i: usize,
    comptime isEdge: bool,
    node: if (isEdge) *selva.SelvaNodeReference else *selva.SelvaNode,
    fieldSchema: ?db.FieldSchema,
) ConditionsResult {
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
    } else if (op == Op.equalCrc32) {
        const origLen = readInt(u32, query, 4);
        var valueLen: usize = undefined;
        if (prop == Prop.STRING and v[1] == 1) {
            valueLen = readInt(u32, v, 1);
        } else {
            valueLen = v.len;
        }
        if (origLen != valueLen) {
            return .{ next, false };
        }
        var crc32: u32 = undefined;
        // if isEdge
        if (fieldSchema == null) {
            crc32 = selva.crc32c(0, v.ptr, v.len);
        } else {
            if (isEdge) {
                _ = selva.selva_fields_get_string_crc2(node.meta, fieldSchema, &crc32);
            } else {
                _ = selva.selva_fields_get_string_crc(node, fieldSchema, &crc32);
            }
        }
        const qCrc32 = readInt(u32, query, 0);
        if (crc32 != qCrc32) {
            return .{ next, false };
        }
    }
    return .{ next, true };
}

pub inline fn orFixed(q: []u8, v: []u8, i: usize) ConditionsResult {
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
