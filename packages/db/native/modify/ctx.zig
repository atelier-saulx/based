const db = @import("../db/db.zig");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const sort = @import("../db/sort.zig");
const std = @import("std");
const read = @import("../utils.zig").read;
const subs = @import("../db/subscription/types.zig");

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
    dirtyRanges: std.AutoArrayHashMap(u64, f64),
    subTypes: ?*subs.TypeSubscriptionCtx,
    subId: ?*subs.SingleId,
    // subId id ?
};

pub fn getIdOffset(ctx: *ModifyCtx, typeId: u16) u32 {
    var j: usize = 0;
    while (j < ctx.typeInfo.len) : (j += 6) {
        const tId = read(u16, ctx.typeInfo, j);
        if (tId == typeId) {
            return read(u32, ctx.typeInfo, j + 2);
        }
    }
    return 0;
}

pub inline fn markDirtyRange(ctx: *ModifyCtx, typeId: u16, nodeId: u32) void {
    const blockCapacity: u64 = selva.selva_get_block_capacity(selva.selva_get_type_by_index(ctx.db.selva, typeId));
    const tmp: u64 = nodeId - @as(u64, @intFromBool((nodeId % blockCapacity) == 0));
    const mtKey = (@as(u64, typeId) << 32) | ((tmp / blockCapacity) * blockCapacity + 1);
    ctx.dirtyRanges.put(mtKey, @floatFromInt(mtKey)) catch return;
}

pub fn markReferencesDirty(ctx: *ModifyCtx, dstTypeId: u16, refs: []u32) void {
    for (refs) |nodeId| {
        markDirtyRange(ctx, dstTypeId, nodeId);
    }
}
