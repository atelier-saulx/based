const db = @import("../db/db.zig");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const sort = @import("../db/sort.zig");
const std = @import("std");
const read = @import("../utils.zig").read;




pub const ModifyCtx = struct {
    field: u8,
    id: u32,
    currentSortIndex: ?*sort.SortIndexMeta,
    typeSortIndex: ?*sort.TypeIndex,
    typeId: db.TypeId,
    typeEntry: ?db.Type,
    fieldSchema: ?db.FieldSchema,
    node: ?db.Node,
    fieldType: types.Prop,
    db: *db.DbCtx,
    typeInfo: []u8,
    dirtyBlocks: std.AutoHashMap(u64, null); ,
};

pub fn getIdOffset(ctx: *ModifyCtx, typeId: u16) u32 {
    var j: usize = 0;
    while (j < ctx.typeInfo.len) : (j += 10) {
        const tId = read(u16, ctx.typeInfo, j);
        if (tId == typeId) {
            return read(u32, ctx.typeInfo, j + 2);
        }
    }
    return 0;
}

pub inline markDirtyRange(ctx: *ModifyCtx) void {
    ctx.dirtyBlocks.put(ctx.id, null);    
}