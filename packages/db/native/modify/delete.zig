const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;

// TODO maybe remove this completely
pub fn deleteField(ctx: *ModifyCtx) !usize {
    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            const currentData = db.selvaGetField(ctx.selvaNode.?, ctx.selvaFieldSchema.?);
            var it = db.ctx.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |key| {
                const start = key.*;
                const sortIndex = (try getSortIndex(ctx, start)).?;
                try sort.deleteField(ctx.id, currentData, sortIndex);
            }
        }
        return 0;
    }
    if (ctx.currentSortIndex != null) {
        const currentData = db.selvaGetField(ctx.selvaNode.?, ctx.selvaFieldSchema.?);
        sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?) catch {
            return 0;
        };
    }
    return 0;
}

pub fn deleteFieldOnly(ctx: *ModifyCtx) !usize {
    if (ctx.currentSortIndex != null) {
        const currentData = db.selvaGetField(ctx.selvaNode.?, ctx.selvaFieldSchema.?);
        try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
        try sort.writeField(ctx.id, sort.EMPTY_CHAR_SLICE, ctx.currentSortIndex.?);
    }
    return 0;
}
