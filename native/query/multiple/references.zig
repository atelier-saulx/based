const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Sort = @import("../../sort/sort.zig");
const References = @import("../../selva/references.zig");
const Query = @import("../common.zig");
const Iterate = @import("./iterate.zig");

inline fn referencesSort(
    comptime desc: bool,
    comptime edge: bool,
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
    header: *const t.QueryHeader,
    typeEntry: Node.Type,
) !Sort.SortIterator(desc, edge) {
    const sortHeader = utils.readNext(t.SortHeader, q, i);
    var refs = try References.iterator(desc, edge, ctx.db, from, header.prop, fromType);
    return try Sort.fromIterator(desc, edge, ctx.db, ctx.thread, typeEntry, &sortHeader, &refs);
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
        .default => {
            var it = try References.iterator(false, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .desc => {
            var it = try References.iterator(true, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .sort => {
            var it = try referencesSort(false, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descSort => {
            var it = try referencesSort(true, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .filter => {
            var it = try References.iterator(false, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .descFilter => {
            var it = try References.iterator(true, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .filterSort => {
            var it = try referencesSort(false, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .descFilterSort => {
            var it = try referencesSort(true, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },

        // name this large / hasEdge
        .edge => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeDesc => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeDescSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },

        .edgeFilter => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeDescFilter => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeFilterSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeDescFilterSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },

        // --------------------
        .edgeFilterOnEdge => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.edgeFilterOnEdge, ctx, q, &it, &header, typeEntry, i);
        },
        // add filter, sort, desc etc
        // --------------------

        // split up this file
        // then we can name this edgeInclude
        .edgeInclude => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeDesc => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.edge(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeIncludeDescSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.edge(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },

        .edgeIncludeFilter => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeDescFilter => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.filter, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeFilterSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.edge(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeIncludeDescFilterSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try Iterate.edge(.filter, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },

        .edgeIncludeFilterOnEdge => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try Iterate.edge(.edgeIncludeFilterOnEdge, ctx, q, &it, &header, typeEntry, i);
        },

        else => {},
    }

    i.* += header.includeSize; //+ header.edgeSize;
    ctx.thread.query.write(nodeCnt, sizeIndex);

    ctx.thread.query.writeAs(
        u32,
        @truncate(ctx.thread.query.index - startIndex),
        resultByteSizeIndex,
    );
}
