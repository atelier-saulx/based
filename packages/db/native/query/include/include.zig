const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const read = @import("../../utils.zig").read;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const std = @import("std");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const IncludeOp = types.IncludeOp;
const selva = @import("../../selva.zig");

inline fn addResult(
    field: u8,
    value: []u8,
    main: ?[]u8,
    edgeType: t.Prop,
) results.Result {
    return .{
        .id = null,
        .score = null,
        .field = field,
        .val = value,
        .refSize = null,
        .includeMain = main,
        .refType = null,
        .totalRefs = null,
        .isEdge = edgeType,
    };
}

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
    edgeRef: ?types.RefStruct,
    score: ?[4]u8,
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
            const edgeSize = read(u16, operation, 0);
            const edges = operation[2 .. 2 + edgeSize];
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, score);
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
            const refSize = read(u16, operation, 0);
            const multiRefs = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, score);
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
            const refSize = read(u16, operation, 0);
            const singleRef = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, score);
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

        var prop: t.Prop = undefined;

        // MAIN
        if (field == 0) {
            prop = t.Prop.MICRO_BUFFER;
            const mainIncludeSize = read(u16, operation, 0);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        } else {
            prop = @enumFromInt(operation[0]);
            includeIterator += 1;
        }

        var value: []u8 = undefined;

        var fieldSchema: *const selva.SelvaFieldSchema = undefined;

        if (prop == t.Prop.CARDINALITY) {
            if (isEdge) {
                // do this later!
            } else {
                fieldSchema = try db.getFieldSchema(field, typeEntry);
                const stored = selva.selva_fields_get_selva_string(node, fieldSchema);
                if (stored == null) {
                    continue :includeField;
                }
                const countDistinct = selva.hll_count(@ptrCast(stored));
                value = countDistinct[0..4];
            }
        } else if (isEdge) {
            fieldSchema = try db.getEdgeFieldSchema(ctx.db.selva.?, edgeRef.?.edgeConstaint, field);
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
            if (prop == t.Prop.TEXT) {
                includeIterator += 1;
            }
            continue :includeField;
        }

        if (prop == t.Prop.TEXT) {
            const code: t.LangCode = @enumFromInt(include[includeIterator]);
            includeIterator += 1;
            var iter = db.textIterator(value, code);
            while (iter.next()) |s| {
                if (isEdge) {
                    size += (s.len + 6);
                } else {
                    size += (s.len + 5);
                }
                var result = addResult(field, s, includeMain, edgeType);
                if (!idIsSet) {
                    size += 5;
                    result.id = id;
                    idIsSet = true;
                    if (score != null) {
                        result.score = score;
                        size += 4;
                    }
                }
                try ctx.results.append(result);
            }
        } else {
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
                    size += read(u16, includeMain.?, 0) + 1;
                } else {
                    size += (valueLen + 1);
                }
            } else {
                size += (valueLen + 5);
            }
            var result = addResult(field, value, includeMain, edgeType);
            if (!idIsSet) {
                size += 5;
                result.id = id;
                idIsSet = true;
                if (score != null) {
                    result.score = score;
                    size += 4;
                }
            }
            try ctx.results.append(result);
        }
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id, score);
    }

    return size;
}
