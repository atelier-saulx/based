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
    const edgeConstraint = selva.selva_get_edge_field_constraint(ctx.fieldSchema.?);

    while (i < data.len) {
        const op: types.ModOp = @enumFromInt(data[i]);
        const prop = data[i + 1];
        const t: p = @enumFromInt(data[i + 2]);
        var len: u32 = undefined;
        var offset: u32 = 0;

        // var start: u16 = 0;
        std.debug.print("GOT derp i {d} {any} {any} {any} d: {any} \n", .{ i, op, t, prop, data });

        // if (prop == 0) {
        //     // IF CREATE OR FULL UPDATE OF MAIN
        //     // IF UPDATE SINGLE VALUE
        //     start = read(u16, data, i + 2);
        //     edgeLen = @as(u32, read(u16, data, i + 4));
        //     // prop = data[i + 2];
        //     offset = 4;
        // } else {
        // if TEXT

        // ---> MAIN
        // TMP
        // if (op == types.ModOp.INCREMENT or op == types.ModOp.DECREMENT) {
        //     const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
        //     const val = db.getEdgeProp(ref, edgeFieldSchema.?);
        //     if (val.len > 0) {
        //         _ = update.incrementBuffer(op, t, val, edgeData);
        //         edgeData = val;
        //     }
        // }

        // difference in update and set
        // if create it has the full main buffer much easier

        if (op == types.ModOp.UPDATE_PARTIAL) {
            // IF CREATE OR FULL UPDATE OF MAIN
            // IF UPDATE SINGLE VALUE
            const start = read(u16, data, i + 3);
            len = @as(u32, read(u16, data, i + 5));
            std.debug.print("Yo! {any} \n", .{start});
            offset = 4;
            // const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
        } else {
            len = read(u32, data, i + 3);
            offset = 4;
            const edgeData = data[i + 3 + offset .. i + 3 + offset + len];
            try db.writeEdgeProp(
                ctx.db,
                edgeData,
                ctx.node.?,
                edgeConstraint,
                ref,
                prop,
            );
        }

        i += 3 + offset + len;
    }
}
