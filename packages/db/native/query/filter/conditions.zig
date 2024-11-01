const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;

const Prop = @import("../../types.zig").Prop;
const fillReferenceFilter = @import("./reference.zig").fillReferenceFilter;

pub fn runConditions(ctx: *db.DbCtx, q: []u8, v: []u8) bool {
    var i: usize = 0;
    // const topLevelType: Type = @enumFromInt(q[i]);
    // std.debug.print("T: {any} \n", .{topLevelType});

    while (i < q.len) {
        i += 1;

        const mode: Mode = @enumFromInt(q[i]);

        if (mode == Mode.defaultVar) {
            const valueSize = readInt(u16, q, i + 1);
            const op: Op = @enumFromInt(q[i + 5]);
            const query = q[i + 7 .. i + valueSize + 7];

            if (op == Op.equal) {
                // ADD NESTED OR
                if (v.len != valueSize) {
                    return false;
                }
                var j: u32 = 0;
                while (j < query.len) : (j += 1) {
                    if (v[j] != query[j]) {
                        return false;
                    }
                }
            }
            // add HAS
            i += 7 + valueSize;
        } else {
            const valueSize = readInt(u16, q, i + 1);
            const start = readInt(u16, q, i + 3);
            const op: Op = @enumFromInt(q[i + 5]);
            const prop: Prop = @enumFromInt(q[i + 6]);
            if (prop == Prop.REFERENCE) {
                // [or = 1]  [repeat 2] [op] [ti] [parsed] [typeId 2]
                const repeat = start;
                // or op == Op.notEqual
                if (op == Op.equal) {
                    const refType = q[i + 7];
                    if (refType == 2) {
                        return false;
                    } else if (refType == 0) {
                        if (!fillReferenceFilter(ctx, q[i + 7 .. i + 10 + repeat * 8])) {
                            return false;
                        }
                    }
                    var j: u8 = 0;
                    const query = q[i + 10 .. i + repeat * 8 + 10];
                    if (repeat > 1) {
                        if (!batch.equalsOr(8, v, query)) {
                            return false;
                        }
                    } else {
                        while (j < query.len) : (j += 1) {
                            if (v[j] != query[j]) {
                                return false;
                            }
                        }
                    }
                }
                i += 10 + valueSize;
            } else if (mode == Mode.orFixed) {
                const repeat = readInt(u16, q, i + 7);
                const query = q[i + 9 .. i + valueSize * repeat + 9];
                if (op == Op.equal) {
                    const value = v[start .. start + valueSize];
                    if (!batch.equalsOr(valueSize, value, query)) {
                        return false;
                    }
                } else if (op == Op.has and prop == Prop.REFERENCES) {
                    if (!batch.simdReferencesHas(query, v)) {
                        return false;
                    }
                }
                i += 9 + valueSize * repeat;
            } else if (mode == Mode.andFixed) {
                const repeat = readInt(u16, q, i + 7);
                const query = q[i + 9 .. i + valueSize * repeat + 9];
                if (op == Op.equal) {
                    if (v.len / valueSize != repeat) {
                        return false;
                    }
                    var j: u8 = 0;
                    while (j < query.len) : (j += 1) {
                        if (v[j] != query[j]) {
                            return false;
                        }
                    }
                }
                i += 9 + valueSize * repeat;
            } else if (mode == Mode.default) {
                const query = q[i + 7 .. i + valueSize + 7];
                if (op == Op.equal) {
                    const value = v[start .. start + valueSize];
                    var j: u8 = 0;
                    while (j < query.len) : (j += 1) {
                        if (value[j] != query[j]) {
                            return false;
                        }
                    }
                } else if (op == Op.has) {
                    if (start > 0) {
                        std.log.err("Start + has not supported in filters", .{});
                        return false;
                    }
                    if (!batch.simdReferencesHasSingle(readInt(u32, query, 0), v)) {
                        return false;
                    }
                } else if (Op.isNumerical(op)) {
                    if (!num.compare(valueSize, start, op, query, v, prop)) {
                        return false;
                    }
                }
                i += 7 + valueSize;
            }
        }
    }
    return true;
}
