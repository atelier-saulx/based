const db = @import("./db.zig");
const selva = @import("../selva.zig");
const c = @import("../c.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const readInt = @import("../utils.zig").readInt;

pub const SortIndexes = std.AutoHashMap([4]u8, *selva.SelvaSortCtx);
pub const TypeSortIndexes = std.AutoHashMap(u16, *SortIndexes);

pub fn createSortIndexNode(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return createSortIndexNodeInternal(env, info) catch return null;
}

inline fn createSortIndexNodeInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const buf = try napi.get([]u8, env, args[1]);

    // size [2 type] [1 field] [2 start] [2 len]
    // 7 len
    const typeId = readInt(u16, buf, 0);
    const field = buf[2];
    const start = readInt(u16, buf, 3);
    const len = readInt(u16, buf, 5);

    const index = try createSortIndex(dbCtx, typeId, field, start, len);
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(env, index, null, null, &externalNapi);
    return externalNapi;
}

pub fn getSortKey(field: u8, start: u16, len: u16) [4]u8 {
    if (field != 0) {
        return .{ 255, 255, field, 0 };
    }
    const s: [2]u8 = @bitCast(start);
    const l: [2]u8 = @bitCast(len);
    return .{ s[0], s[1], l[0], l[1] };
}

pub fn createSortIndex(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    len: u16,
) !*selva.SelvaSortCtx {
    var typeIndexes: ?*SortIndexes = dbCtx.sortIndexes.get(typeId);

    if (typeIndexes == null) {
        typeIndexes = try dbCtx.allocator.create(SortIndexes);
        typeIndexes.?.* = SortIndexes.init(dbCtx.allocator);
        try dbCtx.sortIndexes.put(typeId, typeIndexes.?);
    }

    const tI: *SortIndexes = typeIndexes.?;

    const sKey = getSortKey(field, start, len);
    var sortIndex: ?*selva.SelvaSortCtx = tI.get(sKey);

    if (sortIndex == null) {
        sortIndex.? = selva.selva_sort_init(selva.SELVA_SORT_ORDER_I64_ASC).?;
        try tI.put(sKey, sortIndex.?);
    }

    std.debug.print("lets create sort index sKey: {any} type: {d}, field: {d} start: {d} len: {d} typeIndexes: {any} \n", .{
        sKey,
        typeId,
        field,
        start,
        len,
        typeIndexes,
    });

    return sortIndex.?;
}

pub fn getSortIndex(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    len: u16,
) ?*selva.SelvaSortCtx {
    const types = dbCtx.sortIndexes.get(typeId);
    if (types == null) {
        return null;
    }
    const key = getSortKey(field, start, len);
    return types.?.get(key);
}

// pub fn removeSortIndex() void {
//     std.debug.print("remove sIndex \n", .{});
// }

// pub fn getTypeSortIndexes() *SortIndexes {}

// pub fn getSortIndex() *selva.SelvaSortCtx {}

// pub fn getSortIndexByType() *selva.SelvaSortCtx {}
