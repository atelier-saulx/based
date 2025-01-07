const db = @import("./db.zig");
const selva = @import("../selva.zig");
const c = @import("../c.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const readInt = @import("../utils.zig").readInt;
const types = @import("../types.zig");

pub const SortIndexMeta = struct {
    prop: types.Prop,
    start: u16,
    len: u16, // len can be added somewhere else
    index: *selva.SelvaSortCtx,
};

pub const EMPTY_CHAR: [16]u8 = [_]u8{0} ** 16;
pub const EMPTY_CHAR_SLICE = @constCast(&EMPTY_CHAR)[0..16];

// key of main sort indexes is START, key of buffSort is field
pub const MainSortIndexes = std.AutoHashMap(u16, *SortIndexMeta);
pub const FieldSortIndexes = std.AutoHashMap(u8, *SortIndexMeta);

pub const TypeIndex = struct {
    field: FieldSortIndexes,
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
) !*SortIndexMeta {
    var typeIndexes: ?*TypeIndex = dbCtx.sortIndexes.get(typeId);
    if (typeIndexes == null) {
        typeIndexes = try dbCtx.allocator.create(TypeIndex);
        typeIndexes.?.* = .{
            .field = FieldSortIndexes.init(dbCtx.allocator),
            .main = MainSortIndexes.init(dbCtx.allocator),
        };
        try dbCtx.sortIndexes.put(typeId, typeIndexes.?);
    }
    const tI: *TypeIndex = typeIndexes.?;
    var sortIndex = getSortIndex(typeIndexes, field, start);
    const sortIndexType: selva.SelvaSortOrder = try db.getSortFlag(prop, false);
    if (sortIndex == null) {
        sortIndex.? = try dbCtx.allocator.create(SortIndexMeta);
        sortIndex.?.* = .{
            .index = selva.selva_sort_init(sortIndexType).?,
            .len = len,
            .start = start,
            .prop = prop,
        };
        if (field == 0) {
            try tI.main.put(start, sortIndex.?);
        } else {
            try tI.field.put(field, sortIndex.?);
        }
    }
    const sI = sortIndex.?;
    const typeEntry = try db.getType(dbCtx, typeId);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);
    var node = db.getFirstNode(typeEntry);
    var first = true;
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
        addToSortIndex(sI, data, node.?);
    }
    _ = selva.selva_sort_defrag(sI.index);
    return sI;
}

pub fn getSortIndex(
    typeSortIndexes: ?*TypeIndex,
    field: u8,
    start: u16,
) ?*SortIndexMeta {
    if (typeSortIndexes == null) {
        return null;
    }
    const tI = typeSortIndexes.?;
    if (field == 0) {
        return tI.main.get(start);
    } else {
        return tI.field.get(field);
    }
}

pub fn getTypeSortIndexes(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
) ?*TypeIndex {
    return dbCtx.sortIndexes.get(typeId);
}

inline fn parseString(data: []u8) [*]u8 {
    if (data.len < 18) {
        var arr: [16]u8 = [_]u8{0} ** 16;
        var i: usize = 2;
        while (i < data.len) : (i += 1) {
            arr[i - 2] = data[i];
        }
        return &arr;
    } else {
        if (data[1] == 0) {
            const slice = data[2..18];
            return slice.ptr;
        } else {
            // need decompress so sad...
        }
    }
    return EMPTY_CHAR_SLICE.ptr;
}

pub fn addToSortIndex(
    sortIndex: *SortIndexMeta,
    data: []u8,
    node: db.Node,
) void {
    const prop = sortIndex.prop;
    if (prop == types.Prop.TIMESTAMP or prop == types.Prop.NUMBER) {
        const specialScore: i64 = readInt(i64, data, sortIndex.start);
        selva.selva_sort_insert_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.ENUM or prop == types.Prop.UINT8) {
        const specialScore: i64 = data[sortIndex.start];
        selva.selva_sort_insert_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.UINT32) {
        const specialScore: i64 = @intCast(readInt(u32, data, sortIndex.start));
        selva.selva_sort_insert_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.STRING) {
        selva.selva_sort_insert_buf(sortIndex.index, parseString(data), 8, node);
    }
}

pub fn removeFromSortIndex(
    sortIndex: *SortIndexMeta,
    data: []u8,
    node: db.Node,
) void {
    const prop = sortIndex.prop;
    if (prop == types.Prop.TIMESTAMP or prop == types.Prop.NUMBER) {
        const specialScore: i64 = readInt(i64, data, sortIndex.start);
        selva.selva_sort_remove_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.ENUM or prop == types.Prop.UINT8) {
        const specialScore: i64 = data[sortIndex.start];
        selva.selva_sort_remove_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.UINT32) {
        const specialScore: i64 = @intCast(readInt(u32, data, sortIndex.start));
        selva.selva_sort_remove_i64(sortIndex.index, specialScore, node);
    } else if (prop == types.Prop.STRING) {
        selva.selva_sort_remove_buf(sortIndex.index, parseString(data), 8, node);
    }
}
