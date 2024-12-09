const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");
const types = @import("../include//types.zig");
const like = @import("./like.zig").default;
const compressed = @import("./compressed.zig");
const decompress = compressed.decompress;

inline fn blockCompare(_: []const u8, _: []const u8) bool {
    // const d = selva.strsearch_has_u8(
    //     @ptrCast(value.ptr),
    //     value.len,
    //     @ptrCast(query.ptr),
    //     query.len,
    //     2,
    //     true,
    // );

    // if (d < 2) {
    //     return true;
    // }
    return false;
}

pub fn search(
    _: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    searchBuf: []u8,
    searchCtx: *selva.strsearch_needle,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    const sl = searchBuf.len;
    var j: usize = searchCtx.len + 2;

    // std.debug.print("----------S: {d} {d} \n", .{ j, sl });

    while (j < sl) {
        const field = searchBuf[j];

        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            return 0;
        };

        const value = db.getField(typeEntry, 0, node, fieldSchema);

        if (value.len == 0) {
            j += 2;

            continue;
        }

        const isCompressed = value[0] == 1;

        var d: c_int = undefined;
        if (isCompressed) {
            // std.debug.print("D: {any} \n", .{d});

            // if (decompress(blockCompare, query, value, dbCtx)) {
            //     return 1;
            // }
        } else {
            d = selva.strsearch_has_u8(
                @ptrCast(value.ptr),
                value.len,
                searchCtx,
            );

            // std.debug.print("????????D: {any} \n", .{d});
        }

        if (d < 3) {
            // std.debug.print("D: {any} \n", .{d});

            const x: u32 = @bitCast(d);
            return x;
        }

        j += 2;
    }

    return 10;
}
