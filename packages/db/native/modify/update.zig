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
            const op = data[0];

            if (op == 0) {
                // overwrite
                db.clearReferences(ctx.db, ctx.node.?, ctx.fieldSchema.?);
                try references.updateReferences(ctx, data);
            } else if (op == 1) {
                // add
                try references.updateReferences(ctx, data);
            } else if (op == 2) {
                // delete
                try references.deleteReferences(ctx, data);
            } else if (op == 3) {
                // update
                try references.updateReferences(ctx, data);
            }

            return data.len;
        },
        types.Prop.REFERENCE => {
            try reference.updateReference(ctx, data);
            return data.len;
        },
        else => {
            if (ctx.field == 0) {
                if (sort.hasMainSortIndexes(ctx.db, ctx.typeId)) {
                    const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                    var it = ctx.db.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.keyIterator();
                    while (it.next()) |key| {
                        const start = key.*;
                        const sortIndex = (try getSortIndex(ctx, start)).?;
                        try sort.deleteField(ctx.id, currentData, sortIndex);
                        try sort.writeField(ctx.id, data, sortIndex);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
            }

            if (ctx.fieldType == types.Prop.ALIAS) {
                try db.setAlias(ctx.id, ctx.field, data, ctx.typeEntry.?);
                return data.len;
            }

            try db.writeField(ctx.db, data, ctx.node.?, ctx.fieldSchema.?);
            return data.len;
        },
    }
}

pub fn updatePartialField(ctx: *ModifyCtx, data: []u8) !usize {
    var currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
    if (currentData.len != 0) {
        var j: usize = 0;
        const hasSortIndex: bool = (ctx.field == 0 and sort.hasMainSortIndexes(ctx.db, ctx.typeId));
        while (j < data.len) {
            const operation = data[j..];
            const start = readInt(u16, operation, 0);
            const len = readInt(u16, operation, 2);
            if (ctx.field == 0) {
                if (hasSortIndex and ctx.db.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.contains(start)) {
                    const sortIndex = try getSortIndex(ctx, start);
                    try sort.deleteField(ctx.id, currentData, sortIndex.?);
                    try sort.writeField(ctx.id, operation[4 .. len + 4], sortIndex.?);
                }
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else if (ctx.currentSortIndex != null) {
                try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                try sort.writeField(ctx.id, currentData, ctx.currentSortIndex.?);
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else {
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            }
            j += 4 + len;
        }
    } else {
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }
    return data.len;
}
