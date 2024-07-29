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
        const refstartIndex = i;

        const len = std.mem.readInt(u16, buf[i..][0..2], .little);
        const type_prefix: [2]u8 = .{ buf[i + 2], buf[i + 3] };
        const start = std.mem.readInt(u16, buf[i + 4 ..][0..2], .little);
        const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
        const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);

        // change format...
        i += 6;

        // add all in includeLen....
        const includeLen = ((len + 6) - (i - refstartIndex));

        const includeNested: []u8 = buf[i .. i + includeLen];

        i += includeLen;

        const shardNested: u16 = @truncate(@divTrunc(refId, 1_000_000));

        const resultSizeNest = getFields(ctx, refId, type_prefix, start, includeNested, shardNested) catch 0;

        size += 4 + resultSizeNest;
    }

    return size;
}
