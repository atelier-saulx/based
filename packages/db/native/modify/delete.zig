const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const std = @import("std");
const types = @import("../types.zig");
const ModifyCtx = Modify.ModifyCtx;
const selva = @import("../selva.zig");
const utils = @import("../utils.zig");
const references = @import("./references.zig");

// TODO: can optmize this greatly, espcialy text
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
                currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
            }
            sort.remove(ctx.db, entry.value_ptr.*, currentData.?, ctx.node.?);
        }
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
        sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
    } else if (ctx.fieldType == types.Prop.TEXT) {
        var it = ctx.typeSortIndex.?.text.iterator();
        while (it.next()) |entry| {
            const sortIndex = entry.value_ptr.*;
            if (sortIndex.field == ctx.field) {
                // Extra slow...
                const t = db.getText(
                    ctx.typeEntry,
                    ctx.id,
                    ctx.node.?,
                    ctx.fieldSchema.?,
                    ctx.fieldType,
                    sortIndex.langCode,
                );
                sort.remove(ctx.db, sortIndex, t, ctx.node.?);
            }
        }
    }
    return 0;
}

pub fn deleteField(ctx: *ModifyCtx) !usize {
    if (ctx.node == null) {
        return 0;
    }
    if (ctx.typeSortIndex != null) {
        if (ctx.currentSortIndex != null) {
            const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
            sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
            sort.insert(ctx.db, ctx.currentSortIndex.?, sort.EMPTY_SLICE, ctx.node.?);
        } else if (ctx.fieldType == types.Prop.TEXT) {
            var it = ctx.typeSortIndex.?.text.iterator();
            while (it.next()) |entry| {
                const sortIndex = entry.value_ptr.*;
                if (sortIndex.field == ctx.field) {
                    const t = db.getText(
                        ctx.typeEntry,
                        ctx.id,
                        ctx.node.?,
                        ctx.fieldSchema.?,
                        ctx.fieldType,
                        sortIndex.langCode,
                    );
                    sort.remove(ctx.db, sortIndex, t, ctx.node.?);
                    sort.insert(ctx.db, sortIndex, sort.EMPTY_SLICE, ctx.node.?);
                }
            }
        }
    }
    if (ctx.fieldType == types.Prop.ALIAS) {
        db.delAlias(ctx.typeEntry.?, ctx.id, ctx.field) catch |e| {
            if (e != error.SELVA_ENOENT) return e;
        };
    } else {
        // TODO check it!
        if (ctx.fieldType == types.Prop.REFERENCE) {
            const fs = ctx.fieldSchema.?;
            const dstType = try db.getRefDstType(ctx.db, fs);
            const oldRefDst = db.getNodeFromReference(dstType, db.getSingleReference(ctx.db, ctx.node.?, fs));
            if (oldRefDst) |dstNode| {
                Modify.markDirtyRange(ctx, selva.selva_get_node_type(dstNode), db.getNodeId(dstNode));
            }
        }
        try db.deleteField(ctx, ctx.node.?, ctx.fieldSchema.?);
    }
    return 0;
}

pub fn deleteTextLang(ctx: *ModifyCtx, lang: types.LangCode) void {
    const t = db.getText(
        ctx.typeEntry,
        ctx.id,
        ctx.node.?,
        ctx.fieldSchema.?,
        ctx.fieldType,
        lang,
    );

    // If !empty
    if (t.len >= 6) {
        const sortIndex = sort.getSortIndex(ctx.db.sortIndexes.get(ctx.typeId), ctx.field, 0, lang);
        if (sortIndex) |sI| {
            sort.remove(ctx.db, sI, t, ctx.node.?);
            sort.insert(ctx.db, sI, sort.EMPTY_SLICE, ctx.node.?);
        }
        db.deleteTextFieldTranslation(ctx, ctx.fieldSchema.?, lang) catch |e| {
            std.log.debug("Failed to delete a translation ({any}:{any}.{any}.{any}): {any}", .{ ctx.typeId, ctx.id, ctx.field, lang, e });
        };
    }
}
