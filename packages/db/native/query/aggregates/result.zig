const c = @import("../../c.zig");
const napi = @import("../../napi.zig");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const std = @import("std");
const selva = @import("../../selva.zig");

const copy = utils.copy;
const read = utils.read;
const writeInt = utils.writeInt;

pub const Result = struct {
    id: ?u32,
    field: u8,
    refType: ?t.ReadRefOp,
    val: ?[]u8,
    refSize: ?usize,
    includeMain: ?[]u8,
    totalRefs: ?usize,
    isEdge: t.Prop,
    score: ?[4]u8,
};

const HEADER_SIZE = 8;

pub fn createResultsBuffer(
    ctx: *QueryCtx,
    env: c.napi_env,
) !c.napi_value {
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_arraybuffer(env, ctx.size + HEADER_SIZE, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }

    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 8]; // MV: ctx.size could vary with number type

    if (ctx.aggResult) |r| {
        writeInt(u32, data, @as(usize, 0), r);
    } else {
        writeInt(u32, data, @as(usize, 0), 0.0);
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    // utils.debugPrint("aggregates / result.zig > results for js: {any}\n", .{data});
    return result;
}
