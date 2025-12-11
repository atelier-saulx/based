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
const Sort = @import("../sort/sort.zig");

fn iterator(
    comptime _: t.QueryIteratorType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const nestedQuery = q[i.* .. i.* + header.includeSize];
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
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const nestedQuery = q[i.* .. i.* + header.includeSize];
    const edgeTypeEntry = if (itType == t.QueryIteratorType.edgeInclude)
        try Node.getType(ctx.db, header.edgeTypeId)
    else
        void;
    const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];
    while (it.nextRef()) |ref| {
        if (offset != 0) {
            offset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try include.include(ref.node, ctx, nestedQuery, typeEntry);
        try ctx.thread.query.append(t.ReadOp.edge);
        try include.include(ref.edge, ctx, edgeQuery, edgeTypeEntry);
        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    return nodeCnt;
}

pub fn default(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &i);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;
    switch (header.iteratorType) {
        .default => {
            var it = Node.iterator(false, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .desc => {
            var it = Node.iterator(true, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .sort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(false, ctx.db, ctx.thread, header.typeId, &sortHeader);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .descSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(true, ctx.db, ctx.thread, header.typeId, &sortHeader);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        else => {},
    }
    // i.* += header.includeSize; not nessecary scince its top level
    ctx.thread.query.write(nodeCnt, sizeIndex);
}

pub fn references(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    const header = utils.readNext(t.QueryHeader, q, i);
    try ctx.thread.query.append(t.ReadOp.references);
    try ctx.thread.query.append(header.prop);
    const resultByteSizeIndex = try ctx.thread.query.reserve(4);
    const startIndex = ctx.thread.query.index;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    switch (header.iteratorType) {
        .edgeInclude => {
            // then this can just go back to true and false
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, q, &it, &header, typeEntry, i);
        },
        .edge => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .default => {
            var it = try References.iterator(false, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .sort => {
            const sortHeader = utils.readNext(t.SortHeader, q, i);
            var refs = try References.iterator(false, false, ctx.db, from, header.prop, fromType);
            var it = try Sort.fromIterator(false, false, ctx.db, ctx.thread, typeEntry, &sortHeader, &refs);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, i);
            var refs = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            var it = try Sort.fromIterator(false, false, ctx.db, ctx.thread, typeEntry, &sortHeader, &refs);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, i);
            var refs = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            var it = try Sort.fromIterator(false, true, ctx.db, ctx.thread, typeEntry, &sortHeader, &refs);
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, q, &it, &header, typeEntry, i);
        },

        else => {},
    }

    i.* += header.includeSize;
    ctx.thread.query.write(nodeCnt, sizeIndex);

    ctx.thread.query.writeAs(
        u32,
        @truncate(ctx.thread.query.index - startIndex),
        resultByteSizeIndex,
    );
}
