const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("common.zig");
const Include = @import("include/include.zig");
const Filter = @import("./filter/filter.zig");
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const Selva = @import("../selva/selva.zig");
const Thread = @import("../thread/thread.zig");
const Schema = @import("../selva/schema.zig");
const t = @import("../types.zig");
const Sort = @import("../sort/sort.zig");
const Aggregates = @import("aggregates/aggregates.zig");
const GroupBy = @import("aggregates/group.zig");
const GroupByHashMap = @import("aggregates/hashMap.zig").GroupByHashMap;
const String = @import("../string.zig");
const writeAs = utils.writeAs;
const read = utils.read;

fn iterator(
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
    while (it.next()) |node| {
        if (It == t.QueryIteratorType.filter) {
            if (!try Filter.filter(node, ctx, filter, typeEntry)) {
                continue;
            }
        }
        if (offset != 0) {
            offset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(node));
        try Include.include(node, ctx, nestedQuery, typeEntry);
        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    return nodeCnt;
}

fn iteratorEdge(
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
    const edgeTypeEntry = try Node.getType(ctx.db, header.edgeTypeId);
    const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];
    while (it.nextRef()) |ref| {
        if (offset != 0) {
            offset -= 1;
            continue;
        }
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(ref.node));
        try Include.include(ref.node, ctx, nestedQuery, typeEntry);
        try ctx.thread.query.append(t.ReadOp.edge);
        try Include.include(ref.edge, ctx, edgeQuery, edgeTypeEntry);
        nodeCnt += 1;
        if (nodeCnt >= header.limit) {
            break;
        }
    }
    i.* += header.edgeSize;
    return nodeCnt;
}

const IdsIterator = struct {
    ids: []u32,
    i: u32,
    typeEntry: Node.Type,
    pub fn next(self: *IdsIterator) ?Node.Node {
        if (self.i == self.ids.len) {
            return null;
        }
        const node = Node.getNode(self.typeEntry, self.ids[self.i]);
        self.i += 1;
        return node;
    }
};

pub fn ids(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &i);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const size = header.size;
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var it = IdsIterator{ .i = 0, .ids = utils.read([]u32, q, size + 4), .typeEntry = typeEntry };
    var nodeCnt: u32 = 0;
    switch (header.iteratorType) {
        .default => {
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .desc => {
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .sort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var itSort = try Sort.fromIterator(false, false, ctx.db, ctx.thread, typeEntry, &sortHeader, &it);
            nodeCnt = try iterator(.default, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
        },
        .descSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var itSort = try Sort.fromIterator(true, false, ctx.db, ctx.thread, typeEntry, &sortHeader, &it);
            nodeCnt = try iterator(.default, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
        },
        else => {},
    }
    ctx.thread.query.write(nodeCnt, sizeIndex);
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
        .filter => {
            var it = Node.iterator(false, typeEntry);
            nodeCnt = try iterator(.filter, ctx, q, &it, &header, typeEntry, &i);
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
    ctx.thread.query.write(nodeCnt, sizeIndex);
}

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
        .edgeInclude => {
            var it = try References.iterator(false, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, q, &it, &header, typeEntry, i);
        },
        .edgeIncludeDesc => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
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
        .desc => {
            var it = try References.iterator(true, false, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .sort => {
            var it = try referencesSort(false, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeDesc => {
            var it = try References.iterator(true, true, ctx.db, from, header.prop, fromType);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
        },
        .descSort => {
            var it = try referencesSort(true, false, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeDescSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iterator(.default, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeIncludeSort => {
            var it = try referencesSort(false, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, q, &it, &header, typeEntry, i);
            it.deinit();
        },
        .edgeIncludeDescSort => {
            var it = try referencesSort(true, true, ctx, q, from, fromType, i, &header, typeEntry);
            nodeCnt = try iteratorEdge(.edgeInclude, ctx, q, &it, &header, typeEntry, i);
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

pub fn aggregates(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    var nodeCnt: u32 = 0;

    const header = utils.readNext(t.AggHeader, q, &i);
    utils.debugPrint("header: {any}\n", .{header});
    const aggDefs = q[i..];
    const typeId = header.typeId;
    const typeEntry = try Node.getType(ctx.db, typeId);
    var hadAccumulated: bool = false;
    const isSamplingSet = header.isSamplingSet;
    const hasGroupBy = header.hasGroupBy;

    const accumulatorProp = try ctx.db.allocator.alloc(u8, header.accumulatorSize);
    @memset(accumulatorProp, 0);
    defer ctx.db.allocator.free(accumulatorProp);
    const hllAccumulator = Selva.c.selva_string_create(null, Selva.c.HLL_INIT_SIZE, Selva.c.SELVA_STRING_MUTABLE);
    defer Selva.c.selva_string_free(hllAccumulator);

    var it = Node.iterator(false, typeEntry);
    if (hasGroupBy) {
        var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
        defer groupByHashMap.deinit();

        nodeCnt = try GroupBy.iterator(
            &groupByHashMap,
            &it,
            header.limit,
            undefined, // filterBuf
            aggDefs,
            header.accumulatorSize,
            typeEntry,
            hllAccumulator,
            &hadAccumulated,
        );
        try GroupBy.finalizeGroupResults(ctx, &groupByHashMap, aggDefs);
    } else {
        nodeCnt = try Aggregates.iterator(ctx, &it, header.limit, undefined, aggDefs, accumulatorProp, typeEntry, hllAccumulator, &hadAccumulated);
        try Aggregates.finalizeResults(ctx, aggDefs, accumulatorProp, isSamplingSet, 0);
    }
}

pub fn aggregatesCount(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.AggHeader, q, &i);
    const typeId = header.typeId;
    const typeEntry = try Node.getType(ctx.db, typeId);
    const count: u32 = @truncate(Node.getNodeCount(typeEntry));
    try ctx.thread.query.append(count);
}
