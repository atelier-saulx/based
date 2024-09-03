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
    ctx: *QueryCtx,
    id: u32,
    typeEntry: *selva.SelvaTypeEntry,
    start: ?u16,
    include: []u8,
    refLvl: u8,
) !usize {
    const selvaNodeNull = db.getNode(id, typeEntry);

    if (selvaNodeNull == null) {
        // std.debug.print("CANT FIND ID {d}\n", .{id});
        return 0;
    }

    const selvaNode: *selva.SelvaNode = selvaNodeNull.?;

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
            if (main == null) {
                main = db.selvaGetField(selvaNode, try db.selvaGetFieldSchema(0, typeEntry));
                if (main.?.len > 0 and !idIsSet and start == null) {
                    idIsSet = true;
                    size += try addIdOnly(ctx, id, refLvl, start);
                }
            }
            if (main.?.len == 0) {
                continue :includeField;
            }
            size += getSingleRefFields(ctx, singleRef, main.?, refLvl, hasFields);
            continue :includeField;
        }

        if (field == 0) {
            const mainIncludeSize = readInt(u16, operation, 0);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        }

        const value = db.selvaGetField(selvaNode, try db.selvaGetFieldSchema(field, typeEntry));

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
            size += (value.len + 3);
        }

        var result: results.Result = .{
            .id = id,
            .field = field,
            .val = value,
            .start = start,
            .includeMain = includeMain,
            .refLvl = refLvl,
        };

        if (start == null) {
            if (!idIsSet) {
                idIsSet = true;
                size += 1 + 4;
            } else {
                result.id = null;
            }
        }

        try ctx.results.append(result);
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id, refLvl, start);
    }

    return size;
}
