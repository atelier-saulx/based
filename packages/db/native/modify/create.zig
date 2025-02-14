const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
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
                    const len = read(u32, data, 0);
                    // invalid command
                    return len;
                },
            }
        },
        types.Prop.REFERENCE => {
            return reference.updateReference(ctx, data);
        },
        types.Prop.CARDINALITY => {
            const hash: u64 = read(u64, data, 0);

            std.debug.print("zig hash: {d}\n", .{hash});

            // need to check i the hash cames empty?
            const hll = selva.fields_ensure_string(ctx.db.selva, ctx.node.?, ctx.fieldSchema.?, 6);
            selva.hll_init(hll, 4, false);

            selva.hll_add(hll, hash);

            // print from selva string to check, to strip it later
            var size: usize = undefined;
            const bufPtr: [*]u8 = @constCast(selva.selva_string_to_buf(hll, &size));
            const strU8: []u8 = bufPtr[0..size];
            std.debug.print("x {any} \n", .{strU8});

            try db.writeField(ctx.db, strU8, ctx.node.?, ctx.fieldSchema.?);

            // casting out nines, to strip it later
            const provaReal = selva.selva_fields_get_selva_string(ctx.node.?, ctx.fieldSchema.?);
            const countDistinct = selva.hll_count(@ptrCast(provaReal));
            std.debug.print("Count Distinct = {any} \n", .{countDistinct});

            return 8;
        },
        else => {
            const len = read(u32, data, 0);
            const slice = data[4 .. len + 4];
            if (ctx.field == 0) {
                if (ctx.typeSortIndex != null) {
                    var it = ctx.typeSortIndex.?.main.iterator();
                    while (it.next()) |entry| {
                        const sI = entry.value_ptr.*;
                        sort.insert(ctx.db, sI, slice, ctx.node.?);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                sort.insert(ctx.db, ctx.currentSortIndex.?, slice, ctx.node.?);
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
