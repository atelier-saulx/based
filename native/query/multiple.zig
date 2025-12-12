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

fn iterator(
    comptime _: t.QueryIteratorType,
    ctx: *Query.QueryCtx,
    nestedQuery: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    while (it.next()) |node| {
        if (offset != 0) {
            offset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(node));
        try include.include(node, ctx, nestedQuery, typeEntry);
        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    return nodeCnt;
}

fn iteratorEdge(
    comptime itType: t.QueryIteratorType,
    ctx: *Query.QueryCtx,
    nestedQuery: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    edgeQuery: anytype,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;

    const edgeTypeEntry = if (itType == t.QueryIteratorType.edgeInclude)
        try Node.getType(ctx.db, header.edgeTypeId)
    else
        void;

    while (it.next()) |ref| {
        if (offset != 0) {
            offset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try include.include(ref.node, ctx, nestedQuery, typeEntry);

        switch (itType) {
            .edgeInclude, .edgeIncludeFilter, .edgeIncludeDescFilter => {
                try ctx.thread.query.append(t.ReadOp.edge);
                try include.include(ref.edgeNode, ctx, edgeQuery, edgeTypeEntry);
            },
            else => {},
        }

        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    return nodeCnt;
}

pub fn default(
    comptime queryType: t.QueryType,
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    if (queryType == .defaultSort) {
        const sortHeader = utils.readNext(t.SortHeader, q, &index);
        const nestedQuery = q[index..];
        switch (header.iteratorType) {
            .default => {
                var it = try Sort.iterator(false, ctx.db, ctx.thread, header.typeId, &sortHeader);
                nodeCnt = try iterator(.default, ctx, nestedQuery, &it, &header, typeEntry);
            },
            .desc => {
                var it = try Sort.iterator(true, ctx.db, ctx.thread, header.typeId, &sortHeader);
                nodeCnt = try iterator(.desc, ctx, nestedQuery, &it, &header, typeEntry);
            },
            else => {},
        }
    } else {
        const nestedQuery = q[index..];
        switch (header.iteratorType) {
            .default => {
                var it = Node.iterator(false, typeEntry);
                nodeCnt = try iterator(.default, ctx, nestedQuery, &it, &header, typeEntry);
            },
            .desc => {
                var it = Node.iterator(true, typeEntry);
                nodeCnt = try iterator(.desc, ctx, nestedQuery, &it, &header, typeEntry);
            },
            else => {},
        }
    }

    ctx.thread.query.write(nodeCnt, sizeIndex);
}

pub fn references(
    comptime queryType: t.QueryType,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    index: *usize,
) !void {
    const header = utils.readNext(t.QueryHeader, q, index);
    try ctx.thread.query.append(t.ReadOp.references);
    try ctx.thread.query.append(header.prop);
    const resultByteSizeIndex = try ctx.thread.query.reserve(4);
    const startIndex = ctx.thread.query.index;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    const nestedQuery = q[index.* .. index.* + header.size - utils.sizeOf(t.QueryHeader)];
    var nodeCnt: u32 = 0;

    if (queryType == .referencesSort) {
        std.debug.print("need to make different iterator (sorted) \n", .{});
    }

    switch (header.iteratorType) {
        .edgeInclude => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            const s = index.* + header.size - utils.sizeOf(t.QueryHeader);
            const edgeQuery = q[s .. s + header.edgeSize];
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, nestedQuery, &it, &header, typeEntry, edgeQuery);
        },
        .edge => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iteratorEdge(.edge, ctx, nestedQuery, &it, &header, typeEntry, void);
        },
        .default => {
            var it = try References.iterator(false, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterator(.default, ctx, nestedQuery, &it, &header, typeEntry);
        },
        else => {},
    }

    index.* += header.size;
    ctx.thread.query.write(nodeCnt, sizeIndex);

    ctx.thread.query.writeAs(
        u32,
        @truncate(ctx.thread.query.index - startIndex),
        resultByteSizeIndex,
    );
}

pub fn aggregates(
    comptime queryType: t.QueryType,
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var index: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &index);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    if (queryType == .aggregatesCount) {
        // later
    } else {
        const nestedQuery = q[index..];
        switch (header.iteratorType) {
            .aggregates => {
                var it = Node.iterator(false, typeEntry);
                nodeCnt = try iterator(.default, ctx, nestedQuery, &it, &header, typeEntry);
            },
            .aggregatesGroupBy => {},
            else => {
                // later
            },
        }
    }
    ctx.thread.query.write(nodeCnt, sizeIndex);
}
