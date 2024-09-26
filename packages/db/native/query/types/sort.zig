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

pub fn queryIds(
    comptime queryType: comptime_int,
    ids: []u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    _: u32,
    _: u32,
) !void {
    const typeEntry = try db.getType(typeId);
    var i: u32 = 0;

    var start: u16 = undefined;
    var len: u16 = undefined;
    const sortField: u8 = sortBuffer[0];
    const sortFieldType: u8 = sortBuffer[1];

    if (sortBuffer.len == 6) {
        start = utils.readInt(u16, sortBuffer, 2);
        len = utils.readInt(u16, sortBuffer, 4);
    } else {
        start = 0;
        len = 0;
    }

    var sortFlag: selva.SelvaSortOrder = undefined;

    switch (sortFieldType) {
        1 => {
            if (queryType == 10) {
                sortFlag = selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                sortFlag = selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        5 => {
            if (queryType == 10) {
                sortFlag = selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                sortFlag = selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        10 => {
            if (queryType == 10) {
                sortFlag = selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                sortFlag = selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        4 => {
            if (queryType == 10) {
                sortFlag = selva.SELVA_SORT_ORDER_DOUBLE_DESC;
            } else {
                sortFlag = selva.SELVA_SORT_ORDER_DOUBLE_ASC;
            }
        },
        11 => {
            if (queryType == 10) {
                sortFlag = selva.SELVA_SORT_ORDER_BUFFER_DESC;
            } else {
                sortFlag = selva.SELVA_SORT_ORDER_BUFFER_ASC;
            }
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }

    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(sortFlag, ids.len).?;

    sortItem: while (i < ids.len) : (i += 1) {
        const id = ids[i];
        const node = db.getNode(id, typeEntry);
        if (node == null) {
            continue :sortItem;
        }
        if (!filter(node.?, typeEntry, conditions)) {
            continue :sortItem;
        }
        const value = db.getField(node.?, try db.getFieldSchema(sortField, typeEntry));
        if (sortFieldType == 1) {
            selva.selva_sort_insert_i64(sortCtx, utils.readInt(i64, value, start), node);
        } else if (sortFieldType == 11) {
            if (start > 0 and len > 0) {
                selva.selva_sort_insert_buf(sortCtx, value[start .. start + len].ptr, value.len, node);
            } else {
                selva.selva_sort_insert_buf(sortCtx, value.ptr, value.len, node);
            }
        } else if (sortFieldType == 4) {
            selva.selva_sort_insert_double(sortCtx, @floatFromInt(utils.readInt(u64, value, start)), node);
        } else if (sortFieldType == 5) {
            selva.selva_sort_insert_i64(sortCtx, @intCast(utils.readInt(u32, value, start)), node);
        } else if (sortFieldType == 10) {
            selva.selva_sort_insert_i64(sortCtx, @intCast(value[start]), node);
        }
    }

    selva.selva_sort_foreach_begin(sortCtx);
    while (!selva.selva_sort_foreach_done(sortCtx)) {
        // if @limit stop
        const node: db.Node = @ptrCast(selva.selva_sort_foreach(sortCtx));
        const size = try getFields(node, ctx, db.getNodeId(node), typeEntry, include);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
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

        const size = try getFields(node.?, ctx, id, typeEntry, include);

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }

    sort.resetTxn(readTxn);
}
