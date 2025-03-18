const db = @import("../db/db.zig");
const utils = @import("../utils.zig");
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const types = @import("../types.zig");
const update = @import("./update.zig");
const std = @import("std");
const read = utils.read;
const copy = utils.copy;

const ModifyCtx = Modify.ModifyCtx;
const p = types.Prop;

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: *selva.SelvaNodeReference,
    data: []u8,
) !void {
    var i: usize = 0;
    const edgeConstraint = selva.selva_get_edge_field_constraint(ctx.fieldSchema.?);

    while (i < data.len) {
        const op: types.ModOp = @enumFromInt(data[i]);
        const prop = data[i + 1];
        const t: p = @enumFromInt(data[i + 2]);
        i += 3;

        var len: u32 = undefined;
        var offset: u32 = 0;

        // Only relevant for MAIN buffer
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
                while (j < mainBufferOffset + offset + i) : (j += 6) {
                    const start = read(u16, data, j);
                    const l = read(u16, data, j + 2);
                    const fieldOp: types.ModOp = @enumFromInt(data[j + 4]);
                    if (fieldOp == types.ModOp.INCREMENT or fieldOp == types.ModOp.DECREMENT) {
                        _ = update.incrementBuffer(op, @enumFromInt(data[j + 5]), val, edgeData);
                    } else {
                        copy(val[start .. start + l], edgeData[start .. start + l]);
                    }
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
        } else if (t == p.REFERENCE) {
            len = 4;
            offset = 0;
            const edgeData = data[i + offset .. i + offset + len];
            try db.writeEdgeProp(
                ctx.db,
                edgeData,
                ctx.node.?,
                edgeConstraint,
                ref,
                prop,
            );
        } else if (t == p.CARDINALITY) {
            len = read(u32, data, i);
            offset = 4;
            const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            const hll = selva.selva_fields_ensure_string2(
                ctx.db.selva.?,
                ctx.node.?,
                edgeConstraint,
                ref,
                edgeFieldSchema,
                selva.HLL_INIT_SIZE,
            );
            selva.hll_init(hll, 14, true);
            var it: usize = i + offset;
            while (it < len) {
                const hash = read(u64, data, it);
                selva.hll_add(hll, hash);
                it += 8;
            }
        } else {
            len = read(u32, data, i);
            offset = 4;
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
