const db = @import("../db/db.zig");
const types = @import("../types.zig");
const errors = @import("../errors.zig");
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
    fieldType: types.PropType,
    db: *db.DbCtx,
    dirtyRanges: std.AutoArrayHashMap(u64, f64),
    subTypes: ?*subs.TypeSubscriptionCtx,
    idSubs: ?[]subs.IdSubsItem,
    batch: []u8,
    err: errors.ClientError,
    threadCtx: *db.DbThread,
};

pub const ModOp = enum(u8) {
    SWITCH_FIELD = 0,
    SWITCH_ID_UPDATE = 1,
    SWITCH_TYPE = 2,
    CREATE_PROP = 3,
    DELETE_SORT_INDEX = 4,
    UPDATE_PARTIAL = 5,
    UPDATE_PROP = 6,
    ADD_EMPTY_SORT = 7,
    SWITCH_ID_CREATE_UNSAFE = 8,
    SWITCH_ID_CREATE = 9,
    SWITCH_ID_CREATE_RING = 19,
    SWITCH_EDGE_ID = 20,
    DELETE_NODE = 10,
    DELETE = 11,
    INCREMENT = 12,
    DECREMENT = 13,
    EXPIRE = 14,
    ADD_EMPTY_SORT_TEXT = 15,
    DELETE_TEXT_FIELD = 16,
    UPSERT = 17,
    INSERT = 18,
    PADDING = 255,
    _,
};

pub fn resolveTmpId(ctx: *ModifyCtx, tmpId: u32) u32 {
    const index = tmpId * 5;
    return read(u32, ctx.batch, index);
}

pub inline fn markDirtyRange(ctx: *ModifyCtx, typeId: u16, nodeId: u32) void {
    const blockCapacity = db.getBlockCapacity(ctx.db, typeId);
    const tmp: u64 = nodeId - @as(u64, @intFromBool((nodeId % blockCapacity) == 0));
    const mtKey = (@as(u64, typeId) << 32) | ((tmp / blockCapacity) * blockCapacity + 1);
    ctx.dirtyRanges.put(mtKey, @floatFromInt(mtKey)) catch return;
}

pub fn markReferencesDirty(ctx: *ModifyCtx, dstTypeId: u16, refs: []u32) void {
    for (refs) |nodeId| {
        markDirtyRange(ctx, dstTypeId, nodeId);
    }
}
