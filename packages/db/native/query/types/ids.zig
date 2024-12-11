const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const types = @import("../../types.zig");
const hasId = @import("../hasId.zig").hasId;
const search = @import("../filter/search.zig");
const readInt = @import("../../utils.zig").readInt;

pub fn sort(
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
        start = readInt(u16, sortBuffer, 2);
        len = readInt(u16, sortBuffer, 4);
    } else {
        start = 0;
        len = 0;
    }
    const sortFlag = try db.getSortFlag(sortFieldType, queryType == 10);
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(sortFlag, ids.len * 4).?;

    sortItem: while (i < ids.len) : (i += 4) {
        const id = readInt(u32, ids, i);
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

pub fn default(
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    checkItem: while (i < ids.len) : (i += 4) {
        const id = readInt(u32, ids, i);
        const node = db.getNode(id, typeEntry);
        if (node == null) {
            continue :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        const size = try getFields(
            node.?,
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
    }
}
