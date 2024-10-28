const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");
const num = @import("./numerical.zig");

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
        const mod = q[i];
        const valueSize = readInt(u16, q, i + 1);
        const start = readInt(u16, q, i + 3);
        const op = q[i + 5];

        if (mod == 2) {
            // OR Variable length
        } else if (mod == 1 or mod == 3) {
            // OR Fixed length
            const repeat = readInt(u16, q, i + 6);
            const query = q[i + 8 .. i + valueSize * repeat + 8];
            if (op == 1) {
                const value = v[start .. start + valueSize];
                if (!batch.equalsOr(valueSize, value, query)) {
                    return false;
                }
            } else if (op == 2 and mod == 3) {
                if (!batch.simdReferencesHas(query, v)) {
                    return false;
                }
            }
            // handle has for string
            i += 8 + valueSize * repeat;
        } else {
            const query = q[i + 6 .. i + valueSize + 6];
            // single
            if (op == 1) {
                const value = v[start .. start + valueSize];
                // mostly fast for many non matching
                var j: u8 = 0;
                while (j < query.len) : (j += 1) {
                    if (value[j] != query[j]) {
                        return false;
                    }
                }
            } else if (op == 2) {
                if (start > 0) {
                    std.log.err("Start + has not supported in filters", .{});
                    return false;
                }
                if (!batch.simdReferencesHasSingle(readInt(u32, query, 0), v)) {
                    return false;
                }
            } else if (op == 6 or op == 7 or op == 8 or op == 9 or op == 10 or op == 11) {
                if (!num.compare(valueSize, op, query, v)) {
                    return false;
                }
            } else if (op == 7) {}
            i += 6 + valueSize;
        }
    }
    return true;
}
