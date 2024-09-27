const c = @import("../c.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const utils = @import("../utils.zig");

const std = @import("std");

const readInt = utils.readInt;
const writeInt = utils.writeInt;

pub const Result = struct {
    id: ?u32,
    field: u8,
    refType: ?u8, // 253 | 254
    val: ?[]u8,
    refSize: ?usize,
    includeMain: ?[]u8, // make this optional
    totalRefs: ?usize,
    isEdge: u8,
};

pub fn createResultsBuffer(
    ctx: *QueryCtx,
    env: c.napi_env,
) !c.napi_value {
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }

    var data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    var i: usize = 4;

    writeInt(u32, data, 0, ctx.totalResults);

    for (ctx.results.items) |*item| {
        if (item.refType != null) {
            if (item.refType == 254) {
                // SINGLE REF
                // op, field, bytes
                // [254, 2, 4531] // NULL if zero length
                data[i] = 254;
                data[i + 1] = item.field;
                writeInt(u32, data, i + 2, item.refSize.?);
                i += 6;
            } else if (item.refType == 253) {
                // MULTIPLE REFS
                // op, field, bytes, len (u32)  (max 4.2GB)
                // [253, 2, 2124, 10]
                data[i] = 253;
                data[i + 1] = item.field;
                writeInt(u32, data, i + 2, item.refSize.?);
                writeInt(u32, data, i + 6, item.totalRefs.?);
                i += 10;
            }
            continue;
        } else {
            if (item.id != null) {
                data[i] = 255;
                i += 1;
                writeInt(u32, data, i, item.id.?);
                i += 4;
            }
        }

        if (item.field == 255) {
            continue;
        }

        if (item.val == null) {
            continue;
        }

        if (item.isEdge > 0) {
            data[i] = 252;
            i += 1;
        }

        data[i] = item.field;
        i += 1;

        const val = item.val.?;

        if (item.isEdge > 0 and item.isEdge < 11) {
            if (item.isEdge == 10 or item.isEdge == 9) {
                data[i] = val[0];
                i += 1;
            } else if (item.isEdge == 5) {
                @memcpy(data[i .. i + val.len], val);
                i += 4;
            } else if (item.isEdge == 4 or item.isEdge == 1) {
                @memcpy(data[i .. i + val.len], val);
                i += 8;
            }
        } else if (item.field == 0) {
            if (item.includeMain != null and item.includeMain.?.len != 0) {
                var mainPos: usize = 2;
                while (mainPos < item.includeMain.?.len) {
                    const operation = item.includeMain.?[mainPos..];
                    const start = readInt(u16, operation, 0);
                    const len = readInt(u16, operation, 2);
                    @memcpy(data[i .. i + len], val[start .. start + len]);
                    i += len;
                    mainPos += 4;
                }
            } else {
                @memcpy(data[i .. i + val.len], val);
                i += val.len;
            }
        } else {
            writeInt(u32, data, i, val.len);
            i += 4;
            @memcpy(data[i .. i + val.len], val);
            i += val.len;
        }
    }

    return result;
}
