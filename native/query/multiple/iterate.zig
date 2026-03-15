const std = @import("std");
const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const Include = @import("../include/include.zig");
const Filter = @import("../filter/filter.zig");
const Node = @import("../../selva/node.zig");
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
    comptime hasFilter: t.Filter,
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
    if (hasFilter == .filter) {
        filter = try Filter.readFilter(.noEdge, ctx, i, header.filterSize, q, typeEntry, undefined);
    }
    const nestedQuery = q[i.* .. i.* + header.includeSize];
    while (offset > 0) {
        const n = it.next() orelse return 0;
        if (hasFilter == .filter) {
            if (try Filter.filter(.noEdge, n, ctx, filter)) {
                offset -= 1;
            }
        } else {
            offset -= 1;
        }
    }
    while (it.next()) |n| {
        if (hasFilter == .filter and !try Filter.filter(.noEdge, n, ctx, filter)) {
            continue;
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
    comptime filterType: t.FilterType,
    comptime edgeIncludeType: t.EdgeType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    var offset: u32 = header.offset;
    var nodeCnt: u32 = 0;
    const edgeType = try Node.getType(ctx.db, header.edgeTypeId);

    const filter = if (filterType != .noFilter) try Filter.readFilter(
        .edge,
        ctx,
        i,
        header.filterSize,
        q,
        typeEntry,
        edgeType,
    ) else undefined;

    const nestedQuery = q[i.* .. i.* + header.includeSize];
    const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];

    while (offset > 0) {
        _ = it.next() orelse return 0;
        offset -= 1;
    }

    while (it.nextRef()) |ref| {
        if (filterType == .propFilter) {
            if (!try Filter.filter(.noEdge, ref.node, ctx, filter)) continue;
        } else if (filterType == .edgeFilter) {
            if (!try Filter.filter(.edge, ref, ctx, filter)) continue;
        }

        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try Include.include(ref.node, ctx, nestedQuery, typeEntry);

        if (edgeIncludeType == .includeEdge) {
            try ctx.thread.query.append(t.ReadOp.edge);
            const edgesByteSizeIndex = try ctx.thread.query.reserve(4);
            const edgeStartIndex = ctx.thread.query.index;
            try Include.include(ref.edge, ctx, edgeQuery, edgeType);
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
