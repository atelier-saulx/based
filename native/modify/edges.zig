const Modify = @import("common.zig");
const selva = @import("../selva/selva.zig").c;
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
const References = @import("../selva/references.zig");
const utils = @import("../utils.zig");
const errors = @import("../errors.zig");
const update = @import("update.zig");
const std = @import("std");
const t = @import("../types.zig");

const read = utils.read;
const copy = utils.copy;
const ModifyCtx = Modify.ModifyCtx;

fn isMainEmpty(val: []u8) bool {
    var b = false;
    for (val) |byte| {
        b = b or byte != 0;
    }
    return b == false;
}

pub fn writeEdges(
    ctx: *ModifyCtx,
    ref: References.ReferenceLarge,
    data: []u8,
) !void {
    var i: usize = 0;
    const edgeConstraint = Schema.getEdgeFieldConstraint(ctx.fieldSchema.?);
    const edgeNode = try Node.ensureRefEdgeNode(ctx, ctx.node.?, edgeConstraint, ref);
    const edgeId = ref.*.edge;
    const edgeTypeId = edgeConstraint.*.edge_node_type;
    if (edgeId > ctx.db.ids[edgeTypeId - 1]) {
        ctx.db.ids[edgeTypeId - 1] = edgeId;
    }

    while (i < data.len) {
        const op: t.ModOp = @enumFromInt(data[i]);
        const prop = data[i + 1];
        const propType: t.PropType = @enumFromInt(data[i + 2]);
        i += 3;

        const edgeFieldSchema = Schema.getEdgeFieldSchema(ctx.db, edgeConstraint, prop) catch {
            std.log.err("Edge field schema not found\n", .{});
            return;
        };

        var len: u32 = undefined;
        var offset: u32 = 0;

        if (op == t.ModOp.updatePartial) {
            len = read(u32, data, i);
            const totalMainBufferLen = read(u16, data, i + 4);
            offset = 6;
            const mainBufferOffset = len - totalMainBufferLen;
            const val = Fields.get(null, edgeNode, edgeFieldSchema, propType);
            if (!isMainEmpty(val)) {
                const edgeData = data[i + offset + mainBufferOffset .. i + len + offset];
                var j: usize = offset + i;
                while (j < mainBufferOffset + offset + i) : (j += 6) {
                    const start = read(u16, data, j);
                    const l = read(u16, data, j + 2);
                    const fieldOp: t.ModOp = @enumFromInt(data[j + 4]);
                    if (fieldOp == t.ModOp.increment or fieldOp == t.ModOp.decrement) {
                        _ = update.incrementBuffer(op, @enumFromInt(data[j + 5]), val, edgeData);
                    } else {
                        copy(u8, val, edgeData[start .. start + l], start);
                    }
                }
            } else {
                const edgeData = data[i + offset + mainBufferOffset .. i + len + offset];
                try Fields.write(edgeNode, edgeFieldSchema, edgeData);
            }
        } else switch (propType) {
            t.PropType.reference => {
                len = 4;
                offset = 0;
                const dstId = read(u32, data, i + offset);
                if (Node.getNode(try Node.getRefDstType(ctx.db, edgeFieldSchema), dstId)) |dstNode| {
                    _ = try References.writeReference(ctx.db.selva, edgeNode, edgeFieldSchema, dstNode);
                } else {
                    return errors.SelvaError.SELVA_ENOENT;
                }
            },
            t.PropType.references => {
                len = read(u32, data, i);
                offset = 4;
                const edgeData = data[i + offset .. i + offset + len];
                // fix start
                const address = @intFromPtr(edgeData.ptr);
                const delta: u8 = @truncate(address % 4);
                const d = if (delta == 0) 0 else 4 - delta;
                const aligned = edgeData[d .. edgeData.len - 3 + d];
                if (d != 0) {
                    utils.move(aligned, edgeData[0 .. edgeData.len - 3]);
                }
                const u32ids = read([]u32, aligned, 0);
                try References.putReferences(ctx, edgeNode, edgeFieldSchema, u32ids);
            },
            t.PropType.cardinality => {
                len = read(u32, data, i);
                offset = 4;
                const hll = try Fields.ensureEdgePropTypeString(ctx, ctx.node.?, edgeConstraint, ref, edgeFieldSchema);
                selva.hll_init(hll, 8, true); // TBD: to get optionals from buffer
                var it: usize = i + offset;
                while (it < len) {
                    const hash = read(u64, data, it);
                    selva.hll_add(hll, hash);
                    it += 8;
                }
            },
            else => {
                len = read(u32, data, i);
                offset = 4;
                const edgeData = data[i + offset .. i + offset + len];
                try Fields.write(edgeNode, edgeFieldSchema, edgeData);
            },
        }
        i += offset + len;
    }
}
