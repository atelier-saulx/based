const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const std = @import("std");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const IncludeOp = types.IncludeOp;

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
    ref: ?types.RefStruct,
    score: ?u8,
    comptime isEdge: bool,
) !usize {
    var includeMain: ?[]u8 = null;
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var main: ?[]u8 = null;
    var idIsSet: bool = isEdge;
    var edgeType: t.Prop = t.Prop.NULL;

    includeField: while (includeIterator < include.len) {
        const op: IncludeOp = @enumFromInt(include[includeIterator]);
        includeIterator += 1;

        const operation = include[includeIterator..];

        if (op == IncludeOp.edge) {
            const edgeSize = readInt(u16, operation, 0);
            const edges = operation[2 .. 2 + edgeSize];
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += try getFields(node, ctx, id, typeEntry, edges, .{
                .reference = ref.?.reference,
                .edgeConstaint = ref.?.edgeConstaint,
            }, null, true);
            includeIterator += edgeSize + 2;
            continue :includeField;
        }

        if (op == IncludeOp.references) {
            const refSize = readInt(u16, operation, 0);
            const multiRefs = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            if (isEdge) {
                std.debug.print("need to handle isEdge multi refs (write edge field here) \n", .{});
            }
            size += getRefsFields(
                ctx,
                multiRefs,
                node,
                typeEntry,
                ref,
                isEdge,
            );
            continue :includeField;
        }

        if (op == IncludeOp.reference) {
            const refSize = readInt(u16, operation, 0);
            const singleRef = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (isEdge) {
                std.debug.print("need to handle isEdge single refs (write edge field here) \n", .{});
            }
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += getSingleRefFields(
                ctx,
                singleRef,
                node,
                typeEntry,
                ref,
                isEdge,
            );
            continue :includeField;
        }

        const field: u8 = @intFromEnum(op);

        // MAIN
        if (field == 0) {
            const mainIncludeSize = readInt(u16, operation, 0);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        }

        var value: []u8 = undefined;

        if (isEdge) {
            const edgeFieldSchema = try db.getEdgeFieldSchema(ref.?.edgeConstaint, field);
            edgeType = @enumFromInt(edgeFieldSchema.*.type);
            value = db.getEdgeProp(ref.?.reference, edgeFieldSchema);
        } else {
            value = db.getField(
                typeEntry,
                id,
                node,
                try db.getFieldSchema(field, typeEntry),
            );
        }

        const valueLen = value.len;

        if (valueLen == 0) {
            continue :includeField;
        }

        if (isEdge) {
            size += 2;
            const propLen = t.Size(edgeType);
            if (propLen == 0) {
                size += (valueLen + 4);
            } else {
                size += propLen;
            }
        } else if (field == 0) {
            main = value;
            if (includeMain.?.len != 0) {
                size += readInt(u16, includeMain.?, 0) + 1;
            } else {
                size += (valueLen + 1);
            }
        } else {
            size += (valueLen + 5);
        }

        var result: results.Result = .{
            .id = null,
            .score = score,
            .field = field,
            .val = value,
            .refSize = null,
            .includeMain = includeMain,
            .refType = null,
            .totalRefs = null,
            .isEdge = edgeType,
        };

        if (!idIsSet) {
            size += 5;
            result.id = id;
            idIsSet = true;

            if (score != null) {
                size += 1;
            }
        }

        //     if (score.? < ctx.highScore) {
        //         ctx.highScore = score.?;
        //         try ctx.results.insert(0, result);
        //     } else if (score.? == ctx.highScore) {
        //         // sort check
        //         try ctx.results.append(result);

        //         // try ctx.results.insert(1, result);
        //     } else {
        //         if (score.? < ctx.lowScore and score.? > ctx.highScore) {
        //             ctx.lowScore = score.?;
        //         }
        //         try ctx.results.append(result);
        //     }
        // } else {
        try ctx.results.append(result);
        // }
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id);
    }

    return size;
}
