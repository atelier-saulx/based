const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: *selva.SelvaNodeReference,
    data: []u8,
) !void {
    var i: usize = 0;

    while (i < data.len) {
        const prop = data[i];
        const typeIndex = data[i + 1];

        var offset: u32 = 0;
        var edgeLen: u32 = undefined;
        if (typeIndex == 11 or typeIndex == 14) {
            edgeLen = readInt(u32, data, i + 2);
            offset = 4;
        } else if (typeIndex == 10 or typeIndex == 9) {
            edgeLen = 1;
        } else if (typeIndex == 5 or typeIndex == 13) {
            edgeLen = 4;
        } else if (typeIndex == 4 or typeIndex == 1) {
            edgeLen = 8;
        }

        const edgeData = data[i + 2 + offset .. i + 2 + offset + edgeLen];

        try db.writeEdgeProp(
            edgeData,
            ctx.node.?,
            selva.selva_get_edge_field_constraint(ctx.fieldSchema.?),
            ref,
            prop - 1,
        );

        i += edgeLen + 2 + offset;
    }
}
