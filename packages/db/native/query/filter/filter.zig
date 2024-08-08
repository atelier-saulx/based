const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const std = @import("std");
const db = @import("../../db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const runCondition = @import("./conditions.zig").runConditions;

fn getField(ctx: QueryCtx, id: u32, typePrefix: [2]u8, currentShard: u16) []u8 {
    const dbiName = db.createDbiName(typePrefix, 0, @bitCast(currentShard));
    var shard = ctx.shards.get(dbiName);
    if (shard == null) {
        shard = db.openShard(true, dbiName, ctx.txn) catch null;
        if (shard != null) {
            ctx.shards.put(dbiName, shard.?) catch {
                return &.{};
            };
        }
    }
    if (shard == null) {
        return &.{};
    }
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
        return &.{};
    };
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub fn filter(
    ctx: QueryCtx,
    id: u32,
    typePrefix: [2]u8,
    conditions: []u8,
    currentShard: u16,
) bool {
    var fieldIndex: usize = 0;
    var main: ?[]u8 = undefined;

    while (fieldIndex < conditions.len) {
        const querySize: u16 = std.mem.readInt(
            u16,
            conditions[fieldIndex + 1 ..][0..2],
            .little,
        );
        const field = conditions[fieldIndex];
        if (field == 254) {
            const refTypePrefix: [2]u8 = .{ conditions[fieldIndex + 1 ..][4], conditions[fieldIndex + 1 ..][5] };
            if (main == null) {
                main = getField(ctx, id, typePrefix, currentShard);
                if (main.?.len == 0) {
                    return false;
                }
            }
            const refStart: u16 = std.mem.readInt(
                u16,
                conditions[fieldIndex + 1 ..][2..4],
                .little,
            );
            const refId = std.mem.readInt(u32, main.?[refStart..][0..4], .little);
            if (refId > 0) {
                const refConditions: []u8 = conditions[fieldIndex + 7 .. fieldIndex + 3 + querySize];
                if (!filter(ctx, refId, refTypePrefix, refConditions, db.idToShard(refId))) {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            const query = conditions[fieldIndex + 3 .. fieldIndex + 3 + querySize];
            if (field == 0) {
                if (main == null) {
                    main = getField(ctx, id, typePrefix, currentShard);
                    if (main.?.len == 0) {
                        return false;
                    }
                }
                if (!runCondition(main.?, query)) {
                    return false;
                }
            } else {
                const value = getField(ctx, id, typePrefix, currentShard);
                if (value.len == 0) {
                    return false;
                }
                if (!runCondition(value, query)) {
                    return false;
                }
            }
        }
        fieldIndex += querySize + 3;
    }

    return true;
}
