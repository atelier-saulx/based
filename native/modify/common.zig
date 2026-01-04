const Node = @import("../selva/node.zig");
const Schema = @import("../selva/schema.zig");
const errors = @import("../errors.zig");
const sort = @import("../sort/sort.zig");
const std = @import("std");
const read = @import("../utils.zig").read;
const Subscription = @import("../db/subscription/common.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const ModifyCtx = struct {
    field: u8,
    id: u32,
    currentSortIndex: ?*sort.SortIndexMeta,
    typeSortIndex: ?*sort.TypeIndex,
    typeId: t.TypeId,
    typeEntry: ?Node.Type,
    fieldSchema: ?Schema.FieldSchema,
    node: ?Node.Node,
    fieldType: t.PropType,
    db: *DbCtx,
    dirtyRanges: std.AutoArrayHashMap(u64, f64),
    subTypes: ?*Subscription.TypeSubscriptionCtx,
    idSubs: ?[]*Subscription.IdSubsItem,
    batch: []u8,
    err: errors.ClientError,
    thread: *Thread.Thread,
};

pub fn resolveTmpId(ctx: *ModifyCtx, tmpId: u32) u32 {
    const index = tmpId * 5;
    return read(u32, ctx.batch, index);
}

pub inline fn markDirtyRange(ctx: *ModifyCtx, typeId: u16, nodeId: u32) void {
    const blockCapacity = Node.getBlockCapacity(ctx.db, typeId);
    const tmp: u64 = nodeId - @as(u64, @intFromBool((nodeId % blockCapacity) == 0));
    const mtKey = (@as(u64, typeId) << 32) | ((tmp / blockCapacity) * blockCapacity + 1);
    ctx.dirtyRanges.put(mtKey, @floatFromInt(mtKey)) catch return;
}

pub fn markReferencesDirty(ctx: *ModifyCtx, dstTypeId: u16, refs: []u32) void {
    for (refs) |nodeId| {
        markDirtyRange(ctx, dstTypeId, nodeId);
    }
}
