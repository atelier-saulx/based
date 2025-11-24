const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("common.zig");
const include = @import("include.zig");
const db = @import("../selva/db.zig");
const Node = @import("../selva/node.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");

pub fn default(
    // references: true
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);

    var correctedForOffset: u32 = header.offset;

    var nodeCnt: u32 = 0;
    const nestedQuery = q[index..];
    const sizeIndex = try Thread.reserveResultSpace(true, ctx.thread, 4);

    // this will be a nice iterator
    const typeEntry = try db.getType(ctx.db, header.typeId);
    var node = Node.getFirstNode(typeEntry);

    while (nodeCnt < header.limit) {

        // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
        //     node = db.getNextNode(typeEntry, node.?);
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

            try Thread.appendToResult(true, ctx.thread, t.ReadOp.id);
            try Thread.appendToResult(true, ctx.thread, Node.getNodeId(n));

            // const nodeHeader = try threads.sliceFromResult(true, ctx.thread, 5);
            // utils.write(nodeHeader, t.ReadOp.id, 0);
            // utils.write(nodeHeader, Node.getNodeId(n), 1);

            try include.include(n, ctx, nestedQuery);

            nodeCnt += 1;

            node = Node.getNextNode(typeEntry, n);
        } else {
            break;
        }
    }

    Thread.writeToResult(true, ctx.thread, nodeCnt, sizeIndex);
}
