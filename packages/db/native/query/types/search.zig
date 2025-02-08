const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const searchStr = @import("../filter/search.zig");
const std = @import("std");

pub const QuerySearchCtx = struct {
    score: u8,
    totalSearchResults: usize,
    scoreSortCtx: *selva.SelvaSortCtx,
    i: i64,
    correctedForOffset: u32,
};

pub fn createSearchCtx(offset: u32) QuerySearchCtx {
    return .{
        .score = 255,
        .totalSearchResults = 0,
        .scoreSortCtx = selva.selva_sort_init(selva.SELVA_SORT_ORDER_I64_ASC).?,
        .i = 0,
        .correctedForOffset = offset,
    };
}

pub fn addToScore(
    queryCtx: *QueryCtx,
    ctx: *QuerySearchCtx,
    node: db.Node,
    typeEntry: db.Type,
    conditions: []u8,
    searchCtx: *const searchStr.SearchCtx,
) void {
    const dbCtx = queryCtx.db;
    if (!filter(queryCtx, node, typeEntry, conditions, null, null, 0, false)) {
        return;
    }
    if (ctx.correctedForOffset != 0) {
        ctx.correctedForOffset -= 1;
        return;
    }
    ctx.score = searchStr.search(dbCtx, node, typeEntry, searchCtx);
    if (ctx.score > searchCtx.bad) {
        return;
    }
    if (ctx.score < searchCtx.meh) {
        ctx.totalSearchResults += 1;
    }
    ctx.i += 1;
    const specialScore: i64 = (@as(i64, ctx.score) << 31) + ctx.i;
    selva.selva_sort_insert_i64(ctx.scoreSortCtx, @intCast(specialScore), node);
}

pub fn addToResults(
    ctx: *QueryCtx,
    sCtx: *QuerySearchCtx,
    include: []u8,
    limit: u32,
    typeEntry: db.Type,
) !void {
    selva.selva_sort_foreach_begin(sCtx.scoreSortCtx);
    var i: i64 = 0;
    while (!selva.selva_sort_foreach_done(sCtx.scoreSortCtx)) {
        var sortKey: i64 = undefined;
        const sortedNode: db.Node = @ptrCast(selva.selva_sort_foreach_i64(sCtx.scoreSortCtx, &sortKey));
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
    selva.selva_sort_destroy(sCtx.scoreSortCtx);
}
