const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const sort = @import("../../db/sort.zig");
const types = @import("../../types.zig");
const hasId = @import("../hasId.zig").hasId;
const searchStr = @import("../filter/search.zig");
const readInt = @import("../../utils.zig").readInt;
const Result = @import("../results.zig").Result;

const std = @import("std");

pub fn default(
    comptime queryType: comptime_int,
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
) !void {
    // [order] [prop] [propType] [start] [start] [len] [len]
    const field = sortBuffer[0];
    // const propType: type.Prop = sortBuffer[2];
    const start = readInt(u16, sortBuffer, 2);
    // const len = readInt(u16, sortBuffer, 4);
    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(typeId), field, start);
    if (sIndex == null) {
        return;
    }
    const typeEntry = try db.getType(ctx.db, typeId);
    const sI = sIndex.?;
    var correctedForOffset: u32 = offset;

    if (queryType == 4) {
        selva.selva_sort_foreach_begin_reverse(sI);
    } else {
        selva.selva_sort_foreach_begin(sI);
    }

    checkItem: while (!selva.selva_sort_foreach_done(sI)) {
        var key: i64 = undefined;

        var node: db.Node = undefined;
        if (queryType == 4) {
            node = @ptrCast(selva.selva_sort_foreach_i64_reverse(sI, &key));
        } else {
            node = @ptrCast(selva.selva_sort_foreach_i64(sI, &key));
        }

        if (!filter(ctx.db, node, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }
        const id = db.getNodeId(node);
        const size = try getFields(
            node,
            ctx,
            id,
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
        if (ctx.totalResults >= limit) {
            break;
        }
    }
}

// pub fn search(
//     comptime queryType: comptime_int,
//     ctx: *QueryCtx,
//     offset: u32,
//     limit: u32,
//     typeId: db.TypeId,
//     conditions: []u8,
//     include: []u8,
//     sortBuffer: []u8,
//     searchCtx: *const searchStr.SearchCtx,
// ) !void {
// const readTxn = try sort.initReadTxn(ctx.db);
// sort.renewTx(readTxn);
// const typeEntry = try db.getType(ctx.db, typeId);
// const sortIndex = try sort.getOrCreateReadSortIndex(ctx.db, typeId, sortBuffer, ctx.id);
// var end: bool = false;
// var flag: c_uint = c.MDB_FIRST;
// if (queryType == 4) {
//     flag = c.MDB_LAST;
// }
// var first: bool = true;
// var score: u8 = 255;
// var totalSearchResults: usize = 0;
// const scoreSortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(selva.SELVA_SORT_ORDER_I64_ASC).?;
// var i: i64 = 0;
// var correctedForOffset: u32 = offset;
// checkItem: while (!end and totalSearchResults < limit) {
//     var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
//     var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
//     errors.mdb(c.mdb_cursor_get(sortIndex.cursor, &k, &v, flag)) catch {
//         end = true;
//         break;
//     };
//     if (first) {
//         first = false;
//         if (queryType == 4) {
//             flag = c.MDB_PREV;
//         } else {
//             flag = c.MDB_NEXT;
//         }
//     }
//     const id = readInt(u32, sort.readData(v), 0);
//     const node = db.getNode(id, typeEntry);
//     if (node == null) {
//         continue :checkItem;
//     }
//     if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
//         continue :checkItem;
//     }
//     if (correctedForOffset != 0) {
//         correctedForOffset -= 1;
//         continue :checkItem;
//     }
//     score = searchStr.search(ctx.db, node.?, typeEntry, searchCtx);
//     if (score > searchCtx.bad) {
//         continue :checkItem;
//     }
//     if (score < searchCtx.meh) {
//         totalSearchResults += 1;
//     }

//     i += 1;
//     const specialScore: i64 = (@as(i64, score) << 31) + i;
//     selva.selva_sort_insert_i64(scoreSortCtx, specialScore, node.?);
// }
// selva.selva_sort_foreach_begin(scoreSortCtx);
// i = 0;

// while (!selva.selva_sort_foreach_done(scoreSortCtx)) {
//     var sortKey: i64 = undefined;
//     const node: db.Node = @ptrCast(selva.selva_sort_foreach_i64(scoreSortCtx, &sortKey));
//     const id = db.getNodeId(node);
//     i += 1;
//     const realScore: u8 = @truncate(@as(u64, @bitCast((sortKey - i) >> 31)));
//     const size = try getFields(
//         node,
//         ctx,
//         id,
//         typeEntry,
//         include,
//         null,
//         realScore,
//         false,
//     );
//     if (size > 0) {
//         ctx.size += size;
//         ctx.totalResults += 1;
//     }
//     if (ctx.totalResults >= limit) {
//         break;
//     }
// }
// selva.selva_sort_destroy(scoreSortCtx);
// sort.resetTxn(readTxn);
// }
