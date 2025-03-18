const c = @import("../c.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const QueryCtx = @import("./types.zig").QueryCtx;
const utils = @import("../utils.zig");
const t = @import("../types.zig");
const std = @import("std");
const selva = @import("../selva.zig");

const builtin = @import("builtin");
extern "c" fn memcpy(*anyopaque, *const anyopaque, usize) *anyopaque;

// use this in modify
// make all read things in enum
pub inline fn copy(dest: []u8, source: []const u8) void {
    if (builtin.link_libc) {
        _ = memcpy(dest.ptr, source.ptr, source.len);
    } else {
        @memcpy(dest[0..source.len], source);
    }
}

const read = utils.read;
const writeInt = utils.writeInt;

pub const Result = struct {
    id: ?u32,
    field: u8,
    refType: ?u8, // 253 | 254
    val: ?[]u8,
    refSize: ?usize,
    includeMain: ?[]u8, // make this optional
    totalRefs: ?usize,
    isEdge: t.Prop,
    score: ?[4]u8,
};

pub fn createResultsBuffer(
    ctx: *QueryCtx,
    env: c.napi_env,
) !c.napi_value {
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_arraybuffer(env, ctx.size + 8, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }

    // c.napi_create_a

    var data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 8];
    var i: usize = 4;

    writeInt(u32, data, 0, ctx.totalResults);

    for (ctx.results.items) |*item| {
        if (item.refType != null) {
            // switch case
            if (item.refType == 254) {
                if (item.isEdge != t.Prop.NULL) {
                    data[i] = 252;
                    i += 1;
                }
                // SINGLE REF
                // op, field, bytes
                // [254, 2, 4531]
                data[i] = 254;
                data[i + 1] = item.field;
                writeInt(u32, data, i + 2, item.refSize.?);
                i += 6;
            } else if (item.refType == 253) {
                if (item.isEdge != t.Prop.NULL) {
                    data[i] = 252;
                    i += 1;
                }
                // MULTIPLE REFS
                // op, field, bytes, len (u32)
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
                if (item.score != null) {
                    copy(data[i .. i + 4], &item.score.?);
                    i += 4;
                }
            }
        }

        if (item.field == 255) {
            continue;
        }

        if (item.val == null) {
            continue;
        }

        if (item.isEdge != t.Prop.NULL) {
            data[i] = 252;
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

    // nice to add this with comptime - debug or SAFE or something
    // if (i > data.len - 4) {
    //     std.log.err("Wrong writing of result buffer i:{d} \n", .{i});
    // }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));

    return result;
}
