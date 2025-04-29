const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;

pub fn default(ctx: *QueryCtx, offset: u32, limit: u32, typeId: db.TypeId, conditions: []u8, aggFn: AggFn) !void {
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
        utils.debugPrint("aggregate > offset: {d}{any}\n", .{ offset, aggFn }); // just to keep for now
        const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, conditions, aggFn);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn getFields(node: db.Node, ctx: *QueryCtx, id: u32, typeEntry: db.Type, include: []u8, aggregation: AggFn) !usize {
    var includeMain: ?[]u8 = null;
    var size: usize = 0;
    var includeIterator: u16 = 0;
    var main: ?[]u8 = null;

    includeField: while (includeIterator < include.len) {
        const op: types.IncludeOp = @enumFromInt(include[includeIterator]);
        includeIterator += 1;
        const operation = include[includeIterator..];
        utils.debugPrint("types > aggregates.zig > operation: {any}\n", .{operation});
        utils.debugPrint("types > aggregates.zig > aggregation: {any}\n", .{aggregation});

        const field: u8 = @intFromEnum(op);
        var prop: types.Prop = undefined;
        var fieldSchema: *const selva.SelvaFieldSchema = undefined;
        var value: []u8 = undefined;

        if (field == types.MAIN_PROP) {
            prop = types.Prop.MICRO_BUFFER;
            const mainIncludeSize = read(u16, operation, 0);
            if (mainIncludeSize != 0) {
                includeMain = operation[2 .. 2 + mainIncludeSize];
            }
            includeIterator += 2 + mainIncludeSize;
        } else {
            prop = @enumFromInt(operation[0]);
            includeIterator += 1;
        }

        fieldSchema = try db.getFieldSchema(field, typeEntry);
        value = db.getField(typeEntry, id, node, fieldSchema, prop);

        const valueLen = value.len;

        if (valueLen == 0) {
            if (prop == types.Prop.TEXT) {
                includeIterator += 1;
            }
            continue :includeField;
        }

        if (prop == types.Prop.TEXT) {
            // to check if it a number type prop
            // only future concat have effect
        } else {
            if (field == types.MAIN_PROP) {
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
        }
    }

    ctx.size = 0;
    return 9;
}
