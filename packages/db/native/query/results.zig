const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db/db.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const utils = @import("../utils.zig");

const readInt = utils.readInt;
const writeInt = utils.writeInt;

pub const Result = struct {
    id: ?u32,
    field: u8,
    val: ?[]u8,
    start: ?u16,
    includeMain: []u8,
    refLvl: u8,
};

const MAX_REF = 65025;

pub fn createResultsBuffer(
    ctx: QueryCtx,
    env: c.napi_env,
    total_size: usize,
    total_results: usize,
) !c.napi_value {
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_buffer(env, total_size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }

    var data = @as([*]u8, @ptrCast(resultBuffer))[0 .. total_size + 4];
    var lastRef: u16 = MAX_REF;
    var lastRefLvl: u8 = 0;
    var i: usize = 4;

    writeInt(u32, data, 0, total_results);

    for (ctx.results.items) |*item| {
        if (item.start != null) {
            if (lastRef != item.start.? or lastRefLvl != item.refLvl) {
                lastRef = item.start.?;
                lastRefLvl = item.refLvl;
                data[i] = 254;
                i += 1;
                if (item.refLvl > 1) {
                    data[i] = 1;
                } else {
                    data[i] = 0;
                }
                i += 1;
                writeInt(u16, data, i, lastRef);
                i += 2;
                writeInt(u32, data, i, item.id.?);
                i += 4;
            }
        } else {
            lastRef = MAX_REF;
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

        data[i] = item.field;
        i += 1;

        if (item.val == null) {
            continue;
        }

        const val = item.val.?;

        if (item.field == 0) {
            if (item.includeMain.len != 0) {
                var mainPos: usize = 2;
                while (mainPos < item.includeMain.len) {
                    const operation = item.includeMain[mainPos..];
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
            writeInt(u16, data, i, val.len);
            i += 2;
            @memcpy(data[i .. i + val.len], val);
            i += val.len;
        }
    }

    return result;
}
