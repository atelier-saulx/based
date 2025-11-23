const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const Query = @import("./common.zig");
const utils = @import("../utils.zig");
const std = @import("std");
const selva = @import("../selva.zig").c;
const getResultSlice = @import("../db/threads.zig").getResultSlice;

const copy = utils.copy;
const read = utils.read;
const write = utils.write;

const t = @import("../types.zig");

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
    data[i.*] = @intFromEnum(t.ReadOp.meta);
    i.* += 1;
    data[i.*] = item.*.prop;
    i.* += 1;
    const v = item.*.value;
    data[i.*] = v[0];
    i.* += 1;
    data[i.*] = v[1];
    i.* += 1;
    copy(u8, data, v[v.len - 4 .. v.len], i.*);
    if (v[1] == 1) {
        copy(u8, data, v[2..6], i.* + 4);
    } else {
        write(u32, data, @truncate(v.len), i.* + 4);
    }
    i.* += 8;
}

pub fn createResultsBuffer(
    ctx: *Query.QueryCtx,
    op: t.OpType,
) !void {
    const size = ctx.size + 8;

    var i: usize = 4;

    const data = try getResultSlice(true, ctx.threadCtx, size, ctx.id, op);

    write(u32, data, @truncate(ctx.totalResults), 0);

    for (ctx.results.items) |*item| {
        // Always start with id
        if (item.id != 0) {
            data[i] = @intFromEnum(t.ReadOp.id);
            write(u32, data, item.id, i + 1);
            i += 5;
            if (item.score) |s| {
                copy(u8, data, &s, i);
                i += 4;
            }
        }

        switch (item.type) {
            t.ResultType.aggregate => {
                data[i] = @intFromEnum((t.ReadOp.aggregation));
                data[i + 1] = item.prop;
                write(u32, data, @truncate(item.value.len), i + 2);
                copy(u8, data, item.value, i + 6);
                i += item.value.len + 6;
            },
            t.ResultType.edgeFixed => {
                data[i] = @intFromEnum(t.ReadOp.edge);
                data[i + 1] = item.prop;
                copy(u8, data, item.value, i + 2);
                i += item.value.len + 2;
            },
            t.ResultType.metaEdge => {
                data[i] = @intFromEnum(t.ReadOp.edge);
                i += 1;
                addChecksum(item, data, &i);
            },
            t.ResultType.meta => {
                addChecksum(item, data, &i);
            },
            t.ResultType.edge => {
                data[i] = @intFromEnum(t.ReadOp.edge);
                data[i + 1] = item.prop;
                write(u32, data, @truncate(item.value.len), i + 2);
                copy(u8, data, item.value, i + 6);
                i += item.value.len + 6;
            },
            t.ResultType.fixed => {
                if (item.prop == @intFromEnum(t.ReadOp.id)) {
                    continue;
                }
                data[i] = item.prop;
                copy(u8, data, item.value, i + 1);
                i += item.value.len + 1;
            },
            t.ResultType.default => {
                if (item.prop == @intFromEnum(t.ReadOp.id)) {
                    continue;
                }
                data[i] = item.prop;
                write(u32, data, @truncate(item.value.len), i + 1);
                copy(u8, data, item.value, i + 5);
                i += item.value.len + 5;
            },
            t.ResultType.reference => {
                //  Single Reference Protocol Schema:
                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (254)           |
                // | 1       | prop      | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                data[i] = @intFromEnum(t.ReadOp.references);
                data[i + 1] = item.prop;
                copy(u8, data, item.value, i + 2);
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
                data[i] = @intFromEnum(t.ReadOp.references);
                data[i + 1] = item.prop;
                copy(u8, data, item.value, i + 2);
                i += 10;
            },
            t.ResultType.referenceEdge => {
                data[i] = @intFromEnum(t.ReadOp.edge);
                data[i + 1] = @intFromEnum(t.ReadOp.reference);
                data[i + 2] = item.prop;
                copy(u8, data, item.value, i + 3);
                i += 7;
            },
            t.ResultType.referencesEdge => {
                data[i] = @intFromEnum(t.ReadOp.edge);
                data[i + 1] = @intFromEnum(t.ReadOp.references);
                data[i + 2] = item.prop;
                copy(u8, data, item.value, i + 3);
                i += 11;
            },
        }
    }

    write(u32, data, selva.crc32c(4, data.ptr, data.len - 4), data.len - 4);
}
