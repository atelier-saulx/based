const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("./ctx.zig").QueryCtx;

pub const Result = struct { id: ?u32, field: u8, val: ?c.MDB_val, start: ?u16, includeMain: []u8 };

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

    var last_pos: usize = 4;
    var last_singleRef: [2]u8 = .{ 255, 255 };

    for (ctx.results.items) |*key| {
        if (key.start != null) {
            const x: [2]u8 = @bitCast(key.start.?);
            if (last_singleRef[0] != x[0] or last_singleRef[1] != x[1]) {
                last_singleRef = x;
                dataU8[last_pos] = 0;
                last_pos += 1;
                dataU8[last_pos] = 254;
                last_pos += 1;
                dataU8[last_pos] = last_singleRef[0];
                last_pos += 1;
                dataU8[last_pos] = last_singleRef[1];
                last_pos += 1;
                // std.debug.print("zig: set ref... {any} S:{any}\n", .{ key.id, key.start });
            }
        } else {
            // std.debug.print("zig: reset ref... {any}\n", .{key.id});
            last_singleRef[0] = 255;
            last_singleRef[1] = 255;
        }

        if (key.id != null) {
            dataU8[last_pos] = 255;
            last_pos += 1;
            @memcpy(dataU8[last_pos .. last_pos + 4], @as([*]u8, @ptrCast(&key.id)));
            last_pos += 4;
        }

        @memcpy(dataU8[last_pos .. last_pos + 1], @as([*]u8, @ptrCast(&key.field)));
        last_pos += 1;

        if (key.field == 0) {
            if (key.includeMain.len != 0) {
                var selectiveMainPos: usize = 2;
                var mainU8 = @as([*]u8, @ptrCast(key.val.?.mv_data));
                while (selectiveMainPos < key.includeMain.len) {
                    const start: u16 = std.mem.readInt(u16, @ptrCast(key.includeMain[selectiveMainPos .. selectiveMainPos + 2]), .little);
                    const len: u16 = std.mem.readInt(u16, @ptrCast(key.includeMain[selectiveMainPos + 2 .. selectiveMainPos + 4]), .little);
                    const end: u16 = len + start;
                    @memcpy(dataU8[last_pos .. last_pos + len], mainU8[start..end].ptr);
                    last_pos += len;
                    selectiveMainPos += 4;
                }
            } else {
                @memcpy(
                    dataU8[last_pos .. last_pos + key.val.?.mv_size],
                    @as([*]u8, @ptrCast(key.val.?.mv_data)),
                );
                last_pos += key.val.?.mv_size;
            }
        } else {
            const x: [2]u8 = @bitCast(@as(u16, @truncate(key.val.?.mv_size)));
            dataU8[last_pos] = x[0];
            dataU8[last_pos + 1] = x[1];
            last_pos += 2;
            @memcpy(
                dataU8[last_pos .. last_pos + key.val.?.mv_size],
                @as([*]u8, @ptrCast(key.val.?.mv_data)),
            );
            last_pos += key.val.?.mv_size;
        }
    }

    return result;
}
