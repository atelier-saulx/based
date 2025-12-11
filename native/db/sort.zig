const deflate = @import("../deflate.zig");
const selva = @import("../selva/selva.zig").c;
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
const std = @import("std");
const utils = @import("../utils.zig");
const t = @import("../types.zig");
const errors = @import("../errors.zig");
const read = utils.read;
const DbCtx = @import("ctx.zig").DbCtx;
const Thread = @import("../thread/thread.zig");
const References = @import("../selva/references.zig");

pub const SortIndexMeta = struct {
    prop: t.PropType,
    start: u16,
    len: u16, // len can be added somewhere else
    index: *selva.SelvaSortCtx,
    langCode: t.LangCode,
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

pub const TypeSortIndexes = std.AutoHashMap(u16, *TypeIndex);

inline fn getTextKey(
    field: u8,
    lang: t.LangCode,
) u16 {
    return @as(u16, @bitCast([_]u8{ field, @intFromEnum(lang) }));
}

fn getSortFlag(sortFieldType: t.PropType) !selva.SelvaSortOrder {
    switch (sortFieldType) {
        t.PropType.int8,
        t.PropType.uint8,
        t.PropType.int16,
        t.PropType.uint16,
        t.PropType.int32,
        t.PropType.uint32,
        t.PropType.boolean,
        t.PropType.@"enum",
        t.PropType.cardinality,
        => {
            return selva.SELVA_SORT_ORDER_I64_ASC;
        },
        t.PropType.number, t.PropType.timestamp => {
            return selva.SELVA_SORT_ORDER_DOUBLE_ASC;
        },
        t.PropType.string, t.PropType.text, t.PropType.alias, t.PropType.binary => {
            return selva.SELVA_SORT_ORDER_BUFFER_ASC;
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }
}

pub fn createSortIndexMeta(
    header: *const t.SortHeader,
) !SortIndexMeta {
    const sortFlag = try getSortFlag(header.propType);
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init2(sortFlag, 0).?;
    const s: SortIndexMeta = .{
        .len = header.len,
        .start = header.start,
        .index = sortCtx,
        .prop = header.propType,
        .langCode = header.lang,
        .field = header.prop,
        .isCreated = false,
    };
    return s;
}

fn getOrCreateFromCtx(
    dbCtx: *DbCtx,
    typeId: t.TypeId,
    sortHeader: *const t.SortHeader,
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
    sortIndex = getSortIndex(typeIndexes, sortHeader.prop, sortHeader.start, sortHeader.lang);
    if (sortIndex == null) {
        sortIndex = try dbCtx.allocator.create(SortIndexMeta);
        sortIndex.?.* = try createSortIndexMeta(sortHeader);
        if (sortHeader.prop == 0) {
            try tI.main.put(sortHeader.start, sortIndex.?);
        } else if (sortHeader.propType == t.PropType.text) {
            try tI.text.put(getTextKey(sortHeader.prop, sortHeader.lang), sortIndex.?);
        } else {
            try tI.field.put(sortHeader.prop, sortIndex.?);
        }
    }
    return sortIndex.?;
}

pub fn destroySortIndex(
    dbCtx: *DbCtx,
    typeId: t.TypeId,
    field: u8,
    start: u16,
    lang: t.LangCode,
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
    lang: t.LangCode,
) ?*SortIndexMeta {
    if (typeSortIndexes == null) {
        return null;
    }
    const tI = typeSortIndexes.?;
    if (lang != t.LangCode.none) {
        return tI.text.get(getTextKey(field, lang));
    } else if (field == 0) {
        return tI.main.get(start);
    } else {
        return tI.field.get(field);
    }
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
        t.PropType.@"enum", t.PropType.uint8, t.PropType.int8, t.PropType.boolean => {
            selva.selva_sort_remove_i64(index, data[start], node);
        },
        t.PropType.alias => {
            selva.selva_sort_remove_buf(index, parseAlias(data), SIZE, node);
        },
        t.PropType.string, t.PropType.text, t.PropType.binary => {
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
        t.PropType.number, t.PropType.timestamp => {
            selva.selva_sort_remove_double(index, @floatFromInt(read(u64, data, start)), node);
        },
        t.PropType.cardinality => {
            if (data.len > 0) {
                removeFromIntIndex(u32, data, sortIndex, node);
            } else {
                removeFromIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, node);
            }
        },
        t.PropType.int32 => removeFromIntIndex(i32, data, sortIndex, node),
        t.PropType.int16 => removeFromIntIndex(i16, data, sortIndex, node),
        t.PropType.uint32 => removeFromIntIndex(u32, data, sortIndex, node),
        t.PropType.uint16 => removeFromIntIndex(u16, data, sortIndex, node),
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
    value: anytype, // should support getting edge
) void {
    const prop = sortIndex.prop;
    const start = sortIndex.start;
    const index = sortIndex.index;
    return switch (prop) {
        t.PropType.@"enum", t.PropType.uint8, t.PropType.int8, t.PropType.boolean => {
            selva.selva_sort_insert_i64(index, data[start], value);
        },
        t.PropType.alias => {
            selva.selva_sort_insert_buf(index, parseAlias(data), SIZE, value);
        },
        t.PropType.string, t.PropType.text, t.PropType.binary => {
            if (sortIndex.len > 0) {
                selva.selva_sort_insert_buf(
                    index,
                    data[start + 1 .. start + sortIndex.len].ptr,
                    sortIndex.len - 1,
                    value,
                );
            } else {
                var buf: [SIZE]u8 = [_]u8{0} ** SIZE;
                const str = parseString(decompressor, data, &buf);
                selva.selva_sort_insert_buf(index, str, SIZE, value);
            }
        },
        t.PropType.number, t.PropType.timestamp => {
            selva.selva_sort_insert_double(index, @floatFromInt(read(u64, data, start)), value);
        },
        t.PropType.cardinality => {
            if (data.len > 0) {
                insertIntIndex(u32, data, sortIndex, value);
            } else {
                insertIntIndex(u32, EMPTY_CHAR_SLICE, sortIndex, value);
            }
        },
        t.PropType.int32 => insertIntIndex(i32, data, sortIndex, value),
        t.PropType.int16 => insertIntIndex(i16, data, sortIndex, value),
        t.PropType.uint32 => insertIntIndex(u32, data, sortIndex, value),
        t.PropType.uint16 => insertIntIndex(u16, data, sortIndex, value),
        else => {},
    };
}

fn SortIterator(
    comptime desc: bool,
    comptime edge: bool,
) type {
    if (edge) {
        return struct {
            index: *SortIndexMeta,
            it: selva.SelvaSortIterator,
            pub fn next(self: *SortIterator(desc, true)) ?Node.Node {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    if (selva.selva_sort_foreach_reverse(self.index.index, &self.it)) |i| {
                        return @as(References.ReferencesIteratorEdgesResult, @ptrCast(@alignCast(i))).node;
                    }
                } else {
                    if (selva.selva_sort_foreach(self.index.index, &self.it)) |i| {
                        return @as(References.ReferencesIteratorEdgesResult, @ptrCast(@alignCast(i))).node;
                    }
                }
                return null;
            }
            pub fn nextRef(self: *SortIterator(desc, true)) ?*References.ReferencesIteratorEdgesResult {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    return @ptrCast(@alignCast(selva.selva_sort_foreach_reverse(self.index.index, &self.it)));
                } else {
                    return @ptrCast(@alignCast(selva.selva_sort_foreach(self.index.index, &self.it)));
                }
            }
        };
    } else {
        return struct {
            index: *SortIndexMeta,
            it: selva.SelvaSortIterator,
            pub fn next(self: *SortIterator(desc, false)) ?Node.Node {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    return @ptrCast(selva.selva_sort_foreach_reverse(self.index.index, &self.it));
                } else {
                    return @ptrCast(@alignCast(selva.selva_sort_foreach(self.index.index, &self.it)));
                }
            }
        };
    }
}

inline fn createIterator(
    comptime desc: bool,
    comptime isEdge: bool,
    sortIndex: *SortIndexMeta,
) SortIterator(desc, isEdge) {
    var it: selva.SelvaSortIterator = undefined;
    if (desc) {
        selva.selva_sort_foreach_begin_reverse(sortIndex.index, &it);
    } else {
        selva.selva_sort_foreach_begin(sortIndex.index, &it);
    }
    return SortIterator(desc, isEdge){
        .it = it,
        .index = sortIndex,
    };
}

fn fillSortIndex(
    sortIndex: *SortIndexMeta,
    dbCtx: *DbCtx,
    decompressor: *deflate.Decompressor,
    header: *const t.SortHeader,
    typeEntry: Node.Type,
    it: anytype,
    comptime defrag: bool,
    comptime isLocked: bool,
    comptime isEdge: bool,
) !void {
    const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
    if (isLocked) {
        dbCtx.threads.mutex.unlock();
    }
    if (isEdge) {
        while (it.*.nextRef()) |ref| {
            const node = ref.node;
            const data = if (header.propType == t.PropType.text)
                Fields.getText(typeEntry, node, fieldSchema, header.propType, header.lang)
            else
                Fields.get(typeEntry, node, fieldSchema, header.propType);
            // TODO: this ref needs to be allocated...
            insert(decompressor, sortIndex, data, &ref);
        }
    } else {
        while (it.*.next()) |node| {
            const data = if (header.propType == t.PropType.text)
                Fields.getText(typeEntry, node, fieldSchema, header.propType, header.lang)
            else
                Fields.get(typeEntry, node, fieldSchema, header.propType);
            insert(decompressor, sortIndex, data, node);
        }
    }
    if (defrag) {
        _ = selva.selva_sort_defrag(sortIndex.index);
    }
    if (isLocked) {
        dbCtx.threads.mutex.lock();
    }
    sortIndex.isCreated = true;
}

pub fn fromIterator(
    comptime desc: bool,
    comptime isEdge: bool,
    dbCtx: *DbCtx,
    thread: *Thread.Thread,
    typeEntry: Node.Type,
    header: *const t.SortHeader,
    it: anytype,
) !SortIterator(desc, isEdge) {
    var sortIndex = try createSortIndexMeta(header);
    try fillSortIndex(
        &sortIndex,
        dbCtx,
        thread.decompressor,
        header,
        typeEntry,
        &it,
        false,
        false,
        isEdge,
    );
    return createIterator(desc, isEdge, &sortIndex);
}

pub fn iterator(
    comptime desc: bool,
    dbCtx: *DbCtx,
    thread: *Thread.Thread,
    typeId: t.TypeId,
    header: *const t.SortHeader,
) !SortIterator(desc, false) {
    var sortIndex: *SortIndexMeta = undefined;
    dbCtx.threads.mutex.lock();
    if (getSortIndex(
        dbCtx.sortIndexes.get(typeId),
        header.prop,
        header.start,
        header.lang,
    )) |sortMetaIndex| {
        if (sortMetaIndex.isCreated == false) {
            dbCtx.threads.sortDone.wait(&dbCtx.threads.mutex);
        }
        sortIndex = sortMetaIndex;
        dbCtx.threads.mutex.unlock();
    } else {
        const typeEntry = try Node.getType(dbCtx, typeId);
        var it = Node.iterator(false, typeEntry);
        sortIndex = try getOrCreateFromCtx(dbCtx, typeId, header);
        try fillSortIndex(
            sortIndex,
            dbCtx,
            thread.decompressor,
            header,
            typeEntry,
            &it,
            true,
            true,
            false,
        );
        dbCtx.threads.sortDone.broadcast();
        dbCtx.threads.mutex.unlock();
    }
    return createIterator(desc, false, sortIndex);
}
