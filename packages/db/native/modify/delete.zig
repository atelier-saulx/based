const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const ModifyCtx = @import("./ctx.zig").ModifyCtx;

pub fn deleteField(ctx: ModifyCtx) usize {
    const dbiName = db.createDbiName(ctx.typeId, ctx.field, ctx.currentShard);
    var shard = ctx.shards.get(dbiName);
    if (shard == null) {
        shard = db.openShard(true, dbiName, ctx.txn) catch null;
        if (shard != null) {
            ctx.shards.put(dbiName, shard.?) catch {
                shard = null;
            };
        }
    }
    if (shard != null) {
        var k: c.MDB_val = .{ .mv_size = ctx.keySize, .mv_data = @constCast(&ctx.id) };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {};
        errors.mdb(c.mdb_cursor_del(shard.?.cursor, 0)) catch {};
    }

    return 1;
}
