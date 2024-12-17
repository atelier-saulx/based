const db = @import("./db.zig");
const selva = @import("../selva.zig");
const c = @import("../c.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const readInt = @import("../utils.zig").readInt;
const types = @import("../types.zig");

pub const MainSortIndex = struct {
    prop: types.Prop,
    len: u16,
    index: *selva.SelvaSortCtx,
};

pub const MainSortIndexes = std.AutoHashMap(u16, *MainSortIndex);
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

    var sortIndex = getSortIndex(typeIndexes, field, start);

    var sortIndexType: u8 = undefined;
    if (prop == types.Prop.STRING) {
        sortIndexType = selva.SELVA_SORT_ORDER_BUFFER_ASC;
    } else {
        sortIndexType = selva.SELVA_SORT_ORDER_I64_ASC;
    }

    var main: ?*MainSortIndex = null;

    if (sortIndex == null) {
        sortIndex.? = selva.selva_sort_init(sortIndexType).?;
        if (prop == types.Prop.STRING) {
            try tI.string.put(field, sortIndex.?);
        } else {
            main = try dbCtx.allocator.create(MainSortIndex);
            main.?.* = .{
                .index = sortIndex.?,
                .len = len,
                .prop = prop,
            };
            try tI.main.put(start, main.?);
        }
    } else if (len != 0 and field == 0) {}

    const sI = sortIndex.?;
    const typeEntry = try db.getType(dbCtx, typeId);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);

    var node = db.getFirstNode(typeEntry);
    var first = true;

    if (field != 0) {
        if (types.Prop.isBuffer(prop)) {
            while (node != null) {
                if (first) {
                    first = false;
                } else {
                    node = db.getNextNode(typeEntry, node.?);
                }
                if (node == null) {
                    break;
                }
                const data = db.getField(typeEntry, db.getNodeId(node.?), node.?, fieldSchema);
                addToStringSortIndex(sI, data, node.?);
            }
        }
    } else {
        while (node != null) {
            if (first) {
                first = false;
            } else {
                node = db.getNextNode(typeEntry, node.?);
            }
            if (node == null) {
                break;
            }
            const data = db.getField(typeEntry, db.getNodeId(node.?), node.?, fieldSchema);
            addMainSortIndex(main.?, data, start, node.?);
        }
    }

    return sI;
}

pub fn getSortIndex(
    typeSortIndexes: ?*TypeIndex,
    field: u8,
    start: u16,
) ?*selva.SelvaSortCtx {
    if (typeSortIndexes == null) {
        return null;
    }
    const tI = typeSortIndexes.?;
    if (field == 0) {
        const main = tI.main.get(start);
        if (main == null) {
            return null;
        }
        return main.?.index;
    } else {
        return tI.string.get(field);
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
    if (data.len < 2) {
        // TODO HANDLE UNDEFINED
        return;
    }
    const maxStrLen = if (data.len < 10) data.len else 10;
    if (data[1] == 0) {
        const slice = data[2..maxStrLen];
        selva.selva_sort_insert_buf(sortIndex, slice.ptr, slice.len - 2, node);
    } else {
        // need decompress so sad...
    }
}

pub fn removeFromStringSortIndex(
    _: *selva.SelvaSortCtx,
    _: []u8,
    _: db.Node,
) void {
    // if (data.len < 2) {
    //     // TODO HANDLE UNDEFINED
    //     return;
    // }
    // const maxStrLen = if (data.len < 10) data.len else 10;
    // if (data[1] == 0) {
    //     const slice = data[2..maxStrLen];
    //     // selva.selva_sort_insert_buf(sortIndex, slice.ptr, slice.len - 2, node);
    // } else {
    //     // need decompress so sad...
    // }
}

pub fn addMainSortIndex(
    mainIndex: *MainSortIndex,
    data: []u8,
    start: u16,
    node: db.Node,
) void {
    const prop = mainIndex.prop;
    if (prop == types.Prop.TIMESTAMP) {
        const specialScore: i64 = readInt(i64, data, start);
        selva.selva_sort_insert_i64(mainIndex.index, specialScore, node);
    } else if (prop == types.Prop.UINT32) {
        const specialScore: i64 = readInt(u32, data, start);
        selva.selva_sort_insert_i64(mainIndex.index, specialScore, node);
    }
}
