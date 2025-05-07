const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const utils = @import("../../utils.zig");
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const aggregateRefsFields = @import("../aggregate/references.zig").aggregateRefsFields;
const std = @import("std");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const selva = @import("../../selva.zig");
const read = utils.read;

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
        .aggregateResult = null,
    };
}

pub fn getFields(node: db.Node, ctx: *QueryCtx, id: u32, typeEntry: db.Type, include: []u8, edgeRef: ?types.RefStruct, score: ?[4]u8, comptime isEdge: bool) !usize {
    var includeMain: ?[]u8 = null;
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var main: ?[]u8 = null;
    var idIsSet: bool = isEdge;
    var edgeType: t.Prop = t.Prop.NULL;

    includeField: while (includeIterator < include.len) {
        const op: t.IncludeOp = @enumFromInt(include[includeIterator]);
        includeIterator += 1;
        const operation = include[includeIterator..];
        if (op == t.IncludeOp.edge) {
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

        if (op == t.IncludeOp.references) {
            const refSize = read(u16, operation, 0);
            const multiRefs = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, score);
            }

            size += getRefsFields(ctx, multiRefs, node, typeEntry, edgeRef, isEdge);
            continue :includeField;
        }

        if (op == t.IncludeOp.reference) {
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

        // if aggregate references call a function form the folder aggregates / references.zig
        if (op == t.IncludeOp.referencesAggregation) {
            utils.debugPrint("split paths\n", .{});
            const refSize = read(u16, operation, 0);
            const multiRefs = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;

            size += aggregateRefsFields(ctx, multiRefs, node, typeEntry, isEdge);
            return size;
        }

        const field: u8 = @intFromEnum(op);
        var prop: t.Prop = undefined;
        var fieldSchema: *const selva.SelvaFieldSchema = undefined;
        var value: []u8 = undefined;

        if (field == t.MAIN_PROP) {
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

        if (isEdge) {
            if (edgeRef.?.edgeConstaint == null) {
                std.log.err("Trying to get an edge field from a weakRef (4) \n", .{});
                // Is a edge ref cant filter on an edge field!
                return 11;
            }

            fieldSchema = try db.getEdgeFieldSchema(ctx.db.selva.?, edgeRef.?.edgeConstaint.?, field);
            edgeType = @enumFromInt(fieldSchema.*.type);
            if (prop == t.Prop.CARDINALITY) {
                value = db.getCardinalityReference(edgeRef.?.reference.?, fieldSchema);
            } else {
                value = db.getEdgeProp(edgeRef.?.reference.?, fieldSchema);
            }
        } else {
            fieldSchema = try db.getFieldSchema(field, typeEntry);
            value = db.getField(typeEntry, id, node, fieldSchema, prop);
        }

        var valueLen = value.len;

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
                    size += (s.len + 6 - 4);
                } else {
                    size += (s.len + 5 - 4);
                }
                var result = addResult(field, s[0 .. s.len - 4], includeMain, edgeType);
                if (!idIsSet) {
                    size += 9;
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
            if (prop == t.Prop.STRING) {
                // strip crc32
                valueLen = valueLen - 4;
                value = value[0..valueLen];
            }

            if (isEdge) {
                // double check if this ok
                size += 1;
            }

            if (field == t.MAIN_PROP) {
                main = value;
                if (includeMain) |incMain| {
                    if (incMain.len != 0) {
                        size += read(u16, incMain, 0) + 1;
                    }
                } else {
                    size += (valueLen + 1);
                }
            } else {
                size += (valueLen + 5);
            }

            var result = addResult(field, value, includeMain, edgeType);
            if (!idIsSet) {
                size += 9;
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
