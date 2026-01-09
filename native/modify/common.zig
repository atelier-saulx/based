const Node = @import("../selva/node.zig");
const Schema = @import("../selva/schema.zig");
const errors = @import("../errors.zig");
const sort = @import("../sort/sort.zig");
const std = @import("std");
const read = @import("../utils.zig").read;
const Subscription = @import("../subscription/common.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const ModifyCtx = struct {
    index: usize,
    offset: u32,
    result: []u8,
    resultLen: u32,
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
    subTypes: ?*Subscription.TypeSubscriptionCtx, // prob want to add subs here
    idSubs: ?[]*Subscription.Sub,
    batch: []u8,
    err: errors.ClientError,
    thread: *Thread.Thread,
};

pub fn resolveTmpId(ctx: *ModifyCtx, tmpId: u32) u32 {
    const index = tmpId * 5;
    return read(u32, ctx.batch, index);
}
