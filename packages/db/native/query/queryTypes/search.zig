const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const searchMethods = @import("../filter/search.zig");
const std = @import("std");
const MaxVectorScore = @import("../filter/types.zig").MaxVectorScore;
const MaxStringScore = @import("../filter/types.zig").MaxStringScore;

pub const QuerySearchCtxNoVector = struct {
    score: u8,
    totalSearchResults: usize,
    scoreSortCtx: *selva.SelvaSortCtx,
    i: i64,
    correctedForOffset: u32,
};

pub const QuerySearchCtxVector = struct {
    score: f32,
    totalSearchResults: usize,
    scoreSortCtx: *selva.SelvaSortCtx,
    i: i64,
    correctedForOffset: u32,
};

pub fn QuerySearchCtx(comptime isVector: bool) type {
    if (isVector) {
        return QuerySearchCtxVector;
    }
    return QuerySearchCtxNoVector;
}

// comptime isVector
pub fn createSearchCtx(comptime isVector: bool, offset: u32) QuerySearchCtx(isVector) {
    return .{
        .score = if (isVector) MaxVectorScore else MaxStringScore,
        .totalSearchResults = 0,
        .scoreSortCtx = selva.selva_sort_init(if (isVector) selva.SELVA_SORT_ORDER_FLOAT_ASC else selva.SELVA_SORT_ORDER_I64_ASC).?,
        .i = 0,
        .correctedForOffset = offset,
    };
}

// comptime isVector
pub fn addToScore(
    comptime isVector: bool,
    queryCtx: *QueryCtx,
    ctx: *QuerySearchCtx(isVector),
    node: db.Node,
    typeEntry: db.Type,
    conditions: []u8,
    searchCtx: *const searchMethods.SearchCtx(isVector),
) void {
    const dbCtx = queryCtx.db;
    if (!filter(dbCtx, node, typeEntry, conditions, null, null, 0, false)) {
        return;
    }
    if (ctx.correctedForOffset != 0) {
        ctx.correctedForOffset -= 1;
        return;
    }
    if (isVector) {
        ctx.score = searchMethods.searchVector(node, typeEntry, searchCtx);
        if (ctx.score > searchCtx.score) {
            return;
        }
        ctx.totalSearchResults += 1;
    } else {
        ctx.score = searchMethods.search(node, typeEntry, searchCtx);
        if (ctx.score > searchCtx.bad) {
            return;
        }
        if (ctx.score < searchCtx.meh) {
            ctx.totalSearchResults += 1;
        }
    }
    ctx.i += 1;
    if (isVector) {
        selva.selva_sort_insert_float(ctx.scoreSortCtx, ctx.score, node);
    } else {
        const specialScore: i64 = (@as(i64, ctx.score) << 31) + ctx.i;
        selva.selva_sort_insert_i64(ctx.scoreSortCtx, @intCast(specialScore), node);
    }
}

// comptime isVector
pub fn addToResults(
    comptime isVector: bool,
    ctx: *QueryCtx,
    sCtx: *QuerySearchCtx(isVector),
    include: []u8,
    limit: u32,
    typeEntry: db.Type,
) !void {
    var it: selva.SelvaSortIterator = undefined;
    selva.selva_sort_foreach_begin(sCtx.scoreSortCtx, &it);
    var i: i64 = 0;
    while (!selva.selva_sort_foreach_done(@ptrCast(&it))) {
        var sortKey: if (isVector) f32 else i64 = undefined;
        var sortedNode: db.Node = undefined;
        if (isVector) {
            sortedNode = @ptrCast(selva.selva_sort_foreach_float(sCtx.scoreSortCtx, &it, &sortKey));
        } else {
            sortedNode = @ptrCast(selva.selva_sort_foreach_i64(sCtx.scoreSortCtx, &it, &sortKey));
        }
        const id = db.getNodeId(sortedNode);
        i += 1;
        var size: usize = undefined;
        if (isVector) {
            size = try getFields(
                sortedNode,
                ctx,
                id,
                typeEntry,
                include,
                null,
                @bitCast(sortKey),
                false,
            );
        } else {
            const realScore: u8 = @truncate(@as(u64, @bitCast((sortKey - i) >> 31)));
            size = try getFields(
                sortedNode,
                ctx,
                id,
                typeEntry,
                include,
                null,
                .{ realScore, 0, 0, 0 },
                false,
            );
        }
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
