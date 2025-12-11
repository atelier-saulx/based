const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("common.zig");
const include = @import("include/include.zig");
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const Selva = @import("../selva/selva.zig");
const Thread = @import("../thread/thread.zig");
const Schema = @import("../selva/schema.zig");
const t = @import("../types.zig");
const Sort = @import("../db/sort.zig");

pub fn reference(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    const header = utils.readNext(t.QueryHeaderSingle, q, i);
    const fs = try Schema.getFieldSchema(fromType, header.prop);
    const ref = References.getSingleReference(from, fs);

    std.debug.print("flap {any} \n", .{header});

    // this can be shared ofc
    if (ref) |r| {
        const typeEntry = try Node.getType(ctx.db, header.typeId);
        const n = Node.getNode(typeEntry, r.dst);

        if (n) |node| {
            try ctx.thread.query.append(t.ReadOp.reference);
            try ctx.thread.query.append(header.prop);

            const resultByteSizeIndex = try ctx.thread.query.reserve(4);
            const startIndex = ctx.thread.query.index;

            try ctx.thread.query.append(r.dst);

            const nestedQuery = q[i.* .. i.* + header.includeSize];

            try include.include(node, ctx, nestedQuery, typeEntry);

            ctx.thread.query.writeAs(
                u32,
                @truncate(ctx.thread.query.index - startIndex),
                resultByteSizeIndex,
            );
        }
    }

    // also add filter
    i.* += header.includeSize;
}
