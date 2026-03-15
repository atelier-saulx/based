const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Sort = @import("../../sort/sort.zig");
const References = @import("../../selva/references.zig");
const Query = @import("../common.zig");
const Iterate = @import("./iterate.zig");
const Filter = @import("../filter/filter.zig");
const std = @import("std");

inline fn referencesSort(
    comptime order: t.Order,
    comptime edge: t.Edge,
    comptime filterType: t.FilterType,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Node.Type,
    i: *usize,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
) !Sort.SortIterator(order, edge) {
    const sortHeader = utils.readNext(t.SortHeader, q, i);
    const edgeType = if (filterType == .edgeFilter) try Node.getType(ctx.db, header.edgeTypeId) else undefined;

    const filter = if (filterType != .noFilter) try Filter.readFilter(edge, ctx, i, header.filterSize, q, typeEntry, edgeType);

    var refs = try References.iterator(order, edge, ctx.db, from, header.prop, fromType);
    return try Sort.fromIterator(
        order,
        edge,
        ctx,
        typeEntry,
        &sortHeader,
        &refs,
        filterType,
        filter,
    );
}

inline fn iterate(
    comptime filterType: t.FilterType,
    comptime edge: t.EdgeType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    if (edge == .includeEdge or filterType == .edgeFilter) {
        return try Iterate.edge(filterType, edge, ctx, q, it, header, typeEntry, i);
    } else {
        const hasFilter: t.Filter = if (filterType == .propFilter) .filter else .noFilter;
        return try Iterate.node(hasFilter, ctx, q, it, header, typeEntry, i);
    }
}

pub fn references(
    comptime edge: t.EdgeType,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Node.Type,
    i: *usize,
) !void {
    const hasEdge: t.Edge = if (edge != .noEdge) t.Edge.edge else t.Edge.noEdge;
    const header = utils.readNext(t.QueryHeader, q, i);
    try ctx.thread.query.append(t.ReadOp.references);
    try ctx.thread.query.append(header.prop);
    const resultByteSizeIndex = try ctx.thread.query.reserve(4);
    const startIndex = ctx.thread.query.index;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    switch (header.iteratorType) {
        // --------- default -------------
        .default => {
            var it = try References.iterator(.asc, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .desc => {
            var it = try References.iterator(.desc, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        // --------- sort -------------
        .sort => {
            var it = try referencesSort(.asc, hasEdge, .noFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descSort => {
            var it = try referencesSort(.desc, hasEdge, .noFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------- filter: only prop -------------
        .filter => {
            var it = try References.iterator(.asc, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.propFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilter => {
            var it = try References.iterator(.desc, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.propFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSort => {
            var it = try referencesSort(.asc, hasEdge, .propFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSort => {
            var it = try referencesSort(.desc, hasEdge, .propFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------- filter: /w edge -------------
        .filterEdge => {
            var it = try References.iterator(.asc, .edge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilterEdge => {
            var it = try References.iterator(.desc, .edge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSortEdge => {
            var it = try referencesSort(.asc, .edge, .edgeFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSortEdge => {
            var it = try referencesSort(.desc, .edge, .edgeFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
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
