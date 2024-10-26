const std = @import("std");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;
const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const types = @import("../types.zig");

pub fn updateField(ctx: *ModifyCtx, data: []u8) !usize {
    switch (ctx.fieldType) {
        types.Prop.REFERENCES => {
            switch (@as(types.RefOp, @enumFromInt(data[4]))) {
                // overwrite
                types.RefOp.OVERWRITE => {
                    db.clearReferences(ctx.db, ctx.node.?, ctx.fieldSchema.?);
                    return references.updateReferences(ctx, data);
                },
                // add
                types.RefOp.ADD => {
                    return references.updateReferences(ctx, data);
                },
                // delete
                types.RefOp.DELETE => {
                    return references.deleteReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_OVERWRITE => {
                    db.clearReferences(ctx.db, ctx.node.?, ctx.fieldSchema.?);
                    return references.putReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_ADD => {
                    return references.putReferences(ctx, data);
                },
                else => {
                    const len = readInt(u32, data, 0);
                    return len;
                },
            }
        },
        types.Prop.REFERENCE => {
            return reference.updateReference(ctx, data);
        },
        else => {
            const len = readInt(u32, data, 0);
            const slice = data[4 .. len + 4];
            if (ctx.field == 0) {
                if (sort.hasMainSortIndexes(ctx.db, ctx.typeId)) {
                    const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                    var it = ctx.db.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.keyIterator();
                    while (it.next()) |key| {
                        const start = key.*;
                        const sortIndex = (try getSortIndex(ctx, start)).?;
                        try sort.deleteField(ctx.id, currentData, sortIndex);
                        try sort.writeField(ctx.id, slice, sortIndex);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                try sort.writeField(ctx.id, slice, ctx.currentSortIndex.?);
            }

            if (ctx.fieldType == types.Prop.ALIAS) {
                try db.setAlias(ctx.id, ctx.field, slice, ctx.typeEntry.?);
            } else {
                try db.writeField(ctx.db, slice, ctx.node.?, ctx.fieldSchema.?);
            }

            return len;
        },
    }
}

pub fn updatePartialField(ctx: *ModifyCtx, data: []u8) !usize {
    const len = readInt(u32, data, 0);
    const slice = data[4 .. len + 4];
    var currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);

    if (currentData.len != 0) {
        var j: usize = 0;
        const hasSortIndex: bool = (ctx.field == 0 and sort.hasMainSortIndexes(ctx.db, ctx.typeId));
        while (j < len) {
            const operation = slice[j..];
            const start = readInt(u16, operation, 0);
            const l = readInt(u16, operation, 2);
            if (ctx.field == 0) {
                if (hasSortIndex and ctx.db.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.contains(start)) {
                    const sortIndex = try getSortIndex(ctx, start);
                    try sort.deleteField(ctx.id, currentData, sortIndex.?);
                    try sort.writeField(ctx.id, operation[4 .. l + 4], sortIndex.?);
                }
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            } else if (ctx.currentSortIndex != null) {
                try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                try sort.writeField(ctx.id, currentData, ctx.currentSortIndex.?);
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            } else {
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            }
            j += 4 + l;
        }
    } else {
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }
    return len;
}
