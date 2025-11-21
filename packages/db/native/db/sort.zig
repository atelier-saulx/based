const db = @import("./db.zig");
const deflate = @import("../deflate.zig");
const selva = @import("../selva.zig").c;
const std = @import("std");
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
    isCreated: bool,
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

// check if sort index && sort index is DONE = true

// - lock when creratecreater container, cpntainer has NOT DONE as bool
// - unlock
// make index
// - lock
// DONE = true
// - fire condition sort index made
// - unlock

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
        .isCreated = false,
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

// allways without these 2 options
// true,
// false,
pub fn createSortIndex(
    dbCtx: *db.DbCtx,
    decompressor: *deflate.Decompressor,
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

    // fill sort index needs to a special field
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
            node.?,
            fieldSchema,
            prop,
            lang,
        ) else db.getField(
            typeEntry,
            node.?,
            fieldSchema,
            prop,
        );
        insert(decompressor, sortIndex, data, node.?);
    }
    if (defrag) {
        _ = selva.selva_sort_defrag(sortIndex.index);
    }
    // This is wrong ofcourse
    sortIndex.isCreated = true;
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

inline fn parseString(decompressor: *deflate.Decompressor, data: []u8, out: []u8) [*]u8 {
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
        const res = deflate.decompressFirstBytes(decompressor, data, out) catch out;
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
    decompressor: *deflate.Decompressor,
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
                selva.selva_sort_remove_buf(index, parseString(decompressor, data, &buf), SIZE, node);
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
    decompressor: *deflate.Decompressor,
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
                const str = parseString(decompressor, data, &buf);
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

pub fn getSortIndexFromBuffer(
    ctx: *db.DbCtx,
    typeId: db.TypeId,
    sortBuffer: []u8,
) ?*SortIndexMeta {
    const field = sortBuffer[0];
    const lang: types.LangCode = @enumFromInt(sortBuffer[6]);
    const start = read(u16, sortBuffer, 2);
    return getSortIndex(ctx.sortIndexes.get(typeId), field, start, lang);
}

pub fn createSortIndexFromBuffer(
    ctx: *db.DbCtx,
    decompressor: *deflate.Decompressor,
    typeId: db.TypeId,
    sortBuffer: []u8,
) !*SortIndexMeta {
    const field = sortBuffer[0];
    const sortProp: types.Prop = @enumFromInt(sortBuffer[1]);
    const lang: types.LangCode = @enumFromInt(sortBuffer[6]);
    const start = read(u16, sortBuffer, 2);
    const len = read(u16, sortBuffer, 4);
    return createSortIndex(
        ctx,
        decompressor,
        typeId,
        field,
        start,
        len,
        sortProp,
        lang,
        true,
        false,
        // dont finish
    );
}
