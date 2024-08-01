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
    refLvl: u8,
) !usize {
    var includeMain: []u8 = &.{};
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var idIsSet: bool = false;
    var mainValue: ?c.MDB_val = null;

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];

        if (field == 255) {
            const hasFields: bool = include[includeIterator + 1] == 1;
            const refSize = std.mem.readInt(u16, include[includeIterator + 2 ..][0..2], .little);
            const singleRef = include[includeIterator + 4 .. includeIterator + 4 + refSize];
            includeIterator += refSize + 4;

            if (mainValue == null) {
                const dbiName = db.createDbiName(type_prefix, 0, @bitCast(currentShard));
                var shard = ctx.shards.get(dbiName);
                if (shard == null) {
                    shard = db.openShard(true, dbiName, ctx.txn) catch null;
                    if (shard != null) {
                        try ctx.shards.put(dbiName, shard.?);
                    }
                }
                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

                try errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET));
                mainValue = v;

                // case that you only include
                if (!idIsSet and start == null) {
                    idIsSet = true;
                    size += 5;
                    try ctx.results.append(.{
                        .id = id,
                        .field = 255,
                        .val = v,
                        .start = null,
                        .includeMain = includeMain,
                        .refLvl = refLvl,
                    });
                }
            }

            if (mainValue.?.mv_data == null) {
                continue :includeField;
            }

            size += getSingleRefFields(ctx, singleRef, mainValue.?, refLvl, hasFields);
            continue :includeField;
        }

        if (field == 0) {
            const mainSize = std.mem.readInt(u16, include[includeIterator + 1 ..][0..2], .little);
            if (mainSize != 0) {
                includeMain = include[includeIterator + 3 .. includeIterator + 3 + mainSize];
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
            mainValue = .{ .mv_size = 0, .mv_data = null };
            continue :includeField;
        };

        if (field == 0) {
            mainValue = v;
            if (includeMain.len != 0) {
                size += std.mem.readInt(u16, includeMain[0..2], .little) + 1;
            } else {
                size += (v.mv_size + 1);
            }
        } else {
            size += (v.mv_size + 1 + 2);
        }

        var result: results.Result = .{
            .id = id,
            .field = field,
            .val = v,
            .start = start,
            .includeMain = includeMain,
            .refLvl = refLvl,
        };

        if (start == null) {
            if (!idIsSet) {
                idIsSet = true;
                size += 1 + 4;
            } else {
                result.id = null;
            }
        }

        try ctx.results.append(result);
    }

    return size;
}
