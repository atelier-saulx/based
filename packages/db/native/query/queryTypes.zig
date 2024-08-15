const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db/db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const filter = @import("./filter/filter.zig").filter;
const sort = @import("../db/sort.zig");
const utils = @import("../utils.zig");
const hasId = @import("./hasId.zig").hasId;

pub fn queryId(
    id: u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    // pass this refactor single ref
    const currentShard = db.idToShard(id);
    if (filter(ctx.id, id, typeId, conditions, currentShard)) {
        const size = try getFields(ctx, id, typeId, null, include, currentShard, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn queryIds(
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    var i: u32 = 0;
    var currentShard: u16 = 0;
    checkItem: while (i <= ids.len) : (i += 4) {
        const id = std.mem.readInt(u32, ids[i..][0..4], .little);
        currentShard = db.idToShard(id);
        if (!filter(ctx.id, id, typeId, conditions, currentShard)) {
            continue :checkItem;
        }
        const size = try getFields(ctx, id, typeId, null, include, currentShard, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

const mem = std.mem;

pub fn queryIdsSort(
    comptime queryType: comptime_int,
    ids: []u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    lastId: u32,
    sortBuffer: []u8,
    _: u32,
    limit: u32,
) !void {
    const sortIndex = try sort.getOrCreateReadSortIndex(typeId, sortBuffer, ctx.id, lastId);
    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 5) {
        flag = c.MDB_LAST;
    }
    var currentShard: u16 = 0;
    var first: bool = true;
    var lastCheck: usize = ids.len;
    var isLarge: bool = false;
    var i: u32 = 0;
    var x: std.AutoHashMap(u32, u8) = undefined;

    if (ids.len > 512) {
        isLarge = true;
        x = std.AutoHashMap(u32, u8).init(ctx.allocator);
        while (i <= ids.len) : (i += 1) {
            x.put(ids[i], 0) catch {};
        }
    }

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

        const id = utils.readInt(u32, db.data(v), 0);

        // make it comptime and make 2 fns
        if (!isLarge) {
            if (!hasId(id, ids, &lastCheck)) {
                continue :checkItem;
            }
        } else {
            if (!x.contains(id)) {
                continue :checkItem;
            }
        }

        currentShard = db.idToShard(id);

        if (!filter(ctx.id, id, typeId, conditions, currentShard)) {
            continue :checkItem;
        }

        const size = try getFields(ctx, id, typeId, null, include, currentShard, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn queryNonSort(
    ctx: *QueryCtx,
    lastId: u32,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    var i: u32 = 1;
    var currentShard: u16 = 0;
    checkItem: while (i <= lastId and ctx.totalResults < offset + limit) : (i += 1) {
        if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
            currentShard += 1;
        }
        if (!filter(ctx.id, i, typeId, conditions, currentShard)) {
            continue :checkItem;
        }
        const size = try getFields(ctx, i, typeId, null, include, currentShard, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn querySort(
    comptime queryType: comptime_int,
    ctx: *QueryCtx,
    lastId: u32,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
) !void {
    const sortIndex = try sort.getOrCreateReadSortIndex(typeId, sortBuffer, ctx.id, lastId);
    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    if (queryType == 4) {
        flag = c.MDB_LAST;
    }
    var currentShard: u16 = 0;
    var first: bool = true;
    checkItem: while (!end and ctx.totalResults < offset + limit) {
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
        const id = utils.readInt(u32, db.data(v), 0);
        currentShard = db.idToShard(id);
        if (!filter(ctx.id, id, typeId, conditions, currentShard)) {
            continue :checkItem;
        }
        const size = try getFields(ctx, id, typeId, null, include, currentShard, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
