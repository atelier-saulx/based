const std = @import("std");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const c = @import("../c.zig");

pub const ModifyCtx = struct {
    field: u8,
    typeId: db.TypeId,
    id: u32,
    currentShard: u16,
    shards: *db.WriteShards,
    txn: *c.MDB_txn,
    currentSortIndex: ?dbSort.SortIndex,
    sortIndexes: *std.AutoHashMap(dbSort.SortDbiName, dbSort.SortIndex),
};

pub fn getShard(ctx: ModifyCtx) ?db.Shard {
    const dbiName = db.getName(ctx.typeId, ctx.field, ctx.currentShard);
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

pub fn getSortIndex(ctx: ModifyCtx, start: u16) ?dbSort.SortIndex {
    const sortIndexName = dbSort.getSortName(ctx.typeId, ctx.field, start);
    if (dbSort.hasReadSortIndex(sortIndexName)) {
        var sortIndex = ctx.sortIndexes.get(sortIndexName);
        if (sortIndex == null) {
            sortIndex = dbSort.createWriteSortIndex(sortIndexName, ctx.txn);
            ctx.sortIndexes.put(sortIndexName, sortIndex.?) catch {
                return null;
            };
        }
        return sortIndex;
    }
    return null;
}
