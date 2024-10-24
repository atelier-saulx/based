const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");

pub const ModifyCtx = struct {
    field: u8,
    id: u32,
    sortWriteTxn: ?*c.MDB_txn,
    currentSortIndex: ?sort.SortIndex,
    sortIndexes: sort.Indexes,
    typeId: db.TypeId,
    typeEntry: ?db.Type,
    fieldSchema: ?db.FieldSchema,
    node: ?db.Node,
    fieldType: types.Prop,
    db: *db.DbCtx,
};

pub fn getSortIndex(ctx: *ModifyCtx, start: u16) !?sort.SortIndex {
    const sortIndexName = sort.getSortName(ctx.typeId, ctx.field, start);
    if (sort.hasReadSortIndex(ctx.db, sortIndexName)) {
        var sortIndex = ctx.sortIndexes.get(sortIndexName);
        if (sortIndex == null) {
            if (ctx.sortWriteTxn == null) {
                ctx.sortWriteTxn = try sort.createTransaction(false, ctx.db);
            }
            sortIndex = try sort.createWriteSortIndex(ctx.db, sortIndexName, ctx.sortWriteTxn);
            ctx.sortIndexes.put(sortIndexName, sortIndex.?) catch {
                return null;
            };
        }
        return sortIndex;
    }
    return null;
}
