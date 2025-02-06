const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const std = @import("std");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const IncludeOp = types.IncludeOp;
const selva = @import("../../selva.zig");

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
    edgeRef: ?types.RefStruct,
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
                .reference = edgeRef.?.reference,
                .edgeConstaint = edgeRef.?.edgeConstaint,
                .edgeReference = null,
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
            size += getRefsFields(
                ctx,
                multiRefs,
                node,
                typeEntry,
                edgeRef,
                isEdge,
            );
            continue :includeField;
        }

        if (op == IncludeOp.reference) {
            const refSize = readInt(u16, operation, 0);
            const singleRef = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += getSingleRefFields(
                ctx,
                singleRef,
                node,
                typeEntry,
                edgeRef,
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

        var fieldSchema: *const selva.SelvaFieldSchema = undefined;
        if (isEdge) {
            fieldSchema = try db.getEdgeFieldSchema(edgeRef.?.edgeConstaint, field);
            edgeType = @enumFromInt(fieldSchema.*.type);
            value = db.getEdgeProp(edgeRef.?.reference.?, fieldSchema);
        } else {
            fieldSchema = try db.getFieldSchema(field, typeEntry);
            value = db.getField(
                typeEntry,
                id,
                node,
                fieldSchema,
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

        if (field != 0 and fieldSchema.*.type == selva.SELVA_FIELD_TYPE_TEXT) {
            const textTmp: *[*]const [selva.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
            const text = textTmp.*[0 .. value[8]];
            for (text) |tl| {
                const ss: * const selva.selva_string = @ptrCast(&tl);
                var len: usize = undefined;
                const str: [*]const u8 = selva.selva_string_to_str(ss, &len);
                const s = @as([*]u8, @constCast(str))[2 .. len];
                std.log.err("tl: \"{s}\"", .{s});

                // TODO
            }
        }

        var result: results.Result = .{
            .id = null,
            .score = null,
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
                result.score = score;
                size += 1;
            }
        }

        try ctx.results.append(result);
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id);
    }

    return size;
}
