const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const std = @import("std");
const types = @import("../types.zig");
const ModifyCtx = Modify.ModifyCtx;

// TODO: can optmize this greatly, espcialy text
pub fn deleteFieldSortIndex(ctx: *ModifyCtx) !usize {
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
            // pretty slow...
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
    if (ctx.typeSortIndex != null) {
        if (ctx.currentSortIndex != null) {
            const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
            sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
            sort.insert(ctx.db, ctx.currentSortIndex.?, sort.EMPTY_CHAR_SLICE, ctx.node.?);
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
                    sort.insert(ctx.db, sortIndex, sort.EMPTY_CHAR_SLICE, ctx.node.?);
                }
            }
        }
    }
    if (ctx.fieldType == types.Prop.ALIAS) {
        db.delAlias(ctx.typeEntry.?, ctx.id, ctx.field) catch |e| {
            if (e != error.SELVA_ENOENT) return e;
        };
    } else {
        try db.deleteField(ctx.db, ctx.node.?, ctx.fieldSchema.?);
    }
    return 0;
}
