const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");
const types = @import("../include//types.zig");
// const loose = @import("./has/loose.zig");
const like = @import("./like.zig").default;

pub fn search(
    _: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    searchBuf: []u8,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    const qSize = readInt(u16, searchBuf, 0);
    const offset = qSize + 2;
    // const query = searchBuf[2..offset];
    const sl = searchBuf.len;
    var j: usize = offset;

    while (j < sl) {
        const field = searchBuf[j];
        // const weight = searchBuf[j + 1];

        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            return 0;
        };

        const value = db.getField(typeEntry, 0, node, fieldSchema);

        if (value.len == 0) {
            continue;
        }

        // const d = selva.strsearch_has_u8(
        //     @ptrCast(value.ptr),
        //     value.len,
        //     @ptrCast(query.ptr),
        //     query.len,
        //     0,
        // );

        // minimum d
        // if (d < 2) {
        //     // std.debug.print("FOUND {d}  \n", .{d});
        //     return 10;
        // }

        j += 2;
    }

    return 1;
}
