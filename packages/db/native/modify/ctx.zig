const std = @import("std");
const db = @import("../db/db.zig");
const c = @import("../c.zig");

pub const ModifyCtx = struct {
    field: u8,
    typeId: db.TypeId,
    id: u32,
    currentShard: u16,
    shards: *db.WriteShards,
    txn: *c.MDB_txn,
};

pub fn getShard(ctx: ModifyCtx) ?db.Shard {
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
    return shard;
}
