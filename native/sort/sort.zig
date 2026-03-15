const deflate = @import("../deflate.zig");
const jemalloc = @import("../jemalloc.zig");
const selva = @import("../selva/selva.zig").c;
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const std = @import("std");
const utils = @import("../utils.zig");
const t = @import("../types.zig");
const errors = @import("../errors.zig");
const read = utils.read;
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Iterator = @import("iterator.zig");
const Decay = @import("decay.zig");
pub const SortIndexMeta = @import("common.zig").SortIndexMeta;
const SortUseCounter = @import("common.zig").SortUseCounter;

pub const iterator = Iterator.iterator;
pub const fromIterator = Iterator.fromIterator;
pub const SortIterator = Iterator.SortIterator;

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
    lang: t.LangCode,
) u16 {
    return @as(u16, @bitCast([_]u8{ field, @intFromEnum(lang) }));
}

fn getSortFlag(sortFieldType: t.PropType) !selva.SelvaSortOrder {
    switch (sortFieldType) {
        .int8,
        .uint8,
        .int16,
        .uint16,
        .int32,
        .uint32,
        .boolean,
        .@"enum",
        .cardinality,
        => {
            return selva.SELVA_SORT_ORDER_I64_ASC;
        },
        .number, .timestamp => {
            return selva.SELVA_SORT_ORDER_DOUBLE_ASC;
        },
        .stringFixed, .binaryFixed, .jsonFixed, .jsonLocalized, .json, .string, .stringLocalized, .alias, .binary => {
            return selva.SELVA_SORT_ORDER_BUFFER_ASC;
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }
}

pub fn deinit(sortIndexes: *TypeSortIndexes) void {
    var it = sortIndexes.iterator();
    while (it.next()) |index| {
        const typeIndex = index.value_ptr.*;

        var textIt = typeIndex.text.iterator();
        while (textIt.next()) |kv| {
            const sortIndex = kv.value_ptr.*;
            selva.selva_sort_destroy(sortIndex.index);
            jemalloc.free(sortIndex);
        }

        var fieldIt = typeIndex.field.iterator();
        while (fieldIt.next()) |kv| {
            const sortIndex = kv.value_ptr.*;
            selva.selva_sort_destroy(sortIndex.index);
            jemalloc.free(sortIndex);
        }

        var mainIt = typeIndex.main.iterator();
        while (mainIt.next()) |kv| {
            const sortIndex = kv.value_ptr.*;
            selva.selva_sort_destroy(sortIndex.index);
            jemalloc.free(sortIndex);
        }

        jemalloc.free(typeIndex);
    }

    sortIndexes.deinit();
}

fn createSortIndexMeta(
    header: *const t.SortHeader,
    size: usize,
    comptime isEdge: bool,
) !*SortIndexMeta {
    const s = jemalloc.create(SortIndexMeta);
    const sortFlag = try getSortFlag(header.propType);
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init3(sortFlag, size, if (isEdge)
        @sizeOf(References.ReferencesIteratorEdgesResult)
    else
        0).?;

    s.* = .{
        .len = header.len,
        .start = header.start,
        .index = sortCtx,
        .prop = header.propType,
        .langCode = header.lang,
        .field = header.prop,
        .isCreated = false,
        .decay = Decay.init(),
    };

    return s;
}

pub fn getOrCreateFromCtx(
    dbCtx: *DbCtx,
    typeId: t.TypeId,
    sortHeader: *const t.SortHeader,
) !*SortIndexMeta {
    var typeIndexes: ?*TypeIndex = dbCtx.sortIndexes.get(typeId);
    if (typeIndexes == null) {
        typeIndexes = jemalloc.create(TypeIndex);
        typeIndexes.?.* = .{
            .field = FieldSortIndexes.init(dbCtx.allocator),
            .main = MainSortIndexes.init(dbCtx.allocator),
            .text = TextSortIndexes.init(dbCtx.allocator),
        };
        try dbCtx.sortIndexes.put(typeId, typeIndexes.?);
    }
    const tI: *TypeIndex = typeIndexes.?;
    if (getSortIndex(typeIndexes, sortHeader.prop, sortHeader.start, sortHeader.lang)) |sortIndex| {
        return sortIndex;
    } else {
        const sortIndex = try createSortIndexMeta(sortHeader, 0, false);
        if (sortHeader.prop == 0) {
            try tI.main.put(sortHeader.start, sortIndex);
        } else if (sortHeader.propType == t.PropType.stringLocalized) {
            try tI.text.put(getTextKey(sortHeader.prop, sortHeader.lang), sortIndex);
        } else {
            try tI.field.put(sortHeader.prop, sortIndex);
        }

        return sortIndex;
    }
}

pub fn destroySortIndex(
    dbCtx: *DbCtx,
    typeId: t.TypeId,
    field: u8,
    start: u16,
    lang: t.LangCode,
) void {
    if (dbCtx.sortIndexes.get(typeId)) |typeIndexes| {
        if (getSortIndex(typeIndexes, field, start, lang)) |index| {
            if (field == 0) {
                _ = typeIndexes.main.remove(start);
            } else {
                _ = typeIndexes.field.remove(field);
            }
            selva.selva_sort_destroy(index.index);
            jemalloc.free(index);
        }
    }
}

pub fn getSortIndex(
    typeSortIndexes: ?*TypeIndex,
    field: u8,
    start: u16,
    lang: t.LangCode,
) ?*SortIndexMeta {
    var sortIndex: ?*SortIndexMeta = undefined;
    if (typeSortIndexes == null) {
        return null;
    }
    const tI = typeSortIndexes.?;
    if (lang != t.LangCode.none) {
        sortIndex = tI.text.get(getTextKey(field, lang));
    } else if (field == 0) {
        sortIndex = tI.main.get(start);
    } else {
        sortIndex = tI.field.get(field);
    }

    if (sortIndex) |index| {
        _ = index.decay.useCounter.fetchAdd(1, std.builtin.AtomicOrder.monotonic);
    }

    return sortIndex;
}

pub fn getTypeSortIndexes(
    dbCtx: *DbCtx,
    typeId: t.TypeId,
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
    } else if (data[1] == @intFromEnum(t.Compression.none)) {
        const slice = data[2 .. SIZE + 2];
        return slice.ptr;
    } else {
        const res = deflate.decompressFirstBytes(decompressor, data, out) catch out;
        return res.ptr;
    }
}

inline fn parseSimpleString(
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

inline fn removeFromIntIndex(T: type, data: []u8, sortIndex: *SortIndexMeta, node: Node.Node) void {
    selva.selva_sort_remove_i64(sortIndex.index, @intCast(read(T, data, sortIndex.start)), node);
}

pub fn remove(
    decompressor: *deflate.Decompressor,
    sortIndex: *SortIndexMeta,
    data: []u8,
    node: Node.Node,
) void {
    const prop = sortIndex.prop;
    const start = sortIndex.start;
    const index = sortIndex.index;
    return switch (prop) {
        .@"enum", .uint8, .int8, .boolean => {
            selva.selva_sort_remove_i64(index, data[start], node);
        },
        .alias => {
            selva.selva_sort_remove_buf(index, parseSimpleString(data), SIZE, node);
        },
        .stringFixed, .binaryFixed => {
            const size = data[start];
            selva.selva_sort_remove_buf(index, parseSimpleString(data[start + 1 .. start + 1 + size]), size, node);
        },
        .string, .stringLocalized, .json, .jsonLocalized, .binary => {
            var buf: [SIZE]u8 = [_]u8{0} ** SIZE;
            selva.selva_sort_remove_buf(index, parseString(decompressor, data, &buf), SIZE, node);
        },
        .number, .timestamp => {
            selva.selva_sort_remove_double(index, @floatFromInt(read(u64, data, start)), node);
        },
        .cardinality => {
            if (data.len > 0) {
                removeFromIntIndex(u32, data, sortIndex, node);
            } else {
                removeFromIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, node);
            }
        },
        .int32 => removeFromIntIndex(i32, data, sortIndex, node),
        .uint32 => removeFromIntIndex(u32, data, sortIndex, node),
        .int16 => removeFromIntIndex(i16, data, sortIndex, node),
        .uint16 => removeFromIntIndex(u16, data, sortIndex, node),
        else => {},
    };
}

inline fn insertIntIndex(T: type, data: []u8, sortIndex: *SortIndexMeta, value: anytype) void {
    selva.selva_sort_insert_i64(sortIndex.index, @intCast(read(T, data, sortIndex.start)), value);
}

pub fn insert(
    decompressor: *deflate.Decompressor,
    sortIndex: *SortIndexMeta,
    data: []u8,
    value: anytype,
) void {
    const prop = sortIndex.prop;
    const start = sortIndex.start;
    const index = sortIndex.index;

    return switch (prop) {
        .@"enum", .uint8, .int8, .boolean => {
            selva.selva_sort_insert_i64(index, data[start], value);
        },
        .alias => {
            selva.selva_sort_insert_buf(index, parseSimpleString(data), SIZE, value);
        },
        .stringFixed, .binaryFixed => {
            const size = data[start];
            selva.selva_sort_insert_buf(index, parseSimpleString(data[start + 1 .. start + 1 + size]), size, value);
        },
        .string, .stringLocalized, .json, .jsonLocalized, .binary => {
            var buf: [SIZE]u8 = [_]u8{0} ** SIZE;
            const str = parseString(decompressor, data, &buf);
            selva.selva_sort_insert_buf(index, str, SIZE, value);
        },
        .number, .timestamp => {
            selva.selva_sort_insert_double(index, @floatFromInt(read(u64, data, start)), value);
        },
        .cardinality => {
            if (data.len > 0) {
                insertIntIndex(u32, data, sortIndex, value);
            } else {
                insertIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, value);
            }
        },
        .int32 => insertIntIndex(i32, data, sortIndex, value),
        .uint32, .id => insertIntIndex(u32, data, sortIndex, value),
        .int16 => insertIntIndex(i16, data, sortIndex, value),
        .uint16 => insertIntIndex(u16, data, sortIndex, value),
        else => {},
    };
}
