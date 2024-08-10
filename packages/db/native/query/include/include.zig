const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const getField = @import("../../db/db.zig").getField;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getSingleRefFields = @import("./includeSingleRef.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const readInt = @import("std").mem.readInt;

pub fn getFields(
    ctx: QueryCtx,
    id: u32,
    typePrefix: [2]u8,
    start: ?u16,
    include: []u8,
    currentShard: u16,
    refLvl: u8,
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
            const refSize = readInt(u16, operation[1..3], .little);
            const singleRef = operation[3 .. 3 + refSize];
            includeIterator += refSize + 3;
            if (main == null) {
                main = getField(id, 0, typePrefix, currentShard, ctx.id);
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
            const mainIncludeSize = readInt(u16, operation[0..2], .little);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        }

        const value = getField(id, field, typePrefix, currentShard, ctx.id);
        if (value.len == 0) {
            continue :includeField;
        }

        if (field == 0) {
            main = value;
            if (includeMain.len != 0) {
                size += readInt(u16, includeMain[0..2], .little) + 1;
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

    if (size == 0 and !idIsSet) {
        if (main == null) {
            main = getField(id, 0, typePrefix, currentShard, ctx.id);
            if (main.?.len > 0) {
                idIsSet = true;
                size += try addIdOnly(ctx, id, refLvl, start);
            }
        }
        if (main.?.len > 0) {
            const idSize = try addIdOnly(ctx, id, refLvl, start);
            if (start == null) {
                size += idSize;
            }
        }
    }

    return size;
}
