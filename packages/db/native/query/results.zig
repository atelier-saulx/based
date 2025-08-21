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

// need to know what kind of field this is might add typeIndex

const HEADER_SIZE = 8;

// handle meta
fn addChecksum(item: *const *Result, data: []u8) usize {
    var offset: usize = 0;
    data[offset] = @intFromEnum(t.ReadOp.META);
    offset += 1;
    data[offset] = item.*.field;
    offset += 1;
    if (item.*.val) |v| {
        data[offset] = v[1];
        offset += 1;
        utils.copy(data[offset .. offset + 4], v[v.len - 4 .. v.len]);
        writeInt(u32, data, offset + 4, v.len);
    }
    offset += 8;
    return offset;
}

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

        // Always start with id
        if (item.id) |id| {
            data[i] = @intFromEnum(t.ReadOp.ID);
            i += 1;
            writeInt(u32, data, i, id);
            i += 4;
            if (item.score) |s| {
                copy(data[i .. i + 4], &s);
                i += 4;
            }
        }

        switch (item.type) {
            t.ResultType.aggregate => {
                data[i] = @intFromEnum((t.ReadOp.REFERENCES_AGGREGATION));
                i += 1;
            },
            t.ResultType.edge => {
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
            t.ResultType.metaEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                i += addChecksum(&item, data[i..]);
                continue;
            },
            t.ResultType.meta => {
                i += addChecksum(&item, data[i..]);
                continue;
            },
            t.ResultType.none => {
                // Do nothing
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
