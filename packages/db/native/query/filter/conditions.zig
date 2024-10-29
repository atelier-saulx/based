const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Prop = @import("../../types.zig").Prop;

pub fn runConditions(ctx: *db.DbCtx, q: []u8, v: []u8) bool {
    var i: u16 = 0;
    while (i < q.len) {
        const mode: Mode = @enumFromInt(q[i]);
        const valueSize = readInt(u16, q, i + 1);
        const start = readInt(u16, q, i + 3);
        const op: Op = @enumFromInt(q[i + 5]);
        const prop: Prop = @enumFromInt(q[i + 6]);

        // References does not need to be passed anymore
        // Pass fieldType in the filter

        if (mode == Mode.orFixed) {
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
        } else if (mode == Mode.default and prop == Prop.REFERENCE) {
            const query = q[i + 7 .. i + valueSize + 7];
            const refType = query[0];
            if (refType == 2) {
                return false;
            } else if (refType == 0) {
                const id = readInt(u32, query, query.len - 4);
                // ctx
                const schemaType = readInt(u16, query, query.len - 6);
                std.debug.print("INIT GET REF FILTER id: {d} type: {any}  \n", .{
                    id,
                    schemaType,
                });
                const typeEntry = db.getType(ctx, schemaType) catch {
                    return false;
                };
                const ref = db.getNode(id, typeEntry);
                if (ref) |r| {
                    query[0] = 1;
                    const arr: [*]u8 = @ptrCast(@alignCast(r));
                    @memcpy(query[1..query.len], arr);
                } else {
                    query[0] = 2;
                    return false;
                }
            }
            var j: u8 = 0;
            while (j < 8) : (j += 1) {
                if (v[j] != query[j + 1]) {
                    return false;
                }
            }
            i += 7 + valueSize;
        } else if (mode == Mode.default) {
            const query = q[i + 7 .. i + valueSize + 7];
            if (op == Op.equal) {
                const value = v[start .. start + valueSize];
                // Fast for non matching cases
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
                const value = v[start .. start + valueSize];
                if (!num.compare(valueSize, op, query, value, prop)) {
                    return false;
                }
            }
            i += 7 + valueSize;
        }
    }
    return true;
}
