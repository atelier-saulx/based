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

// Add comptime to reduce the size of this
pub const Result = struct {
    id: ?u32, // 4
    field: u8, // 1
    refType: t.ReadRefOp, // 1
    refSize: u32, // use u32
    totalRefs: u32, // use u32
    isEdge: t.Prop, // 1
    score: ?[4]u8, // 4 - do this with comptime var - would expect 35 (is 69...)
    val: ?[]u8, // 8 (or more?)
    includeMain: ?[]u8, // 8
};

// pub const ResultSmaller = struct {
//     id: ?u32, // 4
//     field: u8, // 1
//     refType: t.ReadRefOp, // 1
//     val: ?[]u8, // 16 (or more?)
//     refSize: u32, // use u32
//     includeMain: ?[]u8, // 16
//     totalRefs: u32, // use u32
//     isEdge: t.Prop, // 1
//     score: ?[4]u8,
//     // score: u32, // 4 - do this with comptime var - would expect 35 (is 69...)
// };
// std.debug.print("size of result {any} {any} \n", .{ @sizeOf(Result), @sizeOf(ResultSmaller) });

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
        switch (item.refType) {
            t.ReadRefOp.none => {
                // do nothing
            },
            t.ReadRefOp.REFERENCE => {
                if (item.isEdge != t.Prop.NULL) {
                    data[i] = @intFromEnum(t.ReadOp.EDGE);
                    i += 1;
                }

                //  Single Reference Protocol Schema:

                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (254)           |
                // | 1       | field     | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |

                data[i] = @intFromEnum(t.ReadOp.REFERENCE);
                data[i + 1] = item.field;
                writeInt(u32, data, i + 2, item.refSize);
                i += 6;
                continue;
            },
            t.ReadRefOp.REFERENCES => {
                if (item.isEdge != t.Prop.NULL) {
                    data[i] = @intFromEnum(t.ReadOp.EDGE);
                    i += 1;
                }

                //  Multiple References Protocol Schema:

                // | Offset  | Field     | Size (bytes)| Description                          |
                // |---------|-----------|-------------|--------------------------------------|
                // | 0       | op        | 1           | Operation identifier (253)           |
                // | 1       | field     | 1           | Field identifier                     |
                // | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |
                // | 6       | totalRefs | 4           | Total number of references (u32)     |

                data[i] = @intFromEnum(t.ReadOp.REFERENCES);
                data[i + 1] = item.field;
                writeInt(u32, data, i + 2, item.refSize);
                writeInt(u32, data, i + 6, item.totalRefs);
                i += 10;
                continue;
            },
        }

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

        if (item.field == @intFromEnum(t.ReadOp.ID) or item.val == null) {
            continue;
        }

        if (item.isEdge != t.Prop.NULL) {
            data[i] = @intFromEnum(t.ReadOp.EDGE);
            i += 1;
        }

        data[i] = item.field;
        i += 1;

        const val = item.val.?;

        if (item.field == t.MAIN_PROP) {
            if (item.includeMain != null and item.includeMain.?.len != 0) {
                var mainPos: usize = 2;
                while (mainPos < item.includeMain.?.len) {
                    const operation = item.includeMain.?[mainPos..];
                    const start = read(u16, operation, 0);
                    const len = read(u16, operation, 2);
                    copy(data[i .. i + len], val[start .. start + len]);
                    i += len;
                    mainPos += 4;
                }
            } else {
                copy(data[i .. i + val.len], val);
                i += val.len;
            }
        } else {
            writeInt(u32, data, i, val.len);
            i += 4;
            copy(data[i .. i + val.len], val);
            i += val.len;
        }
    }

    if (i > data.len - 4) {
        utils.debugPrint("Wrong writing of result buffer i:{d} \n", .{i});
    }

    // std.debug.print("flap {any} {any} \n", .{ data[4 .. data.len - 4], selva.crc32c(4, data.ptr, data.len - 8) });

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
