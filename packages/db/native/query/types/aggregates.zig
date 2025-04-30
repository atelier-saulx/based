const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;

const c = @import("../../c.zig");

pub const AggType = enum(u8) { SUM = 1, _ };

pub fn default(env: c.napi_env, ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, aggInput: []u8) !c.napi_value {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);

    const resultsSize = read(u16, aggInput, 0);

    std.debug.print("results have the size of {d} \n", .{resultsSize});

    ctx.size = resultsSize;

    const agg = aggInput[2..aggInput.len];

    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }

    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];

    // create result buffer space here

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node) |n| {
            // means error...

            if (!filter(ctx.db, n, typeEntry, conditions, null, null, 0, false)) {
                continue :checkItem;
            }

            // std.debug.print("GOT AGG FOR FIELD {any} \n", .{agg});

            var i: usize = 0;
            while (i < agg.len) {
                const field = agg[i];
                const fieldSchema = try db.getFieldSchema(field, typeEntry);
                const value = db.getField(typeEntry, db.getNodeId(n), n, fieldSchema, types.Prop.MICRO_BUFFER);
                if (value.len == 0) {
                    continue :checkItem;
                }
                i += 1;
                const fieldAggsSize = read(u16, agg, i);
                i += 2;
                const aggPropDef = agg[i .. i + fieldAggsSize];
                var j: usize = 0;
                while (j < fieldAggsSize) {
                    const aggType: AggType = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const propType: types.Prop = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const start = read(u16, aggPropDef, j);
                    j += 2;
                    const resultPos = read(u16, aggPropDef, j);
                    j += 2;

                    if (aggType == AggType.SUM) {
                        // ok put on buffer
                        if (propType == types.Prop.UINT8) {

                            // gotto go fast
                            // Adds lots of useless stack allocation we want to increment IN MEMORY
                            const currentResult = read(u32, data, resultPos);
                            writeInt(u32, data, resultPos, currentResult + value[start]);

                            // resultNumber += value[start];
                        } else {
                            // later..
                        }
                    }

                    // std.debug.print("Resultpos {d} FIELD {any} size {any} {any} {any} {d} \n", .{ resultPos, field, fieldAggsSize, aggType, propType, start });
                }
                i += fieldAggsSize;
            }
        } else {
            // means error
            break :checkItem;
        }
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));

    return result;
}
