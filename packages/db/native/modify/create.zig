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
    if (ctx.fieldType == types.Prop.REFERENCES) {
        try references.updateReferences(ctx, data);
        return data.len;
    }

    if (ctx.fieldType == types.Prop.REFERENCE) {
        try reference.updateReference(ctx, data);
        return data.len;
    }

    if (ctx.fieldType == types.Prop.ALIAS) {
        // try db.setAlias(ctx.id, ctx.field, data, ctx.typeEntry.?);
        // return data.len;
        return 0;
    }

    try db.writeField(data, ctx.node.?, ctx.fieldSchema.?);
    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = db.ctx.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.keyIterator();
            while (it.next()) |start| {
                const sortIndex = try getSortIndex(ctx, start.*);
                try sort.writeField(ctx.id, data, sortIndex.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }
    return data.len;
}
