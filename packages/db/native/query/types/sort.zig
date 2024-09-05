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
const hasId = @import("../hasId.zig").hasId;
const mem = std.mem;

pub fn queryIdsSort(
    comptime queryType: comptime_int,
    ids: []u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    _: u32,
    limit: u32,
    low: u32,
    high: u32,
) !void {
    const readTxn = try sort.initReadTxn();
    sort.renewTx(readTxn);
    const sortIndex = try sort.getOrCreateReadSortIndex(typeId, sortBuffer, ctx.id);
    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 5) {
        flag = c.MDB_LAST;
    }
    var first: bool = true;
    var lastCheck: usize = ids.len;

    const typeEntry = try db.getType(typeId);

    checkItem: while (!end and ctx.totalResults < limit) {
        var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdb(c.mdb_cursor_get(sortIndex.cursor, &k, &v, flag)) catch {
            end = true;
            break;
        };
        if (first) {
            first = false;
            if (queryType == 5) {
                flag = c.MDB_PREV;
            } else {
                flag = c.MDB_NEXT;
            }
        }
        const id = utils.readInt(u32, sort.readData(v), 0);
        if (!hasId(id, ids, &lastCheck, low, high)) {
            continue :checkItem;
        }

        const node = db.getNode(id, typeEntry);

        if (node == null) {
            continue :checkItem;
        }

        if (!filter(node.?, typeEntry, conditions)) {
            continue :checkItem;
        }

        const size = try getFields(node.?, ctx, id, typeEntry, null, include, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }

    sort.resetTxn(readTxn);
}

pub fn queryIdsSortBig(
    comptime queryType: comptime_int,
    ids: []u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    _: u32,
    limit: u32,
) !void {
    const readTxn = try sort.initReadTxn();
    sort.renewTx(readTxn);
    const sortIndex = try sort.getOrCreateReadSortIndex(typeId, sortBuffer, ctx.id);

    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 7) {
        flag = c.MDB_LAST;
    }
    var first: bool = true;
    var i: u32 = 0;
    var map: std.AutoHashMap(u32, u8) = undefined;
    map = std.AutoHashMap(u32, u8).init(ctx.allocator);
    while (i <= ids.len) : (i += 1) {
        try map.put(ids[i], 0);
    }

    const typeEntry = try db.getType(typeId);

    checkItem: while (!end and ctx.totalResults < limit) {
        var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdb(c.mdb_cursor_get(sortIndex.cursor, &k, &v, flag)) catch {
            end = true;
            break;
        };
        if (first) {
            first = false;
            if (queryType == 7) {
                flag = c.MDB_PREV;
            } else {
                flag = c.MDB_NEXT;
            }
        }
        const id = utils.readInt(u32, sort.readData(v), 0);
        if (!map.contains(id)) {
            continue :checkItem;
        }

        const node = db.getNode(id, typeEntry);

        if (node == null) {
            continue :checkItem;
        }

        if (!filter(node.?, typeEntry, conditions)) {
            continue :checkItem;
        }

        const size = try getFields(node.?, ctx, id, typeEntry, null, include, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }

    sort.resetTxn(readTxn);
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
) !void {
    const readTxn = try sort.initReadTxn();
    sort.renewTx(readTxn);
    const typeEntry = try db.getType(typeId);
    const sortIndex = try sort.getOrCreateReadSortIndex(typeId, sortBuffer, ctx.id);

    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 4) {
        flag = c.MDB_LAST;
    }
    var first: bool = true;
    var correctedForOffset: u32 = offset;

    checkItem: while (!end and ctx.totalResults < limit) {
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

        if (!filter(node.?, typeEntry, conditions)) {
            continue :checkItem;
        }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }

        const size = try getFields(node.?, ctx, id, typeEntry, null, include, 0);

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }

    sort.resetTxn(readTxn);
}
