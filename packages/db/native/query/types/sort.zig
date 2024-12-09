const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const sort = @import("../../db/sort.zig");
const utils = @import("../../utils.zig");
const types = @import("../../types.zig");
const hasId = @import("../hasId.zig").hasId;
const mem = std.mem;
const search = @import("../filter/search.zig").search;
const readInt = @import("../../utils.zig").readInt;

pub fn queryIds(
    comptime queryType: comptime_int,
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    offset: u32,
    limit: u32,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    var start: u16 = undefined;
    var len: u16 = undefined;
    const sortField: u8 = sortBuffer[0];
    const sortFieldType: types.Prop = @enumFromInt(sortBuffer[1]);
    if (sortBuffer.len == 6) {
        start = utils.readInt(u16, sortBuffer, 2);
        len = utils.readInt(u16, sortBuffer, 4);
    } else {
        start = 0;
        len = 0;
    }
    const sortFlag = try db.getSortFlag(sortFieldType, queryType == 10);
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(sortFlag, ids.len * 4).?;

    sortItem: while (i < ids.len) : (i += 4) {
        const id = utils.readInt(u32, ids, i);
        const node = db.getNode(id, typeEntry);
        if (node == null) {
            continue :sortItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :sortItem;
        }
        const value = db.getField(typeEntry, id, node.?, try db.getFieldSchema(sortField, typeEntry));
        db.insertSort(sortCtx, node.?, sortFieldType, value, start, len);
    }

    selva.selva_sort_foreach_begin(sortCtx);

    while (!selva.selva_sort_foreach_done(sortCtx)) {
        // if @limit stop
        const node: db.Node = @ptrCast(selva.selva_sort_foreach(sortCtx));

        ctx.totalResults += 1;

        if (offset != 0 and ctx.totalResults <= offset) {
            continue;
        }

        const size = try getFields(
            node,
            ctx,
            db.getNodeId(node),
            typeEntry,
            include,
            null,
            false,
        );

        if (size > 0) {
            ctx.size += size;
        }

        if (ctx.totalResults - offset >= limit) {
            break;
        }
    }

    if (offset != 0) {
        ctx.totalResults -= offset;
    }

    selva.selva_sort_destroy(sortCtx);
}

pub fn querySort(
    comptime queryType: comptime_int,
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    searchBuf: []u8,
) !void {
    var movingLimit = limit;
    const readTxn = try sort.initReadTxn(ctx.db);
    sort.renewTx(readTxn);
    const typeEntry = try db.getType(ctx.db, typeId);

    const sortIndex = try sort.getOrCreateReadSortIndex(ctx.db, typeId, sortBuffer, ctx.id);

    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 4) {
        flag = c.MDB_LAST;
    }
    var first: bool = true;
    var correctedForOffset: u32 = offset;

    const hasSearch = searchBuf.len > 0;
    // add prebacked needle cache thingy

    var searchNeedle: selva.strsearch_needle = undefined;

    if (hasSearch) {
        const qSize = readInt(u16, searchBuf, 0);
        const sOffset = qSize + 2;
        const sQuery = searchBuf[2..sOffset];
        _ = selva.strsearch_init_u8_ctx(
            &searchNeedle,
            sQuery.ptr,
            sQuery.len,
            0,
            true,
        );
    }

    checkItem: while (!end and ctx.totalResults < movingLimit) {
        var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdb(c.mdb_cursor_get(sortIndex.cursor, &k, &v, flag)) catch {
            end = true;
            break;
        };

        if (first) {
            first = false;
            if (queryType == 4) {
                flag = c.MDB_PREV;
            } else {
                flag = c.MDB_NEXT;
            }
        }

        const id = utils.readInt(u32, sort.readData(v), 0);

        const node = db.getNode(id, typeEntry);

        if (node == null) {
            continue :checkItem;
        }

        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }

        if (hasSearch) {
            const d = search(ctx.db, node.?, typeEntry, searchBuf, &searchNeedle);
            if (d > 1) {
                continue :checkItem;
            }
            // std.debug.print("DISTANCE: {d} \n", .{d});
            if (d != 0) {
                movingLimit += 1;
            }
        }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }

        const size = try getFields(
            node.?,
            ctx,
            id,
            typeEntry,
            include,
            null,
            false,
        );

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }

    std.debug.print("DONE? \n", .{});

    sort.resetTxn(readTxn);
}
