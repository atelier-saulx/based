const db = @import("../db/db.zig");
const utils = @import("../utils.zig");
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig").c;
const errors = @import("../errors.zig");
const types = @import("../types.zig");
const update = @import("./update.zig");
const std = @import("std");
const read = utils.read;
const copy = utils.copy;

const ModifyCtx = Modify.ModifyCtx;
const p = types.Prop;

fn isMainEmpty(val: []u8) bool {
    var b = false;
    for (val) |byte| {
        b = b or byte != 0;
    }
    return b == false;
}

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: db.ReferenceLarge,
    data: []u8,
) !void {
    var i: usize = 0;
    const edgeConstraint = db.getEdgeFieldConstraint(ctx.fieldSchema.?);
    const edgeNode = try db.ensureRefEdgeNode(ctx, ctx.node.?, edgeConstraint, ref);
    const edgeId = ref.*.meta;
    const edgeTypeId = edgeConstraint.*.meta_node_type;
    if (edgeId > ctx.db.ids[edgeTypeId - 1]) {
        ctx.db.ids[edgeTypeId - 1] = edgeId;
    }

    while (i < data.len) {
        const op: types.ModOp = @enumFromInt(data[i]);
        const prop = data[i + 1];
        const t: p = @enumFromInt(data[i + 2]);
        i += 3;

        const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db, edgeConstraint, prop) catch {
            std.log.err("Edge field schema not found\n", .{});
            return;
        };

        var len: u32 = undefined;
        var offset: u32 = 0;

        // Only relevant for MAIN buffer
        if (op == types.ModOp.UPDATE_PARTIAL) {
            len = read(u32, data, i);
            const totalMainBufferLen = read(u16, data, i + 4);
            offset = 6;
            const mainBufferOffset = len - totalMainBufferLen;
            const val = db.getField(null, edgeNode, edgeFieldSchema, t);

            if (!isMainEmpty(val)) {
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
                try db.writeField(edgeNode, edgeFieldSchema, edgeData);
            }
        } else if (t == p.REFERENCE) {
            len = 4;
            offset = 0;
            const dstId = read(u32, data, i + offset);
            if (db.getNode(try db.getRefDstType(ctx.db, edgeFieldSchema), dstId)) |dstNode| {
                _ = try db.writeReference(ctx, edgeNode, edgeFieldSchema, dstNode);
            } else {
                return errors.SelvaError.SELVA_ENOENT;
            }
        } else if (t == p.REFERENCES) {
            len = read(u32, data, i);
            offset = 4;
            const edgeData = data[i + offset .. i + offset + len];

            try db.putReferences(ctx, utils.realign(u32, edgeData), edgeNode, edgeFieldSchema);
        } else if (t == p.CARDINALITY) {
            len = read(u32, data, i);
            offset = 4;
            const hll = try db.ensureEdgePropString(ctx, ctx.node.?, edgeConstraint, ref, edgeFieldSchema);
            selva.hll_init(hll, 8, true); // TBD: to get optionals from buffer
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
            try db.writeField(edgeNode, edgeFieldSchema, edgeData);
        }

        i += offset + len;
    }
}
