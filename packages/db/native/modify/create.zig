const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const types = @import("../types.zig");
const std = @import("std");

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

pub fn createField(ctx: *ModifyCtx, data: []u8) !usize {
    switch (ctx.fieldType) {
        types.Prop.REFERENCES => {
            switch (@as(types.RefOp, @enumFromInt(data[4]))) {
                // overwrite, add
                types.RefOp.OVERWRITE, types.RefOp.ADD => {
                    return references.updateReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_OVERWRITE, types.RefOp.PUT_ADD => {
                    return references.putReferences(ctx, data);
                },
                else => {
                    const len = readInt(u32, data, 0);
                    // invalid command
                    return len;
                },
            }
        },
        types.Prop.REFERENCE => {
            return reference.updateReference(ctx, data);
        },
        types.Prop.HLL => {
            // TODO MARCO: make it to 8 bytes crc32 + len
            const len = readInt(u32, data, 0);
            if (data[5] == 0) {
                std.debug.print("\nput HLL: {any}", .{data});
            } else {
                std.debug.print("\nadd HLL: {any}", .{data});
            }
            var i: usize = 1;
            while (i < len) : (i += 4) {
                const id = readInt(u32, data, i + 4);
                std.debug.print("\nitem: HLL: {any}", .{id});
            }
            return len;
        },
        else => {
            const len = readInt(u32, data, 0);
            const slice = data[4 .. len + 4];
            if (ctx.field == 0) {
                if (ctx.typeSortIndex != null) {
                    var it = ctx.typeSortIndex.?.main.iterator();
                    while (it.next()) |entry| {
                        const sI = entry.value_ptr.*;
                        sort.addToSortIndex(sI, slice, ctx.node.?);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                sort.addToSortIndex(ctx.currentSortIndex.?, slice, ctx.node.?);
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
