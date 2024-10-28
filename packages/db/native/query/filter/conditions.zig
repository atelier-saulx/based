const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");
const t = @import("./types.zig");
const Mod = t.Mod;
const Op = t.Operator;

// -------------------------------------------
// operations shared
// 1 = equality
// 2 = has (simd)
// 3 = not equal
// 4 = ends with
// 5 = starts with
// -------------------------------------------
// operations numbers
// 6 = larger then
// 7 = smaller then
// 8 = larger then inclusive
// 9 = smaller then inclusive
// 10 = range
// 11 = exclude range
// -------------------------------------------
// operations strings
// 12 = equality to lower case
// 13 = has to lower case (simd)
// 14 = starts with to lower case
// 15 = ends with to lower case
// -------------------------------------------

pub fn runConditions(q: []u8, v: []u8) bool {
    var i: u16 = 0;
    while (i < q.len) {
        const mod: Mod = @enumFromInt(q[i]);
        const valueSize = readInt(u16, q, i + 1);
        const start = readInt(u16, q, i + 3);
        const op: Op = @enumFromInt(q[i + 5]);

        if (mod == Mod.orVar) {
            // OR Variable length
        } else if (mod == Mod.orFixed or mod == Mod.orReferences) {
            const repeat = readInt(u16, q, i + 6);
            const query = q[i + 8 .. i + valueSize * repeat + 8];
            if (op == Op.equal) {
                const value = v[start .. start + valueSize];
                if (!batch.equalsOr(valueSize, value, query)) {
                    return false;
                }
            } else if (op == Op.has and mod == Mod.orReferences) {
                if (!batch.simdReferencesHas(query, v)) {
                    return false;
                }
            }
            i += 8 + valueSize * repeat;
        } else if (mod == Mod.default) {
            const query = q[i + 6 .. i + valueSize + 6];
            // single
            if (op == Op.equal) {
                const value = v[start .. start + valueSize];
                // mostly fast for many non matching
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
                // enum
            } else if (Op.isNumerical(op)) {
                if (!num.compare(valueSize, op, query, v)) {
                    return false;
                }
            }
            i += 6 + valueSize;
        }
    }
    return true;
}
