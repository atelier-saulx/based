const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");

const empty: [8]u8 = .{ 0, 0, 0, 0, 0, 0, 0, 0 };

pub fn fillReferenceFilter(
    ctx: *db.DbCtx,
    query: []u8,
) bool {
    const schemaType = readInt(u16, query, 1);
    const typeEntry = db.getType(ctx, schemaType) catch {
        query[0] = 2;
        return false;
    };
    var i: usize = 3;
    var found: bool = false;
    while (i < query.len) : (i += 8) {
        const id = readInt(u32, query, i);
        const ref = db.getNode(id, typeEntry);
        if (ref) |r| {
            const arr: [*]u8 = @ptrCast(@alignCast(r));
            @memcpy(query[i .. i + 8], arr[0..8]);
            found = true;
        } else {
            @memcpy(query[i .. i + 8], &empty);
        }
    }
    if (found) {
        query[0] = 1;
    } else {
        query[0] = 2;
    }
    return true;
}
