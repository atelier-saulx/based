const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const s = @import("./statistics.zig");

pub fn getFields(node: db.Node, ctx: *QueryCtx, id: u32, typeEntry: db.Type, include: []u8, aggregation: AggFn, aggField: u16) !void {
    var includeIterator: u16 = 0;

    while (includeIterator < include.len) {
        const op: types.IncludeOp = @enumFromInt(include[includeIterator]);
        includeIterator += 1;
        const operation = include[includeIterator..];
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
        const checkField: u16 = @intCast(fieldSchema.field);
        if (checkField == aggField) {
            value = db.getField(typeEntry, id, node, fieldSchema, prop);
            if (aggregation == .sum) {
                // MV: bit uggly, no accum engine + u32, just temporary
                // trust that microbuffer isNumber (filtered in JS)?
                if (value.len >= @sizeOf(u32)) {
                    const val: u32 = read(u32, value, 0);
                    ctx.aggResult = if (ctx.aggResult) |r| r + val else val;
                }
            }
        }
    }
}
