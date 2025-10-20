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

// Not inline because its not a common path
fn addChecksum(item: *Result, data: []u8, i: *usize) void {
    data[i.*] = @intFromEnum(t.ReadOp.META);
    i.* += 1;
    data[i.*] = item.*.prop;
    i.* += 1;
    const v = item.*.value;
    data[i.*] = v[0];
    i.* += 1;
    data[i.*] = v[1];
    i.* += 1;
    utils.copy(data[i.* .. i.* + 4], v[v.len - 4 .. v.len]);
    if (v[1] == 1) {
        utils.copy(data[i.* + 4 .. i.* + 8], v[2..6]);
    } else {
        writeInt(u32, data, i.* + 4, v.len);
    }
    i.* += 8;
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
            writeInt(u32, data, i + 1, item.id);
            i += 5;
            if (item.score) |s| {
                copy(data[i .. i + 4], &s);
                i += 4;
            }
        }

        switch (item.type) {
            t.ResultType.aggregate => {
                data[i] = @intFromEnum((t.ReadOp.REFERENCES_AGGREGATION));
                data[i + 1] = item.prop;
                writeInt(u32, data, i + 2, item.value.len);
                copy(data[i + 6 .. i + 6 + item.value.len], item.value);
                i += item.value.len + 6;
            },
            t.ResultType.edgeFixed => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                data[i + 1] = item.prop;
                copy(data[i + 2 .. i + 2 + item.value.len], item.value);
                i += item.value.len + 2;
            },
            t.ResultType.metaEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                i += 1;
                addChecksum(item, data, &i);
            },
            t.ResultType.meta => {
                addChecksum(item, data, &i);
            },
            t.ResultType.edge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                data[i + 1] = item.prop;
                writeInt(u32, data, i + 2, item.value.len);
                copy(data[i + 6 .. i + 6 + item.value.len], item.value);
                i += item.value.len + 6;
            },
            t.ResultType.fixed => {
                if (item.prop == @intFromEnum(t.ReadOp.ID)) {
                    continue;
                }
                data[i] = item.prop;
                copy(data[i + 1 .. i + 1 + item.value.len], item.value);
                i += item.value.len + 1;
            },
            t.ResultType.default => {
                if (item.prop == @intFromEnum(t.ReadOp.ID)) {
                    continue;
                }
                data[i] = item.prop;
                writeInt(u32, data, i + 1, item.value.len);
                copy(data[i + 5 .. i + 5 + item.value.len], item.value);
                i += item.value.len + 5;
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
            },
            t.ResultType.referenceEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                data[i + 1] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 2] = item.prop;
                copy(data[i + 3 .. i + 7], item.value);
                i += 7;
            },
            t.ResultType.referencesEdge => {
                data[i] = @intFromEnum(t.ReadOp.EDGE);
                data[i + 1] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 2] = item.prop;
                copy(data[i + 3 .. i + 7], item.value);
                i += 11;
            },
        }
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
