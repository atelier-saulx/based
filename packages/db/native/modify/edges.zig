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

        // var start: u16 = 0;

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
        //     } else set
        // else just set it
        // }

        // difference in update and set
        // if create it has the full main buffer much easier

        if (op == types.ModOp.UPDATE_PARTIAL) {
            // IF CREATE OR FULL UPDATE OF MAIN
            // IF UPDATE SINGLE VALUE
            // const size = read(u16, data, i + 3);
            len = read(u32, data, i);
            const totalMainBufferLen = read(u16, data, i + 4);
            offset = 6;
            std.debug.print("222 MAIN {any} prop: {any} \n", .{ offset, prop });

            const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
            const val = db.getEdgeProp(ref, edgeFieldSchema.?);

            if (val.len > 0) {
                // -----------
            } else {
                // add main len as well
                // std.debug.print("Yo! {any} - {any} \n", .{ data[i + 3 + offset .. i + 3 + len + offset], totalMainBufferLen });
                // ----
                // const newField =
                const mainBufferOffset = len - totalMainBufferLen;

                const edgeData = data[i + offset + mainBufferOffset .. i + len + offset];

                std.debug.print(
                    "MAIN {any} prop: {any} [{any},{any}] {any} \n",
                    .{ mainBufferOffset, prop, i + offset + mainBufferOffset, i + len + offset, edgeData },
                );

                // std.debug.print("MAIN {any} prop: {any} \n", .{ edgeData, prop });

                try db.writeEdgeProp(
                    ctx.db,
                    edgeData,
                    ctx.node.?,
                    edgeConstraint,
                    ref,
                    prop,
                );

                std.debug.print("flap \n", .{});
            }

            // const edgeFieldSchema = db.getEdgeFieldSchema(ctx.db.selva.?, edgeConstraint, prop) catch null;
        } else {
            len = read(u32, data, i);
            offset = 4;

            const edgeData = data[i + offset .. i + offset + len];
            // std.debug.print("222 MAIN {any} prop: {any} \n", .{ edgeData, prop });

            try db.writeEdgeProp(
                ctx.db,
                edgeData,
                ctx.node.?,
                edgeConstraint,
                ref,
                prop,
            );
        }

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

        i += offset + len;
    }
}
