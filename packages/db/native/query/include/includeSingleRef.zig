const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const std = @import("std");
const db = @import("../../db.zig");
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;

const IncludeError = error{
    Recursion,
};

pub fn getSingleRefFields(ctx: QueryCtx, buf: []u8, v: c.MDB_val) usize {
    var size: usize = 0;
    var i: usize = 0;

    while (i < buf.len) {
        const len = std.mem.readInt(u16, buf[i..][0..2], .little);
        const type_prefix: [2]u8 = .{ buf[i + 2], buf[i + 3] };
        const start = std.mem.readInt(u16, buf[i + 4 ..][0..2], .little);
        const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
        const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);

        var EMPTY: [0]u8 = .{};
        // tmp
        const refSingleIncludeNested = EMPTY[0..0];
        var INCLUDE: [1]u8 = .{0};

        // tmp
        const includeNested: []u8 = INCLUDE[0..1];
        var mainIncludeNested: []u8 = undefined;

        if (buf[i + 6] == 0) {
            const refMainSelectLen = std.mem.readInt(u16, buf[i + 7 ..][0..2], .little);
            if (refMainSelectLen > 0) {
                mainIncludeNested = buf[i + 9 .. i + 9 + 4 + refMainSelectLen];
                std.debug.print("hello its selective main {any} \n", .{mainIncludeNested});
            } else {
                std.debug.print("hello its ALL main \n", .{});
                mainIncludeNested = EMPTY[0..0];
            }
        } else {
            mainIncludeNested = EMPTY[0..0];
        }

        const shardNested: u16 = @truncate(@divTrunc(refId, 1_000_000));

        std.debug.print("NEW include {any} main {any} \n", .{ includeNested, mainIncludeNested });

        const resultSizeNest = getFields(ctx, refId, type_prefix, start, includeNested, refSingleIncludeNested, mainIncludeNested, shardNested) catch 0;

        std.debug.print("hello its REFTIME {d} \n", .{resultSizeNest});

        size += 4 + resultSizeNest;

        i += len + 6;
    }

    return size;
}
