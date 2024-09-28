const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const std = @import("std");
const types = @import("./types.zig");

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
    ref: ?types.RefStruct,
    comptime isEdge: bool,
) !usize {
    var includeMain: ?[]u8 = null;
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var main: ?[]u8 = null;
    var idIsSet: bool = isEdge;
    var edgeType: u8 = 0;

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];
        includeIterator += 1;

        const operation = include[includeIterator..];
        if (field == 253) {
            const edgeSize = readInt(u16, operation, 0);
            const edges = operation[2 .. 2 + edgeSize];
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += try getFields(node, ctx, id, typeEntry, edges, .{
                .reference = ref.?.reference,
                .edgeConstaint = ref.?.edgeConstaint,
            }, true);
            includeIterator += edgeSize + 2;
            continue :includeField;
        }

        if (field == 254) {
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

        if (field == 255) {
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
            edgeType = edgeFieldSchema.*.type;
            value = db.getEdgeProp(ref.?.reference, edgeFieldSchema);
        } else {
            value = db.getField(node, try db.getFieldSchema(field, typeEntry));
        }

        const valueLen = value.len;

        if (valueLen == 0) {
            continue :includeField;
        }

        if (isEdge) {
            size += 2;
            if (edgeType == 11) {
                size += (valueLen + 4);
            } else if (edgeType == 10 or edgeType == 9) {
                size += 1;
            } else if (edgeType == 5) {
                size += 4;
            } else if (edgeType == 4 or edgeType == 1) {
                size += 8;
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
        }

        try ctx.results.append(result);
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id);
    }

    return size;
}
