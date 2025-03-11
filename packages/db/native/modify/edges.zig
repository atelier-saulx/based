const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const types = @import("../types.zig");
const update = @import("./update.zig");
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
        const op: types.ModOp = @enumFromInt(0);

        const prop = data[i];

        const t: p = @enumFromInt(data[i + 1]);

        var offset: u32 = 0;
        var edgeLen: u32 = undefined;
        const edgeConstraint = selva.selva_get_edge_field_constraint(ctx.fieldSchema.?);

        var start: u16 = 0;

        if (prop == 0) {
            start = read(u16, data, i + 2);
            edgeLen = @as(u32, read(u16, data, i + 4));
            // prop = data[i + 2];
            i += 4;
        } else if (t == p.STRING or t == p.REFERENCES or t == p.ALIAS) {
            edgeLen = read(u32, data, i + 2);
            offset = 4;
        }

        var edgeData = data[i + 2 + offset .. i + 2 + offset + edgeLen];

        std.debug.print(
            "FLAP {any} len: {d} i: {d} d: {any} start: {any} edgeData: {any} \n",
            .{ prop, edgeLen, i, data, start, edgeData },
        );

        // TMP
        if (op == types.ModOp.INCREMENT or op == types.ModOp.DECREMENT) {
            const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            const val = db.getEdgeProp(ref, edgeFieldSchema.?);
            if (val.len > 0) {
                _ = update.incrementBuffer(op, t, val, edgeData);
                edgeData = val;
            }
        }

        // difference in update and set
        // if create it has the full main buffer much easier

        try db.writeEdgeProp(
            ctx.db,
            edgeData,
            ctx.node.?,
            edgeConstraint,
            ref,
            prop,
        );

        i += edgeLen + 2 + offset;
    }
}
