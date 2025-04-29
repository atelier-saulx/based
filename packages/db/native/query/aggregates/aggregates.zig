const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const s = @import("./statistics.zig");

pub fn getFields(node: db.Node, ctx: *QueryCtx, id: u32, typeEntry: db.Type, include: []u8, aggregation: AggFn) !usize {
    var includeIterator: u16 = 0;

    while (includeIterator < include.len) {
        const op: types.IncludeOp = @enumFromInt(include[includeIterator]);
        includeIterator += 1;
        const operation = include[includeIterator..];
        utils.debugPrint("types > aggregates.zig > aggregation: {any}\n", .{aggregation});

        const field: u8 = @intFromEnum(op);
        var prop: types.Prop = undefined;
        var fieldSchema: *const selva.SelvaFieldSchema = undefined;
        var value: []u8 = undefined;

        if (field == types.MAIN_PROP) {
            prop = types.Prop.MICRO_BUFFER;
            const mainIncludeSize = read(u16, operation, 0);
            includeIterator += 2 + mainIncludeSize;
        } else {
            prop = @enumFromInt(operation[0]);
            includeIterator += 1;
        }

        fieldSchema = try db.getFieldSchema(field, typeEntry);
        value = db.getField(typeEntry, id, node, fieldSchema, prop);
        // validateNumber
        // cast to f64
        s.acumulate(value);
    }

    ctx.size = 0;
    return 9;
}
