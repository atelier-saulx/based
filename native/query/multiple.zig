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

pub fn default(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);
    const nestedQuery = q[index..];
    var correctedForOffset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);

    // so what we want is a node iterator for both refs and non refs
    // that iterator will have filter etc as options
    // so the code can be the same

    var it = Node.iterator(false, typeEntry);
    while (it.next()) |node| {
        // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
        //     node = Db.getNextNode(typeEntry, node.?);
        //     continue :checkItem;
        // }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(node));
        try include.include(node, ctx, nestedQuery, typeEntry);
        nodeCnt += 1;
        if (nodeCnt > header.limit) {
            break;
        }
    }

    ctx.thread.query.write(nodeCnt, sizeIndex);
}

pub fn references(
    ctx: *Query.QueryCtx,
    q: []u8,
    fromNode: Node.Node,
    orginalTypeEntry: Selva.Type,
    index: *usize,
) !void {
    const header = utils.readNext(t.QueryHeader, q, index);

    // write prop
    try ctx.thread.query.append(t.ReadOp.references);

    try ctx.thread.query.append(header.prop);

    // add 4
    const resultByteSizeIndex = try ctx.thread.query.reserve(4);
    const startIndex = ctx.thread.query.index;
    // ------------- this piece can be shared completely

    var correctedForOffset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const sizeIndex = try ctx.thread.query.reserve(4);
    // size - is lame
    const nestedQuery = q[index.* .. index.* + header.size - utils.sizeOf(t.QueryHeader)];

    // this is a difference so prob want comtime for typeEntry and fromNode
    const typeEntry = try Node.getType(ctx.db, header.typeId);

    // std.debug.print("FLAP {any} \n", .{header});

    if (header.hasEdges) {
        var it = try References.iterator(true, ctx.db, fromNode, header.prop, orginalTypeEntry);

        while (it.next()) |ref| {
            const node = ref.node;

            // ref.edgeNode
            // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
            //     node = Db.getNextNode(typeEntry, node.?);
            //     continue :checkItem;
            // }
            if (correctedForOffset != 0) {
                correctedForOffset -= 1;
                continue;
            }
            try ctx.thread.query.append(t.ReadOp.id);
            try ctx.thread.query.append(Node.getNodeId(node));
            try include.include(node, ctx, nestedQuery, typeEntry);

            // if filter on edge need to do some stuff
            if (header.edgeSize > 0) {
                // make this nice
                const s = index.* + header.size - utils.sizeOf(t.QueryHeader);
                const edgeQuery = q[s .. s + header.edgeSize];
                try ctx.thread.query.append(t.ReadOp.edge);
                const edgeTypeEntry = try Node.getType(ctx.db, header.edgeTypeId);
                try include.include(ref.edgeNode, ctx, edgeQuery, edgeTypeEntry);
            }

            nodeCnt += 1;
            if (nodeCnt > header.limit) {
                break;
            }
        }
    } else {
        var it = try References.iterator(false, ctx.db, fromNode, header.prop, orginalTypeEntry);
        while (it.next()) |node| {
            // if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
            //     node = Db.getNextNode(typeEntry, node.?);
            //     continue :checkItem;
            // }
            if (correctedForOffset != 0) {
                correctedForOffset -= 1;
                continue;
            }
            try ctx.thread.query.append(t.ReadOp.id);
            try ctx.thread.query.append(Node.getNodeId(node));
            try include.include(node, ctx, nestedQuery, typeEntry);
            nodeCnt += 1;
            if (nodeCnt > header.limit) {
                break;
            }
        }
    }

    // std.debug.print("REFS -> {any} \n", .{it.refs.nr_refs});
    index.* += header.size;
    if (header.hasEdges) {
        index.* += header.edgeSize;
    }

    ctx.thread.query.write(nodeCnt, sizeIndex);

    // ------------

    ctx.thread.query.writeAs(
        u32,
        @truncate(ctx.thread.query.index - startIndex),
        resultByteSizeIndex,
    );
}
