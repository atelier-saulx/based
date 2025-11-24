const Modify = @import("./common.zig");
const db = @import("../db/db.zig");
const Node = @import("../db/node.zig");
const sort = @import("../db/sort.zig");
const std = @import("std");
const utils = @import("../utils.zig");
const references = @import("./references.zig");
const subs = @import("./subscription.zig");
const t = @import("../types.zig");

const ModifyCtx = Modify.ModifyCtx;

pub fn deleteFieldSortIndex(ctx: *ModifyCtx) !usize {
    if (ctx.node == null) {
        return 0;
    }
    if (ctx.typeSortIndex == null) {
        return 0;
    }
    if (ctx.field == 0) {
        var currentData: ?[]u8 = null;
        var it = ctx.typeSortIndex.?.main.iterator();
        while (it.next()) |entry| {
            if (currentData == null) {
                currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
            }
            sort.remove(ctx.threadCtx.decompressor, entry.value_ptr.*, currentData.?, ctx.node.?);
        }
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
        sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, currentData, ctx.node.?);
    } else if (ctx.fieldType == t.PropType.text) {
        var it = ctx.typeSortIndex.?.text.iterator();
        while (it.next()) |entry| {
            const sortIndex = entry.value_ptr.*;
            if (sortIndex.field == ctx.field) {
                const textValue = db.getText(
                    ctx.typeEntry,
                    ctx.node.?,
                    ctx.fieldSchema.?,
                    ctx.fieldType,
                    sortIndex.langCode,
                );
                sort.remove(ctx.threadCtx.decompressor, sortIndex, textValue, ctx.node.?);
            }
        }
    }
    return 0;
}

pub fn deleteField(ctx: *ModifyCtx) !usize {
    if (ctx.node == null) {
        return 0;
    }

    subs.stage(ctx, subs.Op.deleteField);

    if (ctx.typeSortIndex != null) {
        if (ctx.currentSortIndex != null) {
            const currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
            sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, currentData, ctx.node.?);
            sort.insert(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, sort.EMPTY_SLICE, ctx.node.?);
        } else if (ctx.fieldType == t.PropType.text) {
            var it = ctx.typeSortIndex.?.text.iterator();
            while (it.next()) |entry| {
                const sortIndex = entry.value_ptr.*;
                if (sortIndex.field == ctx.field) {
                    const textValue = db.getText(
                        ctx.typeEntry,
                        ctx.node.?,
                        ctx.fieldSchema.?,
                        ctx.fieldType,
                        sortIndex.langCode,
                    );
                    sort.remove(ctx.threadCtx.decompressor, sortIndex, textValue, ctx.node.?);
                    sort.insert(ctx.threadCtx.decompressor, sortIndex, sort.EMPTY_SLICE, ctx.node.?);
                }
            }
        }
    }
    if (ctx.fieldType == t.PropType.alias) {
        db.delAlias(ctx.typeEntry.?, ctx.id, ctx.field) catch |e| {
            if (e != error.SELVA_ENOENT) return e;
        };
    } else {
        if (ctx.fieldType == t.PropType.reference) {
            const fs = ctx.fieldSchema.?;
            const dstType = try db.getRefDstType(ctx.db, fs);
            const oldRefDst = Node.getNodeFromReference(dstType, db.getSingleReference(ctx.node.?, fs));
            if (oldRefDst) |dstNode| {
                Modify.markDirtyRange(ctx, Node.getNodeTypeId(dstNode), Node.getNodeId(dstNode));
            }
        }
        try db.deleteField(ctx, ctx.node.?, ctx.fieldSchema.?);
    }
    return 0;
}

pub fn deleteTextLang(ctx: *ModifyCtx, lang: t.LangCode) void {
    const textValue = db.getText(
        ctx.typeEntry,
        ctx.node.?,
        ctx.fieldSchema.?,
        ctx.fieldType,
        lang,
    );
    // If !empty
    if (textValue.len >= 6) {
        subs.stage(ctx, subs.Op.deleteFieldLang);
        const sortIndex = sort.getSortIndex(ctx.db.sortIndexes.get(ctx.typeId), ctx.field, 0, lang);
        if (sortIndex) |sI| {
            sort.remove(ctx.threadCtx.decompressor, sI, textValue, ctx.node.?);
            sort.insert(ctx.threadCtx.decompressor, sI, sort.EMPTY_SLICE, ctx.node.?);
        }
        db.deleteTextFieldTranslation(ctx, ctx.fieldSchema.?, lang) catch |e| {
            std.log.debug("Failed to delete a translation ({any}:{any}.{any}.{any}): {any}", .{ ctx.typeId, ctx.id, ctx.field, lang, e });
        };
    }
}
