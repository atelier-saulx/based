const SortIndexMeta = @import("common.zig").SortIndexMeta;
const SortUseCounter = @import("common.zig").SortUseCounter;
const t = @import("../types.zig");
const selva = @import("../selva/selva.zig").c;
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const deflate = @import("../deflate.zig");
const Schema = @import("../selva/schema.zig");
const Fields = @import("../selva/fields.zig");
const Thread = @import("../thread/thread.zig");
const Sort = @import("sort.zig");
const std = @import("std");
const jemalloc = @import("../jemalloc.zig");
const utils = @import("../utils.zig");
const errors = @import("../errors.zig");
const Decay = @import("decay.zig");
const Filter = @import("../query/filter/filter.zig");
const Query = @import("../query/common.zig");

pub fn SortIterator(
    comptime desc: bool,
    comptime edge: bool,
) type {
    if (edge) {
        return struct {
            index: ?*SortIndexMeta,
            it: selva.SelvaSortIterator,

            pub fn deinit(self: *SortIterator(desc, true)) void {
                selva.selva_sort_clear(self.index.?.index);
            }

            pub fn next(self: *SortIterator(desc, true)) ?Node.Node {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    if (selva.selva_sort_foreach_reverse(self.index.?.index, &self.it)) |i| {
                        return @as(*References.ReferencesIteratorEdgesResult, @ptrCast(@alignCast(i))).node;
                    }
                } else {
                    if (selva.selva_sort_foreach(self.index.?.index, &self.it)) |i| {
                        return @as(*References.ReferencesIteratorEdgesResult, @ptrCast(@alignCast(i))).node;
                    }
                }
                return null;
            }

            pub fn nextRef(self: *SortIterator(desc, true)) ?*References.ReferencesIteratorEdgesResult {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    if (selva.selva_sort_foreach_reverse(self.index.?.index, &self.it)) |i| {
                        return @ptrCast(@alignCast(i));
                    }
                } else {
                    if (selva.selva_sort_foreach(self.index.?.index, &self.it)) |i| {
                        return @ptrCast(@alignCast(i));
                    }
                }
                return null;
            }
        };
    } else {
        return struct {
            index: ?*SortIndexMeta,
            it: selva.SelvaSortIterator,

            pub fn deinit(self: *SortIterator(desc, false)) void {
                selva.selva_sort_clear(self.index.?.index);
            }

            pub fn next(self: *SortIterator(desc, false)) ?Node.Node {
                if (selva.selva_sort_foreach_done(&self.it)) {
                    return null;
                }
                if (desc) {
                    return @ptrCast(selva.selva_sort_foreach_reverse(self.index.?.index, &self.it));
                } else {
                    return @ptrCast(@alignCast(selva.selva_sort_foreach(self.index.?.index, &self.it)));
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
    ctx: *Query.QueryCtx,
    header: *const t.SortHeader,
    typeEntry: Node.Type,
    it: anytype,
    comptime defrag: bool,
    comptime isLocked: bool,
    comptime isEdge: bool,
    comptime filterType: t.FilterType,
    filter: if (filterType != .noFilter) []u8 else void,
) !void {
    if (isLocked) {
        ctx.db.threads.mutex.unlock();
    }
    if (isEdge) {
        if (header.edgeType != 0) {
            const edgeType = try Node.getType(ctx.db, header.edgeType);
            const fieldSchema = try Schema.getFieldSchema(edgeType, header.prop);
            while (it.nextRef()) |ref| {
                if (filterType == .mixed) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, ref.edge)) continue;
                } else if (filterType == .propOnly) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, undefined)) continue;
                } else if (filterType == .edgeOnly) {
                    if (!try Filter.filter(filterType, ref.edge, ctx, filter, undefined)) continue;
                }
                const data = switch (header.propType) {
                    .stringLocalized, .jsonLocalized => Fields.getText(edgeType, ref.edge, fieldSchema, header.propType, header.lang),
                    else => Fields.get(edgeType, ref.edge, fieldSchema, header.propType),
                };
                Sort.insert(ctx.thread.decompressor, sortIndex, data, &ref);
            }
        } else if (header.propType == .id) {
            while (it.nextRef()) |ref| {
                if (filterType == .mixed) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, ref.edge)) continue;
                } else if (filterType == .propOnly) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, undefined)) continue;
                } else if (filterType == .edgeOnly) {
                    if (!try Filter.filter(filterType, ref.edge, ctx, filter, undefined)) continue;
                }
                Sort.insert(
                    ctx.thread.decompressor,
                    sortIndex,
                    @constCast(std.mem.asBytes(&Node.getNodeId(ref.node))),
                    &ref,
                );
            }
        } else {
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
            while (it.nextRef()) |ref| {
                if (filterType == .mixed) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, ref.edge)) continue;
                } else if (filterType == .propOnly) {
                    if (!try Filter.filter(filterType, ref.node, ctx, filter, undefined)) continue;
                } else if (filterType == .edgeOnly) {
                    if (!try Filter.filter(filterType, ref.edge, ctx, filter, undefined)) continue;
                }
                const data = switch (header.propType) {
                    .stringLocalized, .jsonLocalized => Fields.getText(typeEntry, ref.node, fieldSchema, header.propType, header.lang),
                    else => Fields.get(typeEntry, ref.node, fieldSchema, header.propType),
                };
                Sort.insert(ctx.thread.decompressor, sortIndex, data, &ref);
            }
        }
    } else {
        if (header.propType == .id) {
            while (it.next()) |node| {
                if (filterType == .propOnly) {
                    if (!try Filter.filter(filterType, node, ctx, filter, undefined)) continue;
                }
                Sort.insert(
                    ctx.thread.decompressor,
                    sortIndex,
                    @constCast(std.mem.asBytes(&Node.getNodeId(node))),
                    node,
                );
            }
        } else {
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
            while (it.next()) |node| {
                if (filterType == .propOnly) {
                    if (!try Filter.filter(filterType, node, ctx, filter, undefined)) continue;
                }
                const data = switch (header.propType) {
                    .stringLocalized, .jsonLocalized => Fields.getText(typeEntry, node, fieldSchema, header.propType, header.lang),
                    else => Fields.get(typeEntry, node, fieldSchema, header.propType),
                };
                Sort.insert(ctx.thread.decompressor, sortIndex, data, node);
            }
        }
    }
    if (defrag) {
        _ = selva.selva_sort_defrag(sortIndex.index);
    }
    if (isLocked) {
        ctx.db.threads.mutex.lock();
    }
    sortIndex.isCreated = true;
}

fn getSortIndex(
    comptime isEdge: bool,
    thread: *Thread.Thread,
    sortFieldType: t.PropType,
) !*selva.SelvaSortCtx {
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
        .id,
        => {
            return if (isEdge) thread.tmpSortIntEdge else thread.tmpSortInt;
        },
        .number, .timestamp => {
            return if (isEdge) thread.tmpSortDoubleEdge else thread.tmpSortDouble;
        },
        .stringFixed, .binaryFixed, .jsonFixed, .string, .stringLocalized, .json, .jsonLocalized, .alias, .binary => {
            return if (isEdge) thread.tmpSortBinaryEdge else thread.tmpSortBinary;
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }
}

pub inline fn fromIterator(
    comptime desc: bool,
    comptime isEdge: bool,
    ctx: *Query.QueryCtx,
    typeEntry: Node.Type,
    header: *const t.SortHeader,
    it: anytype,
    comptime filterType: t.FilterType,
    filter: if (filterType != .noFilter) []u8 else void,
) !SortIterator(desc, isEdge) {
    var sortIndex: SortIndexMeta = .{
        .len = header.len,
        .start = header.start,
        .index = try getSortIndex(isEdge, ctx.thread, header.propType),
        .prop = header.propType,
        .langCode = header.lang,
        .field = header.prop,
        .isCreated = false,
        .decay = Decay.init(),
    };
    try fillSortIndex(
        &sortIndex,
        ctx,
        header,
        typeEntry,
        it,
        false,
        false,
        isEdge,
        filterType,
        filter,
    );
    return createIterator(desc, isEdge, &sortIndex);
}

pub fn iterator(
    comptime desc: bool,
    ctx: *Query.QueryCtx,
    typeId: t.TypeId,
    header: *const t.SortHeader,
) !SortIterator(desc, false) {
    var sortIndex: *SortIndexMeta = undefined;
    ctx.db.threads.mutex.lock();
    if (Sort.getSortIndex(
        ctx.db.sortIndexes.get(typeId),
        header.prop,
        header.start,
        header.lang,
    )) |sortMetaIndex| {
        if (sortMetaIndex.isCreated == false) {
            ctx.db.threads.sortDone.wait(&ctx.db.threads.mutex);
        }
        sortIndex = sortMetaIndex;
        ctx.db.threads.mutex.unlock();
    } else {
        const typeEntry = try Node.getType(ctx.db, typeId);
        var it = Node.iterator(false, typeEntry);
        sortIndex = try Sort.getOrCreateFromCtx(ctx.db, typeId, header);
        try fillSortIndex(
            sortIndex,
            ctx,
            header,
            typeEntry,
            &it,
            true,
            true,
            false,
            .noFilter,
            undefined,
        );
        ctx.db.threads.sortDone.broadcast();
        ctx.db.threads.mutex.unlock();
    }
    return createIterator(desc, false, sortIndex);
}
