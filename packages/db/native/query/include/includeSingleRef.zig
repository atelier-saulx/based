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

const EMPTY_BUF: [0]u8 = .{};

pub fn getSingleRefFields(ctx: QueryCtx, include: []u8, v: c.MDB_val, refLvl: u8, hasFields: bool) usize {
    var size: usize = 0;
    const includeMain: []u8 = &.{};

    // [type] [type] [start] [start]
    const type_prefix: [2]u8 = .{ include[0], include[1] };
    const start = std.mem.readInt(u16, include[2..][0..2], .little);
    const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
    const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);

    if (!hasFields) {
        const s: results.Result = .{
            .id = refId,
            .field = 255,
            .val = .{ .mv_size = 0, .mv_data = null },
            .start = start,
            .includeMain = includeMain,
            .refLvl = refLvl + 1,
        };
        ctx.results.append(s) catch {
            std.log.err("Cannot append result to query results", .{});
            return 0;
        };
    }

    const includeNested = include[4..include.len];
    const shardNested: u16 = db.idToShard(refId);
    const resultSizeNest = getFields(ctx, refId, type_prefix, start, includeNested, shardNested, refLvl + 1) catch 0;

    size += 8 + resultSizeNest;

    return size;
}
