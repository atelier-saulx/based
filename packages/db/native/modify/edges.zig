const db = @import("../db/db.zig");
const utils = @import("../utils.zig");
const read = utils.read;
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
        var op: types.ModOp = @enumFromInt(0);
        var prop = data[i];
        if (prop == 0) {
            op = @enumFromInt(data[i + 1]);
            prop = data[i + 2];
            i += 2;
        }
        const t: p = @enumFromInt(data[i + 1]);
        var offset: u32 = 0;
        var edgeLen: u32 = undefined;
        const edgeConstraint = selva.selva_get_edge_field_constraint(ctx.fieldSchema.?);

        if (t == p.STRING or t == p.REFERENCES or t == p.ALIAS) {
            edgeLen = read(u32, data, i + 2);
            offset = 4;
        } else if (t == p.ENUM or t == p.BOOLEAN or t == p.INT8 or t == p.UINT8) {
            edgeLen = 1;
        } else if (t == p.INT16 or t == p.UINT16) {
            edgeLen = 2;
        } else if (t == p.INT32 or t == p.UINT32 or t == p.REFERENCE) {
            edgeLen = 4;
        } else if (t == p.NUMBER or t == p.TIMESTAMP) {
            edgeLen = 8;
        } else if (t == p.CARDINALITY) {
            // const len = read(u32, data, i + 2);
            // const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            // const hll = selva.selva_fields_ensure_string(ctx.node.?, edgeFieldSchema, selva.HLL_INIT_SIZE);
            // selva.hll_init(hll, 14, true);

            const hash = read(u64, data, 6);
            utils.debugPrint("data: {any}\nhash: {any}\n", .{ data, hash });
            // var it: usize = 6;
            // while (it < len * 8 + 6) {
            //     const hash = read(u64, data, it);
            //     utils.debugPrint("hash: {any}\n", .{hash});
            //     selva.hll_add(hll, hash);
            //     it += 8;
            // }
            // edgeLen = len;
            // offset = 4;
            // const countDistinct = selva.hll_count(@ptrCast(hll));
            // const value = countDistinct[0..4];
            // utils.debugPrint("include.zig / len hll stored: {any}\n", .{selva.selva_string_get_len(hll)});
            // utils.debugPrint("include.zig / countDistinct: {}\n", .{std.mem.bytesToValue(u32, value)});
        }
        if (t != p.CARDINALITY) {
            var edgeData = data[i + 2 + offset .. i + 2 + offset + edgeLen];

            if (op == types.ModOp.INCREMENT or op == types.ModOp.DECREMENT) {
                const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
                const val = db.getEdgeProp(ref, edgeFieldSchema.?);
                if (val.len > 0) {
                    _ = update.incrementBuffer(op, t, val, edgeData);
                    edgeData = val;
                }
            }

            try db.writeEdgeProp(
                ctx.db,
                edgeData,
                ctx.node.?,
                edgeConstraint,
                ref,
                prop,
            );
        }

        i += edgeLen + 2 + offset;
    }
}
