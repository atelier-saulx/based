const Modify = @import("common.zig");
const selva = @import("../selva/selva.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
const utils = @import("../utils.zig");
const sort = @import("../sort/sort.zig");
const errors = @import("../errors.zig");
const references = @import("references.zig");
const reference = @import("reference.zig");
const std = @import("std");
const lib = @import("../lib.zig");
const subs = @import("subscription.zig");
const t = @import("../types.zig");

const read = utils.read;

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

pub fn createField(ctx: *ModifyCtx, data: []u8) !usize {
    // subs.stage(ctx, subs.Op.create);

    switch (ctx.fieldType) {
        t.PropType.references => {
            return references.writeReferences(ctx, data);
        },
        t.PropType.reference => {
            return reference.updateReference(ctx, data);
        },
        t.PropType.vector => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            try Fields.setMicroBuffer(ctx.node.?, ctx.fieldSchema.?, slice);
            return len + 4;
        },
        t.PropType.colVec => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            Fields.setColvec(ctx.typeEntry.?, ctx.id, ctx.fieldSchema.?, slice);
            return len + 4;
        },
        t.PropType.cardinality => {
            const hllMode = if (data[0] == 0) true else false;
            const hllPrecision = data[1];
            const offset = 2;
            const len = read(u32, data, offset);
            const hll = try Fields.ensurePropTypeString(ctx, ctx.fieldSchema.?);
            selva.c.hll_init(hll, hllPrecision, hllMode);
            var i: usize = 4 + offset;
            while (i < (len * 8) + offset) {
                const hash = read(u64, data, i);
                selva.c.hll_add(hll, hash);
                i += 8;
            }
            const newCount = selva.c.hll_count(hll);
            addSortIndexOnCreation(ctx, newCount[0..4]) catch null;
            return len * 8 + 6;
        },
        else => {
            const len = read(u32, data, 0);
            const slice = data[4 .. len + 4];
            addSortIndexOnCreation(ctx, slice) catch null;
            if (ctx.fieldType == t.PropType.alias) {
                if (slice.len > 0) {
                    const old = try Fields.setAlias(ctx.typeEntry.?, ctx.id, ctx.field, slice);
                    if (old > 0) {
                        if (ctx.currentSortIndex != null) {
                            sort.remove(ctx.thread.decompressor, ctx.currentSortIndex.?, slice, Node.getNode(ctx.typeEntry.?, old).?);
                        }
                        selva.markDirty(ctx, ctx.typeId, old);
                    }
                }
            } else {
                try Fields.write(ctx.node.?, ctx.fieldSchema.?, slice);
            }
            return len + 4;
        },
    }
}

pub fn addSortIndexOnCreation(ctx: *ModifyCtx, slice: []u8) !void {
    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            var it = ctx.typeSortIndex.?.main.iterator();
            while (it.next()) |entry| {
                const sI = entry.value_ptr.*;
                sort.insert(ctx.thread.decompressor, sI, slice, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.insert(ctx.thread.decompressor, ctx.currentSortIndex.?, slice, ctx.node.?);
    } else if (ctx.typeSortIndex != null and ctx.fieldType == t.PropType.text) {
        const sIndex = sort.getSortIndex(
            ctx.db.sortIndexes.get(ctx.typeId),
            ctx.field,
            0,
            @enumFromInt(slice[0]),
        );
        if (sIndex) |s| {
            sort.insert(ctx.thread.decompressor, s, slice, ctx.node.?);
        }
    }
}
