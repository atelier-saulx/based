const c = @import("../c.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const QueryCtx = @import("./types.zig").QueryCtx;
const utils = @import("../utils.zig");
const t = @import("../types.zig");
const std = @import("std");
const selva = @import("../selva.zig");

const copy = utils.copy;
const read = utils.read;
const writeInt = utils.writeInt;

// Add comptime for SCORE to reduce the size of this
pub const Result = struct {
    id: ?u32,
    field: u8,
    type: t.ResultType,
    score: ?[4]u8, // TODO use comptime for results for search - bit shitty to make in query but another 4 bytes saved
    val: ?[]u8,
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

    var data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 8];
    var i: usize = 4;

    writeInt(u32, data, 0, ctx.totalResults);

    for (ctx.results.items) |*item| {
        switch (item.type) {
            t.ResultType.aggregate => {
                if (item.id != null) {
                    data[i] = @intFromEnum(t.ReadOp.ID);
                    i += 1;
                    writeInt(u32, data, i, item.id.?);
                    i += 4;
                    if (item.score != null) {
                        copy(data[i .. i + 4], &item.score.?);
                        i += 4;
                    }
                }
                data[i] = @intFromEnum((t.ReadOp.REFERENCES_AGGREGATION));
                i += 1;
            },
            t.ResultType.none => {
                if (item.id != null) {
                    data[i] = @intFromEnum(t.ReadOp.ID);
                    i += 1;
                    writeInt(u32, data, i, item.id.?);
                    i += 4;
                    if (item.score != null) {
                        copy(data[i .. i + 4], &item.score.?);
                        i += 4;
                    }
                }
            },
            t.ResultType.edge => {
                if (item.id != null) {
                    data[i] = @intFromEnum(t.ReadOp.ID);
                    i += 1;
                    writeInt(u32, data, i, item.id.?);
                    i += 4;
                    if (item.score != null) {
                        copy(data[i .. i + 4], &item.score.?);
                        i += 4;
                    }
                }
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
            },
            t.ResultType.reference => {
                //  Single Reference Protocol Schema:
                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (254)           |
                // | 1       | field     | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                data[i] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 1] = item.field;
                if (item.val) |v| {
                    copy(data[i + 2 .. i + 6], v);
                }
                i += 6;
                continue;
            },
            t.ResultType.references => {
                //  Multiple References Protocol Schema:
                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (253)           |
                // | 1       | field     | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                // | 6       | totalRefs | 4           | Total number of references (u32)     |
                data[i] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 1] = item.field;
                if (item.val) |v| {
                    copy(data[i + 2 .. i + 10], v);
                }
                i += 10;
                continue;
            },
            t.ResultType.referenceEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                data[i] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 1] = item.field;
                if (item.val) |v| {
                    copy(data[i + 2 .. i + 6], v);
                }
                i += 6;
                continue;
            },
            t.ResultType.referencesEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                data[i] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 1] = item.field;
                if (item.val) |v| {
                    copy(data[i + 2 .. i + 6], v);
                }
                i += 10;
                continue;
            },
        }

        if (item.field == @intFromEnum(t.ReadOp.ID) or item.val == null) {
            continue;
        }

        data[i] = item.field;
        i += 1;

        const val = item.val.?;

        if (item.field == t.MAIN_PROP) {
            copy(data[i .. i + val.len], val);
            i += val.len;
        } else {
            writeInt(u32, data, i, val.len);
            i += 4;
            copy(data[i .. i + val.len], val);
            i += val.len;
        }
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
