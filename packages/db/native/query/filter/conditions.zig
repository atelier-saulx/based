const std = @import("std");
const readInt = @import("../../utils.zig").readInt;
const batch = @import("./batch.zig");
const db = @import("../../db//db.zig");

pub fn runConditions(q: []u8, v: []u8) bool {
    var i: u16 = 0;
    while (i < q.len) {
        const mod = q[i];
        const valueSize = readInt(u16, q, i + 1);
        const start = readInt(u16, q, i + 3);
        const op = q[i + 5];

        if (mod == 2) {
            // AND SIMD
        } else if (mod == 1 or mod == 3) {
            // OR Fixed length
            const repeat = readInt(u16, q, i + 6);
            if (op == 1) {
                const value = v[start .. start + valueSize];
                const query = q[i + 8 .. i + valueSize * repeat + 8];
                if (!batch.equalsOr(valueSize, value, query)) {
                    return false;
                }
            } else if (op == 2) {
                // ref has
                const query = q[i + 8 .. i + valueSize * repeat + 8];
                const value = v;
                // check size again..
                // if it bigger can use comparison fn to find needle
                if (!batch.simdReferencesHas(query, value)) {
                    return false;
                }
            }
            i += 8 + valueSize * repeat;
        } else {
            // single
            if (op == 1) {
                const query = q[i + 6 .. i + valueSize + 6];
                const value = v[start .. start + valueSize];
                // mostly fast for many non matching
                var j: u8 = 0;
                while (j < query.len) : (j += 1) {
                    if (value[j] != query[j]) {
                        return false;
                    }
                }
            } else if (op == 2) {
                const query = q[i + 6 .. i + valueSize + 6];
                const value = v;
                if (start > 0) {
                    std.log.err("Start + has not supported in filters", .{});
                    return false;
                }

                std.debug.print("scan {any} amount of items \n", .{value.len});
                // if start do different
                if (!batch.equalsOr(valueSize, query, value)) {
                    return false;
                }
            }
            i += 6 + valueSize;
        }
    }
    return true;
}
