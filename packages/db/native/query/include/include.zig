const results = @import("../results.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./includeSingleRef.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("../../utils.zig").readInt;
const getField = db.getField;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./includeRefs.zig").getRefsFields;

const std = @import("std");

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
) !usize {
    var includeMain: []u8 = &.{};
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var idIsSet: bool = false;
    var main: ?[]u8 = null;

    std.debug.print("ZIG INCLUDE!\n", .{});

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];
        includeIterator += 1;

        const operation = include[includeIterator..];

        if (field == 254) {
            const refSize = readInt(u16, operation, 0);
            const multiRefs = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += getRefsFields(ctx, multiRefs, node);
            continue :includeField;
        }

        if (field == 255) {
            const refSize = readInt(u16, operation, 0);
            const singleRef = operation[2 .. 2 + refSize];
            includeIterator += refSize + 2;
            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id);
            }
            size += getSingleRefFields(ctx, singleRef, node);
            continue :includeField;
        }

        if (field == 0) {
            const mainIncludeSize = readInt(u16, operation, 0);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        }

        const value = db.getField(node, try db.getFieldSchema(field, typeEntry));

        if (value.len == 0) {
            continue :includeField;
        }

        if (field == 0) {
            main = value;
            if (includeMain.len != 0) {
                size += readInt(u16, includeMain, 0) + 1;
            } else {
                size += (value.len + 1);
            }
        } else {
            size += (value.len + 5);
        }

        var result: results.Result = .{
            .id = null,
            .field = field,
            .val = value,
            .refSize = null,
            .includeMain = includeMain,
            .refType = null,
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
