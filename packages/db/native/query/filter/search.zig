const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");
const types = @import("../include//types.zig");
const like = @import("./like.zig").default;
const compressed = @import("./compressed.zig");
const decompress = compressed.decompress;

inline fn blockCompare(value: []const u8, query: []const u8) bool {
    const d = selva.strsearch_has_u8(
        @ptrCast(value.ptr),
        value.len,
        @ptrCast(query.ptr),
        query.len,
        2,
        true,
    );

    if (d < 2) {
        return true;
    }
    return false;
}

pub fn search(
    dbCtx: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    searchBuf: []u8,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    const qSize = readInt(u16, searchBuf, 0);
    const offset = qSize + 2;
    const query = searchBuf[2..offset];
    const sl = searchBuf.len;
    var j: usize = offset;

    while (j < sl) {
        const field = searchBuf[j];

        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            return 0;
        };

        const value = db.getField(typeEntry, 0, node, fieldSchema);

        if (value.len == 0) {
            continue;
        }

        // * weight ?

        const isCompressed = value[0] == 1;

        var d: c_int = undefined;
        if (isCompressed) {
            if (decompress(blockCompare, query, value, dbCtx)) {
                return 10;
            }
        } else {
            d = selva.strsearch_has_u8(
                @ptrCast(value.ptr),
                value.len,
                @ptrCast(query.ptr),
                query.len,
                2,
                true,
            );
        }

        // std.debug.print("FOUND {d}  {any} \n", .{ d, query });

        // minimum d
        if (d < 1) {
            // std.debug.print("FOUND {d}  \n", .{d});
            return 10;
        }

        j += 2;
    }

    return 1;
}
