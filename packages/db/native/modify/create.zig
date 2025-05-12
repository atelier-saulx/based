const db = @import("../db/db.zig");
const utils = @import("../utils.zig");
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const types = @import("../types.zig");
const std = @import("std");
const lib = @import("../lib.zig");

const read = utils.read;

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
        types.Prop.VECTOR => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            try db.setMicroBuffer(ctx.node.?, ctx.fieldSchema.?, slice);
            return len;
        },
        types.Prop.CARDINALITY => {
            const len = read(u32, data, 0);
            const hll = selva.selva_fields_ensure_string(ctx.node.?, ctx.fieldSchema.?, selva.HLL_INIT_SIZE);
            selva.hll_init(hll, 14, true);
            var i: usize = 4;
            while (i < len * 8) {
                const hash = read(u64, data, i);
                selva.hll_add(hll, hash);
                i += 8;
            }
            const newCount = selva.hll_count(hll);
            addSortIndexOnCreation(ctx, newCount[0..4]) catch null;
            return len * 8;
        },
        else => {
            const len = read(u32, data, 0);
            const slice = data[4 .. len + 4];
            addSortIndexOnCreation(ctx, slice) catch null;
            if (ctx.fieldType == types.Prop.ALIAS) {
                if (slice.len > 0) {
                    const old = try db.setAlias(ctx.typeEntry.?, ctx.id, ctx.field, slice);
                    if (old > 0) {
                        if (ctx.currentSortIndex != null) {
                            sort.remove(ctx.db, ctx.currentSortIndex.?, slice, db.getNode(old, ctx.typeEntry.?).?);
                        }
                        Modify.markDirtyRange(ctx, ctx.typeId, old);
                    }
                }
            } else {
                try db.writeField(slice, ctx.node.?, ctx.fieldSchema.?);
            }
            return len;
        },
    }
}

pub fn addSortIndexOnCreation(ctx: *ModifyCtx, slice: []u8) !void {
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
    } else if (ctx.typeSortIndex != null and ctx.fieldType == types.Prop.TEXT) {
        const sIndex = sort.getSortIndex(
            ctx.db.sortIndexes.get(ctx.typeId),
            ctx.field,
            0,
            @enumFromInt(slice[0]),
        );
        if (sIndex) |s| {
            sort.insert(ctx.db, s, slice, ctx.node.?);
        }
    }
}
