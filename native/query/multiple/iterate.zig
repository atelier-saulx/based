const std = @import("std");
const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const Include = @import("../include/include.zig");
const Filter = @import("../filter/filter.zig");
const Node = @import("../../selva/node.zig");
const References = @import("../../selva/references.zig");
const Selva = @import("../../selva/selva.zig");
const Thread = @import("../../thread/thread.zig");
const Schema = @import("../../selva/schema.zig");
const t = @import("../../types.zig");
const Sort = @import("../../sort/sort.zig");
const Aggregates = @import("../aggregates/aggregates.zig");
const GroupBy = @import("../aggregates/group.zig");
const GroupByHashMap = @import("../aggregates/hashMap.zig").GroupByHashMap;
const String = @import("../../string.zig");
const writeAs = utils.writeAs;
const read = utils.read;

pub fn node(
    comptime It: t.QueryIteratorType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    var filter: []u8 = undefined;
    if (It == t.QueryIteratorType.filter) {
        filter = utils.sliceNext(header.filterSize, q, i);
        try Filter.prepare(filter, ctx, typeEntry);
    }
    const nestedQuery = q[i.* .. i.* + header.includeSize];
    while (offset > 0) {
        const n = it.next() orelse return 0;
        if (It == t.QueryIteratorType.filter) {
            if (try Filter.filter(n, ctx, filter)) {
                offset -= 1;
            }
        } else {
            offset -= 1;
        }
    }
    while (it.next()) |n| {
        if (It == t.QueryIteratorType.filter) {
            if (!try Filter.filter(n, ctx, filter)) {
                continue;
            }
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(n));
        try Include.include(n, ctx, nestedQuery, typeEntry);
        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    return nodeCnt;
}

pub fn edge(
    comptime It: t.QueryIteratorType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;

    var filter: []u8 = undefined;
    var edgeFilter: []u8 = undefined;

    if (It == t.QueryIteratorType.filter or
        It == t.QueryIteratorType.edgeFilterAndFilterOnEdge or
        It == t.QueryIteratorType.edgeIncludeFilterAndFilterOnEdge)
    {
        filter = utils.sliceNext(header.filterSize, q, i);
        try Filter.prepare(filter, ctx, typeEntry);
    }

    if (It == t.QueryIteratorType.edgeIncludeFilterOnEdge or
        It == t.QueryIteratorType.edgeFilterOnEdge or
        It == t.QueryIteratorType.edgeFilterAndFilterOnEdge or
        It == t.QueryIteratorType.edgeIncludeFilterAndFilterOnEdge)
    {
        edgeFilter = utils.sliceNext(header.edgeFilterSize, q, i);
        try Filter.prepare(edgeFilter, ctx, typeEntry);
    }

    const nestedQuery = q[i.* .. i.* + header.includeSize];
    const edgeTypeEntry = try Node.getType(ctx.db, header.edgeTypeId);
    const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];

    while (offset > 0) {
        _ = it.next() orelse return 0;
        offset -= 1;
    }

    while (it.nextRef()) |ref| {
        if (It == t.QueryIteratorType.filter or
            It == t.QueryIteratorType.edgeFilterAndFilterOnEdge or
            It == t.QueryIteratorType.edgeIncludeFilterAndFilterOnEdge)
        {
            if (!try Filter.filter(ref.node, ctx, filter)) {
                continue;
            }
        }

        if (It == t.QueryIteratorType.edgeIncludeFilterOnEdge or
            It == t.QueryIteratorType.edgeFilterOnEdge or
            It == t.QueryIteratorType.edgeFilterAndFilterOnEdge)
        {
            if (!try Filter.filter(ref.edge, ctx, edgeFilter)) {
                continue;
            }
        }

        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try Include.include(ref.node, ctx, nestedQuery, typeEntry);

        if (It != t.QueryIteratorType.edgeFilterOnEdge and
            It != t.QueryIteratorType.edgeFilterAndFilterOnEdge)
        {
            try ctx.thread.query.append(t.ReadOp.edge);
            const edgesByteSizeIndex = try ctx.thread.query.reserve(4);
            const edgeStartIndex = ctx.thread.query.index;
            try Include.include(ref.edge, ctx, edgeQuery, edgeTypeEntry);
            ctx.thread.query.writeAs(
                u32,
                @truncate(ctx.thread.query.index - edgeStartIndex),
                edgesByteSizeIndex,
            );
        }

        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    i.* += header.edgeSize;
    return nodeCnt;
}
