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
            sort.remove(entry.value_ptr.*, currentData.?, ctx.node.?);
        }
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
        sort.remove(ctx.currentSortIndex.?, currentData, ctx.node.?);
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
                sort.remove(sortIndex, t, ctx.node.?);
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
            sort.remove(ctx.currentSortIndex.?, currentData, ctx.node.?);
            sort.insert(ctx.currentSortIndex.?, sort.EMPTY_SLICE, ctx.node.?);
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
                    sort.remove(sortIndex, t, ctx.node.?);
                    sort.insert(sortIndex, sort.EMPTY_SLICE, ctx.node.?);
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
            const oldRefDst = db.getNodeFromReference(db.getSingleReference(ctx.db, ctx.node.?, ctx.fieldSchema.?));
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
            sort.remove(sI, t, ctx.node.?);
            sort.insert(sI, sort.EMPTY_SLICE, ctx.node.?);
        }
        _ = selva.selva_fields_set_text(ctx.node, ctx.fieldSchema, &selva.selva_fields_text_tl_empty[@intFromEnum(lang)], selva.SELVA_FIELDS_TEXT_TL_EMPTY_LEN);
    }
}
