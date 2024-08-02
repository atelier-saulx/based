const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("./ctx.zig").QueryCtx;

pub const Result = struct { id: ?u32, field: u8, val: ?c.MDB_val, start: ?u16, includeMain: []u8, refLvl: u8 };

pub fn createResultsBuffer(ctx: QueryCtx, env: c.napi_env, total_size: usize, total_results: usize) !c.napi_value {
    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_buffer(env, total_size + 4, &data, &result) != c.napi_ok) {
        return null;
    }

    var dataU8 = @as([*]u8, @ptrCast(data));

    const s: [4]u8 = @bitCast(@as(u32, @truncate(total_results)));
    dataU8[0] = s[0];
    dataU8[1] = s[1];
    dataU8[2] = s[2];
    dataU8[3] = s[3];

    var lastPos: usize = 4;
    var lastSingleRef: [2]u8 = .{ 255, 255 };
    var lastRefLvl: u8 = 0;

    for (ctx.results.items) |*key| {
        if (key.start != null) {
            const start: [2]u8 = @bitCast(key.start.?);

            if (lastSingleRef[0] != start[0] or lastSingleRef[1] != start[1] or lastRefLvl != key.refLvl) {
                lastSingleRef = start;
                lastRefLvl = key.refLvl;

                dataU8[lastPos] = 254;
                lastPos += 1;

                if (key.refLvl > 1) {
                    dataU8[lastPos] = 1;
                } else {
                    dataU8[lastPos] = 0;
                }

                lastPos += 1;

                dataU8[lastPos] = lastSingleRef[0];
                lastPos += 1;
                dataU8[lastPos] = lastSingleRef[1];
                lastPos += 1;

                @memcpy(dataU8[lastPos .. lastPos + 4], @as([*]u8, @ptrCast(&key.id)));

                lastPos += 4;
            }
        } else {
            lastSingleRef[0] = 255;
            lastSingleRef[1] = 255;

            if (key.id != null) {
                dataU8[lastPos] = 255;
                lastPos += 1;
                @memcpy(dataU8[lastPos .. lastPos + 4], @as([*]u8, @ptrCast(&key.id)));
                lastPos += 4;
            }
        }

        if (key.field == 255) {
            continue;
        }

        @memcpy(dataU8[lastPos .. lastPos + 1], @as([*]u8, @ptrCast(&key.field)));
        lastPos += 1;

        if (key.field == 0) {
            if (key.includeMain.len != 0) {
                var selectiveMainPos: usize = 2;
                var mainU8 = @as([*]u8, @ptrCast(key.val.?.mv_data));
                while (selectiveMainPos < key.includeMain.len) {
                    // TODO make fn
                    const start: u16 = std.mem.readInt(u16, @ptrCast(key.includeMain[selectiveMainPos .. selectiveMainPos + 2]), .little);
                    const len: u16 = std.mem.readInt(u16, @ptrCast(key.includeMain[selectiveMainPos + 2 .. selectiveMainPos + 4]), .little);
                    const end: u16 = len + start;
                    @memcpy(dataU8[lastPos .. lastPos + len], mainU8[start..end].ptr);
                    lastPos += len;
                    selectiveMainPos += 4;
                }
            } else {
                @memcpy(
                    dataU8[lastPos .. lastPos + key.val.?.mv_size],
                    @as([*]u8, @ptrCast(key.val.?.mv_data)),
                );
                lastPos += key.val.?.mv_size;
            }
        } else {
            const x: [2]u8 = @bitCast(@as(u16, @truncate(key.val.?.mv_size)));
            dataU8[lastPos] = x[0];
            dataU8[lastPos + 1] = x[1];
            lastPos += 2;
            @memcpy(
                dataU8[lastPos .. lastPos + key.val.?.mv_size],
                @as([*]u8, @ptrCast(key.val.?.mv_data)),
            );
            lastPos += key.val.?.mv_size;
        }
    }

    return result;
}
