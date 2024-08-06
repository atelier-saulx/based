const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const std = @import("std");
const db = @import("../../db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const runCondition = @import("./conditions.zig").runConditions;

pub fn filter(
    ctx: QueryCtx,
    id: u32,
    type_prefix: [2]u8,
    conditions: []u8,
    currentShard: u16,
    // refLvl: u8,
) !bool {
    var fieldIndex: usize = 0;
    // fn for conditions
    while (fieldIndex < conditions.len) {

        // main slice in var
        // this in a fn
        // if (false) // contiue checkItem

        const querySize: u16 = std.mem.readInt(
            u16,
            conditions[fieldIndex + 1 ..][0..2],
            .little,
        );
        const field = conditions[fieldIndex];

        if (field == 254) {
            const s: u16 = std.mem.readInt(
                u16,
                conditions[fieldIndex + 1 ..][2..4],
                .little,
            );

            const type_prefix2: [2]u8 = .{ conditions[fieldIndex + 1 ..][4], conditions[fieldIndex + 1 ..][5] };

            // do something special here...
            // recursive so have to move fn to other file as well

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
                return false;
            };
            const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
            const refId = std.mem.readInt(u32, mainSlice[s..][0..4], .little);

            if (refId > 0) {
                std.debug.print("bla {d} {d} {d} {any} REF {d} \n", .{ field, querySize, s, type_prefix2, refId });

                // read actual condition

            } else {
                return false;
            }
        } else {
            const dbiName = db.createDbiName(type_prefix, field, @bitCast(currentShard));
            var shard = ctx.shards.get(dbiName);
            if (shard == null) {
                shard = db.openShard(true, dbiName, ctx.txn) catch null;
                if (shard != null) {
                    try ctx.shards.put(dbiName, shard.?);
                }
            }
            if (shard != null) {
                const query = conditions[fieldIndex + 3 .. fieldIndex + 3 + querySize];
                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
                    return false;
                };
                if (!runCondition(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], query)) {
                    return false;
                }
            } else {
                return false;
            }
        }
        fieldIndex += querySize + 3;
    }
    return true;
}
