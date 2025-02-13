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
            // CREATE IT!
            // TODO MARCO: make it to 8 bytes crc32 + len
            // try db.writeField(ctx.db, slice, ctx.node.?, ctx.fieldSchema.?); create something?
            // create hll convert to buffer memcopy into a field here

            // selva_fields_get_string(ctx.fieldSchema.?, "type", &type);
            // std.debug.print("\nput -->: {any}", .{data});

            const len = read(u32, data, 0);
            if (data[5] == 0) {
                // RESET IF ITS UPDATE NOT IMPORANT
                // std.debug.print("\nput HLL: {any}", .{data});
            } else {
                //
                // std.debug.print("\nadd HLL: {any}", .{data});

                const hll = selva.fields_ensure_string(ctx.db.selva, ctx.node.?, ctx.fieldSchema.?, 6);
                selva.hll_init(hll, 14, false);

                // std.debug.print("HLL --->: {any}", .{hll});

                // selva.hll_add(hll, data[5 .. len + 5]);
                // try db.writeField(ctx.db, hll, ctx.node.?, ctx.fieldSchema.?);
            }
            var i: usize = 1;
            while (i < len) : (i += 4) {
                const id = read(u32, data, i + 4);
                //                 try db.writeField(ctx.db, slice, ctx.node.?, ctx.fieldSchema.?);

                //
                std.debug.print("\nZIG item: HLL: {any} FS: {any}\n", .{ id, ctx.fieldSchema.? });
            }
            return len;
        },
        else => {
            // std.debug.print("\nta entrando aqui ao invés -->: {any} {any}", .{ ctx.fieldSchema, ctx.fieldType });
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
