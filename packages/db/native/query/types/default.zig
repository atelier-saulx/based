const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const searchStr = @import("../filter/search.zig");

pub fn default(
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    var correctedForOffset: u32 = offset;
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);
    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }
        const size = try getFields(
            node.?,
            ctx,
            db.getNodeId(node.?),
            typeEntry,
            include,
            null,
            null,
            false,
        );
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn search(
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    searchCtx: *const searchStr.SearchCtx,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);
    var score: u8 = 255;
    var totalSearchResults: usize = 0;
    const scoreSortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(selva.SELVA_SORT_ORDER_I64_ASC, limit).?;
    var i: i64 = 0;
    var correctedForOffset: u32 = offset;
    checkItem: while (totalSearchResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }
        score = searchStr.search(ctx.db, node.?, typeEntry, searchCtx);
        if (score > searchCtx.bad) {
            continue :checkItem;
        }
        if (score < searchCtx.meh) {
            totalSearchResults += 1;
        }
        i += 1;
        const specialScore: i64 = (@as(i64, score) << 31) + i;
        selva.selva_sort_insert_i64(scoreSortCtx, @intCast(specialScore), node.?);
    }
    selva.selva_sort_foreach_begin(scoreSortCtx);
    i = 0;
    while (!selva.selva_sort_foreach_done(scoreSortCtx)) {
        var sortKey: i64 = undefined;
        const sortedNode: db.Node = @ptrCast(selva.selva_sort_foreach_i64(scoreSortCtx, &sortKey));
        const id = db.getNodeId(sortedNode);
        i += 1;
        const realScore: u8 = @truncate(@as(u64, @bitCast((sortKey - i) >> 31)));
        const size = try getFields(
            sortedNode,
            ctx,
            id,
            typeEntry,
            include,
            null,
            realScore,
            false,
        );
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
        if (ctx.totalResults >= limit) {
            break;
        }
    }
    selva.selva_sort_destroy(scoreSortCtx);
}
