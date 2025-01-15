const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const types = @import("../types.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;

const p = types.Prop;

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: *selva.SelvaNodeReference,
    data: []u8,
) !void {
    var i: usize = 0;

    while (i < data.len) {
        const prop = data[i];
        const t: p = @enumFromInt(data[i + 1]);
        var offset: u32 = 0;
        var edgeLen: u32 = undefined;
        if (t == p.STRING or t == p.REFERENCES or t == p.ALIAS) {
            edgeLen = readInt(u32, data, i + 2);
            offset = 4;
        } else if (t == p.ENUM or t == p.BOOLEAN or t == p.INT8 or t == p.UINT8) {
            edgeLen = 1;
        } else if (t == p.INT16 or t == p.UINT16) {
            edgeLen = 2;
        } else if (t == p.INT32 or t == p.UINT32 or t == p.REFERENCE) {
            edgeLen = 4;
        } else if (t == p.NUMBER or t == p.TIMESTAMP) {
            edgeLen = 8;
        }

        const edgeData = data[i + 2 + offset .. i + 2 + offset + edgeLen];

        try db.writeEdgeProp(
            edgeData,
            ctx.node.?,
            selva.selva_get_edge_field_constraint(ctx.fieldSchema.?),
            ref,
            prop,
        );

        i += edgeLen + 2 + offset;
    }
}
