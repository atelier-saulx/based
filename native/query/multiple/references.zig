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

pub const EdgeType = enum(u8) {
    noEdge = 0,
    edge = 1,
    includeEdge = 2,
};

inline fn referencesSort(
    comptime desc: bool,
    comptime edge: bool,
    comptime filterType: t.FilterType,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Node.Type,
    i: *usize,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
) !Sort.SortIterator(desc, edge) {
    const sortHeader = utils.readNext(t.SortHeader, q, i);
    const edgeType = if (filterType == .edgeOnly or filterType == .edgeAndProps) try Node.getType(ctx.db, header.edgeTypeId) else undefined;
    const filter = if (filterType == .propOnly or filterType == .edgeAndProps) try Filter.readFilter(ctx, i, header.filterSize, q, typeEntry) else undefined;
    const edgeFilter = if (filterType == .edgeOnly or filterType == .edgeAndProps) try Filter.readFilter(ctx, i, header.edgeFilterSize, q, edgeType) else undefined;
    var refs = try References.iterator(desc, edge, ctx.db, from, header.prop, fromType);
    return try Sort.fromIterator(
        desc,
        edge,
        ctx,
        typeEntry,
        &sortHeader,
        &refs,
        filterType,
        filter,
        edgeFilter,
    );
}

inline fn iterate(
    comptime filterType: t.FilterType,
    comptime edge: EdgeType,
    ctx: *Query.QueryCtx,
    q: []u8,
    it: anytype,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
    i: *usize,
) !u32 {
    if (edge == .includeEdge or
        filterType == .edgeOnly or
        filterType == .edgeAndProps)
    {
        return try Iterate.edge(filterType, edge == .includeEdge, ctx, q, it, header, typeEntry, i);
    } else {
        return try Iterate.node(filterType == .propOnly, ctx, q, it, header, typeEntry, i);
    }
}

pub fn references(
    comptime edge: EdgeType,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Node.Type,
    i: *usize,
) !void {
    const hasEdge = edge != .noEdge;

    const header = utils.readNext(t.QueryHeader, q, i);
    try ctx.thread.query.append(t.ReadOp.references);
    try ctx.thread.query.append(header.prop);
    const resultByteSizeIndex = try ctx.thread.query.reserve(4);
    const startIndex = ctx.thread.query.index;
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    // std.debug.print("iteratorType: {any} \n", .{header.iteratorType});
    switch (header.iteratorType) {
        // --------- default -------------
        .default => {
            var it = try References.iterator(false, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .desc => {
            var it = try References.iterator(true, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
        },
        // --------- sort -------------
        .sort => {
            var it = try referencesSort(false, hasEdge, .noFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descSort => {
            var it = try referencesSort(true, hasEdge, .noFilter, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------- filter: propOnly -------------
        .filter => {
            var it = try References.iterator(false, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.propOnly, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilter => {
            var it = try References.iterator(true, hasEdge, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.propOnly, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSort => {
            var it = try referencesSort(false, hasEdge, .propOnly, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSort => {
            var it = try referencesSort(true, hasEdge, .propOnly, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------- filter: edgeOnly -------------
        .filterEdge => {
            // have to hard core the hasEdge here else the comptime is incorrect for the any callback
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeOnly, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilterEdge => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeOnly, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSortEdge => {
            var it = try referencesSort(false, true, .edgeOnly, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSortEdge => {
            var it = try referencesSort(true, true, .edgeOnly, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------- filter: edgeAndProp -------------
        .filterEdgeAndProp => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeAndProps, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilterEdgeAndProp => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterate(.edgeAndProps, edge, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSortEdgeAndProp => {
            var it = try referencesSort(false, true, .edgeAndProps, ctx, q, from, fromType, i, &header, typeEntry);
            // ----  X
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSortEdgeAndProp => {
            var it = try referencesSort(true, true, .edgeAndProps, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterate(.noFilter, edge, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        // --------------------
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
