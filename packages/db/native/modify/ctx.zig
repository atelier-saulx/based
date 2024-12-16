const db = @import("../db/db.zig");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const sort = @import("../db/sort.zig");

pub const ModifyCtx = struct {
    field: u8,
    id: u32,
    currentSortIndex: ?*selva.SelvaSortCtx,
    typeSortIndex: ?*sort.SortIndexes,
    typeId: db.TypeId,
    typeEntry: ?db.Type,
    fieldSchema: ?db.FieldSchema,
    node: ?db.Node,
    fieldType: types.Prop,
    db: *db.DbCtx,
};
