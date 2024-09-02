const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const c = @import("../c.zig");
const selva = @import("../selva.zig");

pub const ModifyCtx = struct {
    field: u8,
    id: u32,

    sortWriteTxn: ?*c.MDB_txn,

    currentSortIndex: ?db.SortIndex,

    sortIndexes: db.Indexes,

    typeId: db.TypeId,
    selvaTypeEntry: ?*selva.SelvaTypeEntry,

    selvaFieldSchema: ?*selva.SelvaFieldSchema,

    selvaNode: ?*selva.SelvaNode,
};

pub fn getSortIndex(ctx: *ModifyCtx, start: u16) !?db.SortIndex {
    const sortIndexName = sort.getSortName(ctx.typeId, ctx.field, start);
    if (sort.hasReadSortIndex(sortIndexName)) {
        var sortIndex = ctx.sortIndexes.get(sortIndexName);
        if (sortIndex == null) {
            if (ctx.sortWriteTxn == null) {
                ctx.sortWriteTxn = try db.createTransaction(false);
            }
            sortIndex = try sort.createWriteSortIndex(sortIndexName, ctx.sortWriteTxn);
            ctx.sortIndexes.put(sortIndexName, sortIndex.?) catch {
                return null;
            };
        }
        return sortIndex;
    }
    return null;
}
