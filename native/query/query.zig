const std = @import("std");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const multiple = @import("multiple.zig");
const single = @import("single.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Selva = @import("../selva");

// -------- NAPI ---------- (put in js bridge maybe?)
pub fn getQueryBufThread(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getQueryBufInternalThread(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternalThread(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*DbCtx, env, args[0]);
    const q = try napi.get([]u8, env, args[1]);
    try dbCtx.threads.query(q);
    return null;
}
// -------------------------

pub fn getQueryThreaded(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
) !void {
    var index: usize = 0;

    var ctx: Query.QueryCtx = .{
        .db = dbCtx,
        .thread = thread,
    };

    const queryId = utils.readNext(u32, buffer, &index);
    const q = buffer[index .. buffer.len - 8]; // - checksum len
    // utils.debugPrint("q: {any}\n", .{q});
    const op = utils.read(t.OpType, q, 0);

    _ = try thread.query.result(0, queryId, op);

    switch (op) {
        .default => try multiple.default(&ctx, q),
        .id => try single.default(false, &ctx, q),
        .idFilter => try single.default(true, &ctx, q),
        .alias => try single.alias(false, &ctx, q),
        .aliasFilter => try single.alias(true, &ctx, q),
        .ids => try multiple.ids(&ctx, q),
        .aggregates => try multiple.aggregates(&ctx, q),
        .aggregatesCount => try multiple.aggregatesCount(&ctx, q),
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }

    try ctx.thread.query.checksum();
}
