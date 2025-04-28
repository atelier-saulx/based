const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const std = @import("std");
const types = @import("../types.zig");
const ModifyCtx = Modify.ModifyCtx;
const selva = @import("../selva.zig");

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

    const data = db.getField(
        ctx.typeEntry,
        ctx.id,
        ctx.node.?,
        ctx.fieldSchema.?,
        ctx.fieldType,
    );

    std.debug.print("vla {any} \n", .{data});
    var iter = db.textIterator(data, types.LangCode.NONE);
    while (iter.next()) |s| {
        std.debug.print("OK ALL TEXT FIELDS {any} \n", .{s});
    }

    std.debug.print("YO DEL {any} --> id: {d} \n", .{ t, db.getNodeId(ctx.node.?) });

    const sortIndex = sort.getSortIndex(ctx.db.sortIndexes.get(ctx.typeId), ctx.field, 0, lang);

    // if (t.len > 6) {
    if (sortIndex) |sI| {
        std.debug.print("\n-------------------\nREMOVE NON EMPTY {any} \n", .{t});

        sort.remove(ctx.db, sI, t, ctx.node.?);

        std.debug.print("\n-----------------------\nINSERT EMPTY {any} \n", .{sort.EMPTY_SLICE});

        // const str = [_]u8{ @intFromEnum(lang), 0, 97, 0, 0, 0, 0 };
        //  @constCast(&str)[0..str.len]

        sort.insert(ctx.db, sI, sort.EMPTY_SLICE, ctx.node.?);
    }

    const str = [_]u8{ @intFromEnum(lang), 0, 0, 0, 0, 0 };

    // db.writeField(ctx.db, @constCast(&str), ctx.node.?, ctx.fieldSchema.?) catch {};

    _ = selva.selva_fields_set_text(ctx.node, ctx.fieldSchema, &str, str.len);
}
