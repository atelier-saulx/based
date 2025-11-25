const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("common.zig");
const include = @import("include.zig");
const Node = @import("../selva/node.zig");
const Thread = @import("../thread/thread.zig");
const Schema = @import("../selva/schema.zig");
const t = @import("../types.zig");

pub fn default(
    // references: true
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);
    const nestedQuery = q[index..];

    // this will be a nice iterator
    var correctedForOffset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var node = Node.getFirstNode(typeEntry);

    while (nodeCnt < header.limit) {

        // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
        //     node = Db.getNextNode(typeEntry, node.?);
        //     continue :checkItem;
        // }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            node = Node.getNextNode(typeEntry, node.?);
            continue;
        }

        if (node) |n| {
            if (correctedForOffset != 0) {
                correctedForOffset -= 1;
                node = Node.getNextNode(typeEntry, n);
                continue;
            }

            try ctx.thread.query.append(t.ReadOp.id);
            try ctx.thread.query.append(Node.getNodeId(n));
            try include.include(n, ctx, nestedQuery, typeEntry);

            nodeCnt += 1;

            node = Node.getNextNode(typeEntry, n);
        } else {
            break;
        }
    }

    ctx.thread.query.write(nodeCnt, sizeIndex);
}
