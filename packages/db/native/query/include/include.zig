const results = @import("../results.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./includeSingleRef.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("../../utils.zig").readInt;
const getField = db.getField;
const db = @import("../../db//db.zig");

const std = @import("std");

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    refField: ?u8,
    include: []u8,
    refLvl: u8,
    fromNoFields: bool,
) !usize {
    var includeMain: []u8 = &.{};
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var idIsSet: bool = false;
    var main: ?[]u8 = null;

    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];
        includeIterator += 1;

        const operation = include[includeIterator..];

        if (field == 255) {
            const hasFields: bool = operation[0] == 1;
            const refSize = readInt(u16, operation, 1);
            const singleRef = operation[3 .. 3 + refSize];
            includeIterator += refSize + 3;

            if (!idIsSet) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, refLvl, refField);
            }

            const refResultSize = getSingleRefFields(ctx, singleRef, node, refLvl, hasFields);

            size += refResultSize;

            if (fromNoFields) {
                // else it counts it double for some wierd reason...
                size -= 5;
            }

            continue :includeField;
        }

        std.debug.print("Snurp FIELD {d} \n", .{field});

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
            .id = id,
            .field = field,
            .val = value,
            .refField = refField,
            .includeMain = includeMain,
            .refLvl = refLvl,
        };

        if (refField == null) {
            if (!idIsSet) {
                idIsSet = true;
                size += 1 + 4;
            } else {
                result.id = null;
            }
        } else if (!idIsSet) {
            idIsSet = true;
        }

        std.debug.print("ADD RESULT {any} \n", .{result});

        try ctx.results.append(result);
    }

    if (!idIsSet) {
        idIsSet = true;
        if (refField != null) {
            if (!fromNoFields) {
                std.debug.print("ADD ID lvl {d} \n", .{refLvl});

                // pretty nice to just add the size here
                _ = try addIdOnly(ctx, id, refLvl, refField);
            }
        } else {
            std.debug.print("ADD ID NORMAL \n", .{});

            size += try addIdOnly(ctx, id, refLvl, refField);
        }
    }

    return size;
}
