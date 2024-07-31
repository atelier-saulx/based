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
    // std.debug.print("\n\nINCLUDE: {any} \n\n", .{include});

    var includeMain: []u8 = &.{};
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var idIsSet: bool = false;

    var mainValue: ?c.MDB_val = null; // for single refs

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];

        if (field == 255) {

            // add 1 more byte INCLUDE: { 255, 12, 0, 49, 48, 11, 0, 255, 5, 0, 50, 48, 0, 0, 1 }
            // include 0 - 1 1 means add result
            // need 1 extra LEN

            // clean this a bit

            const hasFields: bool = include[includeIterator + 1] == 1;

            const refSize = std.mem.readInt(u16, include[includeIterator + 2 ..][0..2], .little);
            const singleRef = include[includeIterator + 4 .. includeIterator + 4 + refSize];

            includeIterator += refSize + 2 + 1 + 1;

            // std.debug.print("SIZE {d} \n", .{refSize});

            // std.debug.print("REF {any} \n", .{mainValue.?.mv_data == null});

            if (mainValue == null) {
                // std.debug.print("get mainvalue\n", .{});

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

                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
                    continue :includeField;
                };

                mainValue = v;

                // REFLVL
                // case that you only include
                if (!idIsSet and start == null) {
                    idIsSet = true;
                    size += 1 + 4;
                    const s: results.Result = .{
                        .id = id,
                        .field = 255,
                        .val = v,
                        .start = null,
                        .includeMain = includeMain,
                        .refLvl = refLvl,
                    };
                    try ctx.results.append(s);
                }
            }

            if (mainValue.?.mv_data == null) {
                // std.debug.print("skip ref \n", .{});

                continue :includeField;
            }

            size += getSingleRefFields(ctx, singleRef, mainValue.?, refLvl, hasFields);
        } else {
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

            // structure a bit nicer
            if (field == 0) {
                mainValue = v;
            }

            if (!idIsSet and start == null) {
                idIsSet = true;
                size += 1 + 4;
                const s: results.Result = .{
                    .id = id,
                    .field = field,
                    .val = v,
                    .start = null,
                    .includeMain = includeMain,
                    .refLvl = refLvl,
                };
                try ctx.results.append(s);
            } else {
                if (start != null) {
                    const s: results.Result = .{
                        .id = id,
                        .field = field,
                        .val = v,
                        .start = start,
                        .includeMain = includeMain,
                        .refLvl = refLvl,
                    };
                    try ctx.results.append(s);
                } else {
                    const s: results.Result = .{
                        .id = null,
                        .field = field,
                        .val = v,
                        .start = start,
                        .includeMain = includeMain,
                        .refLvl = refLvl,
                    };
                    try ctx.results.append(s);
                }
            }

            if (field != 0) {
                size += (v.mv_size + 1 + 2);
            } else {
                if (includeMain.len != 0) {
                    size += std.mem.readInt(u16, includeMain[0..2], .little) + 1;
                } else {
                    size += (v.mv_size + 1);
                }
            }
        }
    }

    return size;
}
