const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Filter = @import("./filter.zig");

pub fn largeRef(ctx: *Query.QueryCtx, q: []u8, value: []u8, i: *usize) !bool {
    const selectReference = utils.readNext(t.FilterSelect, q, i);
    const nodeId = utils.read(u32, value, 0);
    if (nodeId == 0) {
        i.* += selectReference.size;
        return false;
    }
    const refTypeEntry = try Node.getType(ctx.db, selectReference.typeId);
    if (Node.getNode(refTypeEntry, nodeId)) |refNode| {
        const refPass = try Filter.filter(
            refNode,
            ctx,
            q[i.* .. i.* + selectReference.size],
            refTypeEntry,
        );
        i.* += selectReference.size;
        return refPass;
    }
    i.* += selectReference.size;
    return true;
}
