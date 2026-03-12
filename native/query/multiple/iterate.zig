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
    comptime hasFilter: bool,
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
    if (hasFilter) {
        filter = try Filter.readFilter(ctx, i, header.filterSize, q, typeEntry);
    }
    const nestedQuery = q[i.* .. i.* + header.includeSize];
    while (offset > 0) {
        const n = it.next() orelse return 0;
        if (hasFilter) {
            if (try Filter.filter(n, ctx, filter)) {
                offset -= 1;
            }
        } else {
            offset -= 1;
        }
    }
    while (it.next()) |n| {
        if (hasFilter) {
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
    comptime filterStrat: t.FilterType,
    comptime includeEdge: bool,
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
    if (filterStrat == .propOnly or filterStrat == .edgeAndProps) {
        filter = try Filter.readFilter(ctx, i, header.filterSize, q, typeEntry);
    }
    if (filterStrat == .edgeOnly or filterStrat == .edgeAndProps) {
        edgeFilter = try Filter.readFilter(ctx, i, header.edgeFilterSize, q, typeEntry);
    }

    const nestedQuery = q[i.* .. i.* + header.includeSize];
    const edgeTypeEntry = try Node.getType(ctx.db, header.edgeTypeId);
    const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];

    while (offset > 0) {
        _ = it.next() orelse return 0;
        offset -= 1;
    }

    while (it.nextRef()) |ref| {
        if (filterStrat == .propOnly or filterStrat == .edgeAndProps) {
            if (!try Filter.filter(ref.node, ctx, filter)) {
                continue;
            }
        }

        if (filterStrat == .edgeOnly or filterStrat == .edgeAndProps) {
            if (!try Filter.filter(ref.edge, ctx, edgeFilter)) {
                continue;
            }
        }

        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try Include.include(ref.node, ctx, nestedQuery, typeEntry);

        if (includeEdge) {
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
