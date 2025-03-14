const db = @import("../db/db.zig");
const utils = @import("../utils.zig");
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const types = @import("../types.zig");
const update = @import("./update.zig");
const std = @import("std");
const read = utils.read;

const ModifyCtx = Modify.ModifyCtx;
const p = types.Prop;

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: *selva.SelvaNodeReference,
    data: []u8,
) !void {
    var i: usize = 0;
    const edgeConstraint = selva.selva_get_edge_field_constraint(ctx.fieldSchema.?);

    std.debug.print("flap {any} \n", .{data});

    while (i < data.len) {
        const op: types.ModOp = @enumFromInt(data[i]);
        const prop = data[i + 1];
        // const t: p = @enumFromInt(data[i + 2]);
        i += 3;

        var len: u32 = undefined;
        var offset: u32 = 0;

        // if TEXT
        // ---> MAIN
        // TMP
        // if (op == types.ModOp.INCREMENT or op == types.ModOp.DECREMENT) {
        //     const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
        //     const val = db.getEdgeProp(ref, edgeFieldSchema.?);
        //     if (val.len > 0) {
        //         _ = update.incrementBuffer(op, t, val, edgeData);
        //         edgeData = val;
        //     } else set
        // else just set it
        // }

        if (op == types.ModOp.UPDATE_PARTIAL) {
            len = read(u32, data, i);
            const totalMainBufferLen = read(u16, data, i + 4);
            offset = 6;
            const mainBufferOffset = len - totalMainBufferLen;

            const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            const val = db.getEdgeProp(ref, edgeFieldSchema.?);

            if (val.len > 0) {
                const edgeData = data[i + offset + mainBufferOffset .. i + len + offset];
                var j: usize = offset + i;
                while (j < mainBufferOffset + offset + i) : (j += 4) {
                    const start = read(u16, data, j);
                    const l = read(u16, data, j + 2);
                    @memcpy(val[start .. start + l], edgeData[start .. start + l]);
                }
            } else {
                const edgeData = data[i + offset + mainBufferOffset .. i + len + offset];
                try db.writeEdgeProp(
                    ctx.db,
                    edgeData,
                    ctx.node.?,
                    edgeConstraint,
                    ref,
                    prop,
                );
            }
        } else {
            len = read(u32, data, i);
            offset = 4;

            //  if (t != p.CARDINALITY) {
            //     var edgeData = data[i + 2 + offset .. i + 2 + offset + edgeLen];
            //     if (op == types.ModOp.INCREMENT or op == types.ModOp.DECREMENT) {
            //         const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            //         const val = db.getEdgeProp(ref, edgeFieldSchema.?);
            //         if (val.len > 0) {
            //             _ = update.incrementBuffer(op, t, val, edgeData);
            //             edgeData = val;
            //         }
            //     }

            const edgeData = data[i + offset .. i + offset + len];
            try db.writeEdgeProp(
                ctx.db,
                edgeData,
                ctx.node.?,
                edgeConstraint,
                ref,
                prop,
            );
        }

        i += offset + len;
    }
}
