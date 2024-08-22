const db = @import("../db/db.zig");
const dbCtx = @import("../db/ctx.zig");
const sort = @import("../db/sort.zig");
const c = @import("../c.zig");

pub const ModifyCtx = struct {
    field: u8,
    typeId: dbCtx.TypeId,
    id: u32,
    currentShard: u16,
    shards: dbCtx.Shards,
    txn: *c.MDB_txn,
    currentSortIndex: ?dbCtx.SortIndex,
    sortIndexes: dbCtx.Indexes,
};

pub fn getOrCreateShard(ctx: *ModifyCtx) !dbCtx.Shard {
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
    return shard.?;
}

pub fn getSortIndex(ctx: *ModifyCtx, start: u16) !?dbCtx.SortIndex {
    const sortIndexName = sort.getSortName(ctx.typeId, ctx.field, start);
    if (sort.hasReadSortIndex(sortIndexName)) {
        var sortIndex = ctx.sortIndexes.get(sortIndexName);
        if (sortIndex == null) {
            sortIndex = try sort.createWriteSortIndex(sortIndexName, ctx.txn);
            ctx.sortIndexes.put(sortIndexName, sortIndex.?) catch {
                return null;
            };
        }
        return sortIndex;
    }
    return null;
}
