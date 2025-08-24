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

pub const Result = struct {
    id: u32,
    prop: u8,
    type: t.ResultType,
    score: ?[4]u8, // TODO use comptime for results for search - bit shitty to make in query but another 4 bytes saved
    value: []u8,
};

const HEADER_SIZE = 8;

// handle meta
fn addChecksum(item: *const *Result, data: []u8) usize {
    var offset: usize = 0;
    data[offset] = @intFromEnum(t.ReadOp.META);
    offset += 1;
    data[offset] = item.*.prop;
    offset += 1;
    const v = item.*.value;
    data[offset] = v[0]; // tmp
    offset += 1;
    data[offset] = v[1];
    offset += 1;
    utils.copy(data[offset .. offset + 4], v[v.len - 4 .. v.len]);
    writeInt(u32, data, offset + 4, v.len);
    offset += 8;
    // add language here then we have it
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
        if (item.id != 0) {
            data[i] = @intFromEnum(t.ReadOp.ID);
            i += 1;
            writeInt(u32, data, i, item.id);
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
                // | 1       | prop      | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                data[i] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 1] = item.prop;
                copy(data[i + 2 .. i + 6], item.value);
                i += 6;
                continue;
            },
            t.ResultType.references => {
                //  Multiple References Protocol Schema:
                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (253)           |
                // | 1       | prop      | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                // | 6       | totalRefs | 4           | Total number of references (u32)     |
                data[i] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 1] = item.prop;
                copy(data[i + 2 .. i + 10], item.value);
                i += 10;
                continue;
            },
            t.ResultType.referenceEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                data[i] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 1] = item.prop;
                copy(data[i + 2 .. i + 6], item.value);
                i += 6;
                continue;
            },
            t.ResultType.referencesEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                data[i] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 1] = item.prop;
                copy(data[i + 2 .. i + 6], item.value);
                i += 10;
                continue;
            },
            t.ResultType.metaEdge => {
                // only / or not only
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                i += addChecksum(&item, data[i..]);
                continue;
            },
            t.ResultType.meta => {
                // only / or not only
                i += addChecksum(&item, data[i..]);
                continue;
            },
            t.ResultType.none => {
                // Do nothing
            },
        }

        if (item.prop == @intFromEnum(t.ReadOp.ID)) {
            continue;
        }

        data[i] = item.prop;
        i += 1;

        const value = item.value;

        if (item.prop == t.MAIN_PROP) {
            copy(data[i .. i + value.len], value);
            i += value.len;
        } else {
            writeInt(u32, data, i, value.len);
            i += 4;
            copy(data[i .. i + value.len], value);
            i += value.len;
        }
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
