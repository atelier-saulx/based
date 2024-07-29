const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const std = @import("std");
const db = @import("../../db.zig");
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./includeSingleRef.zig").getSingleRefFields;

pub fn getFields(
    ctx: QueryCtx,
    id: u32,
    type_prefix: [2]u8,
    start: ?u16,
    include: []u8,
    currentShard: u16,
) !usize {
    std.debug.print("{any} {any} {any} {any} {any}", .{ ctx, id, type_prefix, start, currentShard });

    std.debug.print("\n\nINCLUDE: {any} \n\n", .{include});

    var includeMain: []u8 = &.{};

    var size: usize = 0;
    var includeIterator: u16 = 0;

    // should only be at the start bit strange like this maybe...
    // scince we also want to make it for empty stuff
    var idIsSet: bool = false;

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];

        if (field == 0) {
            std.debug.print("\n IS MAIN \n", .{});

            const mainSize = std.mem.readInt(u16, include[includeIterator + 1 ..][0..2], .little);

            std.debug.print(" size: {d} \n", .{mainSize});

            if (mainSize != 0) {
                includeMain = include[includeIterator + 3 .. includeIterator + 3 + mainSize];

                std.debug.print(" includeMain: {any} \n", .{includeMain});
            }

            includeIterator += 2 + mainSize;
        }
        includeIterator += 1;

        const dbiName = db.createDbiName(type_prefix, field, @bitCast(currentShard));
        var shard = ctx.shards.get(dbiName);

        if (shard == null) {
            shard = db.openShard(true, dbiName, ctx.txn) catch null;
            if (shard != null) {
                try ctx.shards.put(dbiName, shard.?);
            }
        }

        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
            continue :includeField;
        };

        if (!idIsSet and start == null) {
            idIsSet = true;
            size += 1 + 4;
            const s: results.Result = .{ .id = id, .field = field, .val = v, .start = null, .includeMain = includeMain };
            try ctx.results.append(s);
        } else {
            const s: results.Result = .{ .id = null, .field = field, .val = v, .start = start, .includeMain = includeMain };
            try ctx.results.append(s);
        }

        if (field != 0) {
            size += (v.mv_size + 1 + 2);
        } else {
            // if (v.mv_size > 0 and includeSingleRefs.len != 0) {
            //     size += getSingleRefFields(ctx, includeSingleRefs, v);
            // }
            // if (includeMain.len != 0) {
            //     // std.debug.print("zig: MAIN LEN {any} \n", .{std.mem.readInt(u32, includeMain[0..4], .little) + 1});
            //     size += std.mem.readInt(u32, includeMain[0..4], .little) + 1;
            // } else {
            size += (v.mv_size + 1);
            // }
        }
    }

    return size;
}
