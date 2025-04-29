const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;

pub fn default(ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, include: []u8, aggFn: AggFn) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);

    checkItem: while (ctx.totalResults < limit) { // MV: nstead of limit should stop in fields.len from def
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, aggFn);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

fn getFields(node: db.Node, ctx: *QueryCtx, id: u32, typeEntry: db.Type, include: []u8, aggregation: AggFn) !usize {
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
    }

    ctx.size = 0;
    return 9;
}
