const db = @import("./db.zig");
const decompressFirstBytes = @import("./decompress.zig").decompressFirstBytes;
const selva = @import("../selva.zig");
const c = @import("../c.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const utils = @import("../utils.zig");
const types = @import("../types.zig");
const errors = @import("../errors.zig");

const read = utils.read;

pub const SortIndexMeta = struct {
    prop: types.Prop,
    start: u16,
    len: u16, // len can be added somewhere else
    index: *selva.SelvaSortCtx,
    langCode: types.LangCode,
    field: u8,
};

const SIZE = 16;
pub const EMPTY: [0]u8 = [_]u8{0} ** 0;
pub const EMPTY_SLICE = @constCast(&EMPTY_CHAR)[0..0];

const EMPTY_CHAR: [SIZE]u8 = [_]u8{0} ** SIZE;
const EMPTY_CHAR_SLICE = @constCast(&EMPTY_CHAR)[0..SIZE];

// key of main sort indexes is START, key of buffSort is field
pub const MainSortIndexes = std.AutoHashMap(u16, *SortIndexMeta);
pub const TextSortIndexes = std.AutoHashMap(u16, *SortIndexMeta);
pub const FieldSortIndexes = std.AutoHashMap(u8, *SortIndexMeta);

pub const TypeIndex = struct {
    text: TextSortIndexes,
    field: FieldSortIndexes,
    main: MainSortIndexes,
};

pub const TypeSortIndexes = std.AutoHashMap(u16, *TypeIndex);

inline fn getTextKey(
    field: u8,
    lang: types.LangCode,
) u16 {
    return @as(u16, @bitCast([_]u8{ field, @intFromEnum(lang) }));
}

fn getSortFlag(sortFieldType: types.Prop, desc: bool) !selva.SelvaSortOrder {
    switch (sortFieldType) {
        types.Prop.INT8,
        types.Prop.UINT8,
        types.Prop.INT16,
        types.Prop.UINT16,
        types.Prop.INT32,
        types.Prop.UINT32,
        types.Prop.BOOLEAN,
        types.Prop.ENUM,
        types.Prop.CARDINALITY,
        => {
            if (desc) {
                return selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        types.Prop.NUMBER, types.Prop.TIMESTAMP => {
            if (desc) {
                return selva.SELVA_SORT_ORDER_DOUBLE_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_DOUBLE_ASC;
            }
        },
        types.Prop.STRING, types.Prop.TEXT, types.Prop.ALIAS, types.Prop.BINARY => {
            if (desc) {
                return selva.SELVA_SORT_ORDER_BUFFER_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_BUFFER_ASC;
            }
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }
}

pub fn createSortIndexNode(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return createSortIndexNodeInternal(env, info) catch return null;
}

inline fn createSortIndexNodeInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const buf = try napi.get([]u8, env, args[1]);
    // size [2 type] [1 field] [2 start] [2 len] [1 typeIndex]
    const typeId = read(u16, buf, 0);
    const field = buf[2];
    const start = read(u16, buf, 3);
    const len = read(u16, buf, 5);
    const typeIndex = buf[7];
    const lang = buf[8];
    const index = try createSortIndex(
        dbCtx,
        typeId,
        field,
        start,
        len,
        @enumFromInt(typeIndex),
        @enumFromInt(lang),
        true,
        false,
    );
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(env, index, null, null, &externalNapi);
    return externalNapi;
}

pub fn destroySortIndexNode(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return destroySortIndexNodeInternal(env, info) catch return null;
}

pub fn destroySortIndexNodeInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const buf = try napi.get([]u8, env, args[1]);
    // [2 type] [1 field] [2 start] [1 lang]
    const typeId = read(u16, buf, 0);
    const field = buf[2];
    const start = read(u16, buf, 3);
    const lang = read(u8, buf, 5);
    destroySortIndex(dbCtx, typeId, field, start, @enumFromInt(lang));
    return null;
}

pub fn createSortIndexMeta(
    start: u16,
    len: u16,
    prop: types.Prop,
    desc: bool,
    lang: types.LangCode,
    field: u8,
) !SortIndexMeta {
    const sortFlag = try getSortFlag(prop, desc);
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init2(sortFlag, 0).?;
    const s: SortIndexMeta = .{
        .len = len,
        .start = start,
        .index = sortCtx,
        .prop = prop,
        .langCode = lang,
        .field = field,
    };
    return s;
}

fn getOrCreateFromCtx(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    len: u16,
    prop: types.Prop,
    lang: types.LangCode,
    comptime desc: bool,
) !*SortIndexMeta {
    var sortIndex: ?*SortIndexMeta = undefined;
    var typeIndexes: ?*TypeIndex = dbCtx.sortIndexes.get(typeId);
    if (typeIndexes == null) {
        typeIndexes = try dbCtx.allocator.create(TypeIndex);
        typeIndexes.?.* = .{
            .field = FieldSortIndexes.init(dbCtx.allocator),
            .main = MainSortIndexes.init(dbCtx.allocator),
            .text = TextSortIndexes.init(dbCtx.allocator),
        };
        try dbCtx.sortIndexes.put(typeId, typeIndexes.?);
    }
    const tI: *TypeIndex = typeIndexes.?;
    sortIndex = getSortIndex(typeIndexes, field, start, lang);
    if (sortIndex == null) {
        sortIndex = try dbCtx.allocator.create(SortIndexMeta);
        sortIndex.?.* = try createSortIndexMeta(start, len, prop, desc, lang, field);
        if (field == 0) {
            try tI.main.put(start, sortIndex.?);
        } else if (prop == types.Prop.TEXT) {
            try tI.text.put(getTextKey(field, lang), sortIndex.?);
        } else {
            try tI.field.put(field, sortIndex.?);
        }
    }
    return sortIndex.?;
}

pub fn createSortIndex(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    len: u16,
    prop: types.Prop,
    lang: types.LangCode,
    comptime defrag: bool,
    comptime desc: bool,
) !*SortIndexMeta {
    const sortIndex = try getOrCreateFromCtx(
        dbCtx,
        typeId,
        field,
        start,
        len,
        prop,
        lang,
        desc,
    );

    const typeEntry = try db.getType(dbCtx, typeId);

    const fieldSchema = try db.getFieldSchema(typeEntry, field);
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
        const data = if (prop == types.Prop.TEXT) db.getText(
            typeEntry,
            db.getNodeId(node.?),
            node.?,
            fieldSchema,
            prop,
            lang,
        ) else db.getField(
            typeEntry,
            db.getNodeId(node.?),
            node.?,
            fieldSchema,
            prop,
        );
        insert(dbCtx, sortIndex, data, node.?);
    }
    if (defrag) {
        _ = selva.selva_sort_defrag(sortIndex.index);
    }

    return sortIndex;
}

pub fn destroySortIndex(
    dbCtx: *db.DbCtx,
    typeId: db.TypeId,
    field: u8,
    start: u16,
    lang: types.LangCode,
) void {
    const typeIndexes = dbCtx.sortIndexes.get(typeId);
    if (typeIndexes == null) {
        return;
    }
    const sortIndex = getSortIndex(typeIndexes, field, start, lang);
    if (sortIndex) |index| {
        const tI: *TypeIndex = typeIndexes.?;
        if (field == 0) {
            _ = tI.main.remove(start);
        } else {
            _ = tI.field.remove(field);
        }
        selva.selva_sort_destroy(index.index);
        dbCtx.allocator.destroy(index);
    }
}

pub fn getSortIndex(
    typeSortIndexes: ?*TypeIndex,
    field: u8,
    start: u16,
    lang: types.LangCode,
) ?*SortIndexMeta {
    if (typeSortIndexes == null) {
        return null;
    }
    const tI = typeSortIndexes.?;
    if (lang != types.LangCode.NONE) {
        return tI.text.get(getTextKey(field, lang));
    } else if (field == 0) {
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

inline fn parseString(ctx: *db.DbCtx, data: []u8, out: []u8) [*]u8 {
    if (data.len <= 6) {
        return out.ptr;
    } else if (data.len < SIZE + 6) {
        var i: usize = 2;
        while (i < data.len - 4) : (i += 1) {
            out[i - 2] = data[i];
        }
        return out.ptr;
    } else if (data[1] == @intFromEnum(types.Compression.none)) {
        const slice = data[2 .. SIZE + 2];
        return slice.ptr;
    } else {
        const res = decompressFirstBytes(ctx, data, out) catch out;
        return res.ptr;
    }
}

inline fn parseAlias(
    data: []u8,
) [*]u8 {
    if (data.len < SIZE + 2) {
        var arr: [SIZE]u8 = [_]u8{0} ** SIZE;
        var i: usize = 0;
        while (i < data.len) : (i += 1) {
            arr[i] = data[i];
        }
        return &arr;
    } else {
        return data.ptr;
    }
    return EMPTY_CHAR_SLICE.ptr;
}

inline fn removeFromIntIndex(T: type, data: []u8, sortIndex: *SortIndexMeta, node: db.Node) void {
    selva.selva_sort_remove_i64(sortIndex.index, @intCast(read(T, data, sortIndex.start)), node);
}

pub fn remove(
    ctx: *db.DbCtx,
    sortIndex: *SortIndexMeta,
    data: []u8,
    node: db.Node,
) void {
    const prop = sortIndex.prop;
    const start = sortIndex.start;
    const index = sortIndex.index;
    return switch (prop) {
        types.Prop.ENUM, types.Prop.UINT8, types.Prop.INT8, types.Prop.BOOLEAN => {
            selva.selva_sort_remove_i64(index, data[start], node);
        },
        types.Prop.ALIAS => {
            selva.selva_sort_remove_buf(index, parseAlias(data), SIZE, node);
        },
        types.Prop.STRING, types.Prop.TEXT, types.Prop.BINARY => {
            if (sortIndex.len > 0) {
                selva.selva_sort_remove_buf(
                    index,
                    data[start + 1 .. start + 1 + sortIndex.len].ptr,
                    sortIndex.len - 1,
                    node,
                );
            } else {
                var buf: [SIZE]u8 = [_]u8{0} ** SIZE;
                selva.selva_sort_remove_buf(index, parseString(ctx, data, &buf), SIZE, node);
            }
        },
        types.Prop.NUMBER, types.Prop.TIMESTAMP => {
            selva.selva_sort_remove_double(index, @floatFromInt(read(u64, data, start)), node);
        },
        types.Prop.CARDINALITY => {
            if (data.len > 0) {
                removeFromIntIndex(u32, data, sortIndex, node);
            } else {
                removeFromIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, node);
            }
        },
        types.Prop.INT32 => removeFromIntIndex(i32, data, sortIndex, node),
        types.Prop.INT16 => removeFromIntIndex(i16, data, sortIndex, node),
        types.Prop.UINT32 => removeFromIntIndex(u32, data, sortIndex, node),
        types.Prop.UINT16 => removeFromIntIndex(u16, data, sortIndex, node),
        else => {},
    };
}

inline fn insertIntIndex(T: type, data: []u8, sortIndex: *SortIndexMeta, node: db.Node) void {
    selva.selva_sort_insert_i64(sortIndex.index, @intCast(read(T, data, sortIndex.start)), node);
}

pub fn insert(
    ctx: *db.DbCtx,
    sortIndex: *SortIndexMeta,
    data: []u8,
    node: db.Node,
) void {
    const prop = sortIndex.prop;
    const start = sortIndex.start;
    const index = sortIndex.index;
    return switch (prop) {
        types.Prop.ENUM, types.Prop.UINT8, types.Prop.INT8, types.Prop.BOOLEAN => {
            selva.selva_sort_insert_i64(index, data[start], node);
        },
        types.Prop.ALIAS => {
            selva.selva_sort_insert_buf(index, parseAlias(data), SIZE, node);
        },
        types.Prop.STRING, types.Prop.TEXT, types.Prop.BINARY => {
            if (sortIndex.len > 0) {
                selva.selva_sort_insert_buf(
                    index,
                    data[start + 1 .. start + sortIndex.len].ptr,
                    sortIndex.len - 1,
                    node,
                );
            } else {
                var buf: [SIZE]u8 = [_]u8{0} ** SIZE;
                const str = parseString(ctx, data, &buf);
                selva.selva_sort_insert_buf(index, str, SIZE, node);
            }
        },
        types.Prop.NUMBER, types.Prop.TIMESTAMP => {
            selva.selva_sort_insert_double(index, @floatFromInt(read(u64, data, start)), node);
        },
        types.Prop.CARDINALITY => {
            if (data.len > 0) {
                insertIntIndex(u32, data, sortIndex, node);
            } else {
                insertIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, node);
            }
        },
        types.Prop.INT32 => insertIntIndex(i32, data, sortIndex, node),
        types.Prop.INT16 => insertIntIndex(i16, data, sortIndex, node),
        types.Prop.UINT32 => insertIntIndex(u32, data, sortIndex, node),
        types.Prop.UINT16 => insertIntIndex(u16, data, sortIndex, node),
        else => {},
    };
}
