const db = @import("./db.zig");
const selva = @import("../selva.zig");
const c = @import("../c.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const readInt = @import("../utils.zig").readInt;
const types = @import("../types.zig");

pub const MainSortIndexes = std.AutoHashMap([4]u8, *selva.SelvaSortCtx);
pub const BuffSortIndexes = std.AutoHashMap(u8, *selva.SelvaSortCtx);

pub const TypeIndex = struct {
    string: BuffSortIndexes,
    main: MainSortIndexes,
};

pub const TypeSortIndexes = std.AutoHashMap(u16, *TypeIndex);

pub fn createSortIndexNode(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return createSortIndexNodeInternal(env, info) catch return null;
}

inline fn createSortIndexNodeInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const buf = try napi.get([]u8, env, args[1]);
    // size [2 type] [1 field] [2 start] [2 len] [1 typeIndex]
    const typeId = readInt(u16, buf, 0);
    const field = buf[2];
    const start = readInt(u16, buf, 3);
    const len = readInt(u16, buf, 5);
    const typeIndex = buf[7];
    const index = try createSortIndex(dbCtx, typeId, field, start, len, @enumFromInt(typeIndex));
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(env, index, null, null, &externalNapi);
    return externalNapi;
}

pub fn createSortIndex(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    len: u16,
    prop: types.Prop,
) !*selva.SelvaSortCtx {
    var typeIndexes: ?*TypeIndex = dbCtx.sortIndexes.get(typeId);

    if (typeIndexes == null) {
        typeIndexes = try dbCtx.allocator.create(TypeIndex);
        typeIndexes.?.* = .{
            .string = BuffSortIndexes.init(dbCtx.allocator),
            .main = MainSortIndexes.init(dbCtx.allocator),
        };
        try dbCtx.sortIndexes.put(typeId, typeIndexes.?);
    }

    const tI: *TypeIndex = typeIndexes.?;

    var sortIndex = getSortIndex(typeIndexes, field, start, len);

    var sortIndexType: u8 = undefined;
    if (prop == types.Prop.STRING) {
        sortIndexType = selva.SELVA_SORT_ORDER_BUFFER_ASC;
    } else {
        sortIndexType = selva.SELVA_SORT_ORDER_I64_ASC;
    }

    if (sortIndex == null) {
        sortIndex.? = selva.selva_sort_init(sortIndexType).?;
        if (prop == types.Prop.STRING) {
            try tI.string.put(field, sortIndex.?);
        } else {
            try tI.main.put(getMainSortKey(start, len), sortIndex.?);
        }
    }

    const sI = sortIndex.?;
    const typeEntry = try db.getType(dbCtx, typeId);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);

    var node = db.getFirstNode(typeEntry);
    var first = true;
    var i: u30 = 0;

    while (node != null) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break;
        }
        const id = db.getNodeId(node.?);
        var data: []u8 = undefined;

        if (start != 0) {
            data = db.getField(typeEntry, id, node.?, fieldSchema)[start .. start + len];
        } else {
            data = db.getField(typeEntry, id, node.?, fieldSchema);
        }

        if (prop == types.Prop.TIMESTAMP) {
            const specialScore: i64 = readInt(i64, data, 0);
            selva.selva_sort_insert_i64(sI, specialScore, node.?);
        } else if (prop == types.Prop.UINT32) {
            const specialScore: i64 = (@as(i64, readInt(u32, data, 0)) << 31) + i;
            selva.selva_sort_insert_i64(sI, specialScore, node.?);
        } else if (prop == types.Prop.STRING) {
            addToStringSortIndex(sI, data, node.?);
        }
        i += 1;
    }

    return sI;
}

fn getMainSortKey(start: u16, len: u16) [4]u8 {
    const s: [2]u8 = @bitCast(start);
    const l: [2]u8 = @bitCast(len);
    return .{ s[0], s[1], l[0], l[1] };
}

pub fn getSortIndex(
    typeSortIndexes: ?*TypeIndex,
    field: u8,
    start: u16,
    len: u16,
) ?*selva.SelvaSortCtx {
    if (typeSortIndexes == null) {
        return null;
    }
    if (field == 0) {
        return typeSortIndexes.?.main.get(getMainSortKey(start, len));
    } else {
        return typeSortIndexes.?.string.get(field);
    }
}

pub fn getTypeSortIndexes(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
) ?*TypeIndex {
    return dbCtx.sortIndexes.get(typeId);
}

pub fn addToStringSortIndex(
    sortIndex: *selva.SelvaSortCtx,
    data: []u8,
    node: db.Node,
) void {
    const maxStrLen = if (data.len < 10) data.len else 10;
    if (data[1] == 0) {
        selva.selva_sort_insert_buf(sortIndex, data[2..maxStrLen].ptr, 8, node);
    } else {
        // need decompress so sad...
    }
}

// pub fn removeSortIndex() void {
//     std.debug.print("remove sIndex \n", .{});
// }

// pub fn getTypeSortIndexes() *SortIndexes {}

// pub fn getSortIndex() *selva.SelvaSortCtx {}

// pub fn getSortIndexByType() *selva.SelvaSortCtx {}
