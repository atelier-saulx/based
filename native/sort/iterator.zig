const SortIndexMeta = @import("common.zig").SortIndexMeta;
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
const utils = @import("../utils.zig");

fn SortIterator(
    comptime desc: bool,
    comptime edge: bool,
) type {
    if (edge) {
        return struct {
            index: *SortIndexMeta,
            it: selva.SelvaSortIterator,

            pub fn deinit(self: *SortIterator(desc, true)) void {
                selva.selva_sort_destroy(self.index.index);
            }

            pub fn next(self: *SortIterator(desc, true)) ?Node.Node {
                // not supert big fan of this
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
                    if (selva.selva_sort_foreach_reverse(self.index.index, &self.it)) |i| {
                        return @ptrCast(@alignCast(i));
                    }
                } else {
                    if (selva.selva_sort_foreach(self.index.index, &self.it)) |i| {
                        return @ptrCast(@alignCast(i));
                    }
                }
                return null;
            }
        };
    } else {
        return struct {
            index: *SortIndexMeta,
            it: selva.SelvaSortIterator,

            pub fn deinit(self: *SortIterator(desc, false)) void {
                // std.debug.print("{any} \n", .{self});
                selva.selva_sort_destroy(self.index.index);
            }

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
    if (isLocked) {
        dbCtx.threads.mutex.unlock();
    }

    if (isEdge) {
        if (header.edgeType != 0) {
            const edgeType = try Node.getType(dbCtx, header.edgeType);
            const fieldSchema = try Schema.getFieldSchema(edgeType, header.prop);
            while (it.*.nextRef()) |ref| {
                const data = if (header.propType == t.PropType.text)
                    Fields.getText(typeEntry, ref.edge, fieldSchema, header.propType, header.lang)
                else
                    Fields.get(typeEntry, ref.edge, fieldSchema, header.propType);
                Sort.insert(decompressor, sortIndex, data, &ref);
            }
        } else {
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
            while (it.*.nextRef()) |ref| {
                const data = if (header.propType == t.PropType.text)
                    Fields.getText(typeEntry, ref.node, fieldSchema, header.propType, header.lang)
                else
                    Fields.get(typeEntry, ref.node, fieldSchema, header.propType);
                Sort.insert(decompressor, sortIndex, data, &ref);
            }
        }
    } else {
        const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
        while (it.*.next()) |node| {
            const data = if (header.propType == t.PropType.text)
                Fields.getText(typeEntry, node, fieldSchema, header.propType, header.lang)
            else
                Fields.get(typeEntry, node, fieldSchema, header.propType);
            Sort.insert(decompressor, sortIndex, data, node);
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
    var sortIndex = try Sort.createSortIndexMeta(header, isEdge);
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
    if (Sort.getSortIndex(
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
        sortIndex = try Sort.getOrCreateFromCtx(dbCtx, typeId, header);
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
