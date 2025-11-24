const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("./common.zig");
const include = @import("./include/include.zig");
const t = @import("../types.zig");
const db = @import("../db/db.zig");
const Node = @import("../db/Node.zig");
// const assert = std.debug.assert;

pub fn default(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);
    var correctedForOffset: u32 = header.offset;

    // assert(header.size == q.len);

    std.debug.print("multiple.default {any} {any} \n", .{ header, q.len });

    var nodeCnt: u32 = 0;
    const nestedQuery = q[index..];

    // this will be a nice iterator
    const typeEntry = try db.getType(ctx.db, header.typeId);
    var node = Node.getFirstNode(typeEntry);

    while (nodeCnt < header.limit) {
        if (node == null) {
            break;
        }
        // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
        //     node = db.getNextNode(typeEntry, node.?);
        //     continue :checkItem;
        // }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            node = Node.getNextNode(typeEntry, node.?);
            continue;
        }

        try include.include(node.?, ctx, nestedQuery);
        nodeCnt += 1;

        node = Node.getNextNode(typeEntry, node.?);
    }

    std.debug.print("results #{any} \n", .{nodeCnt});
}
