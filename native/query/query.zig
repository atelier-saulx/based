const std = @import("std");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Selva = @import("../selva");

const ids = @import("multiple/ids.zig").ids;
const default = @import("multiple/default.zig").default;
const Single = @import("single.zig");
const Aggregates = @import("multiple/aggregates.zig");

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
    const op = utils.read(t.OpType, q, 0);
    _ = try thread.query.result(0, queryId, op);

    switch (op) {
        .default => try default(&ctx, q),
        .id => try Single.default(false, &ctx, q),
        .idFilter => try Single.default(true, &ctx, q),
        .alias => try Single.alias(false, &ctx, q),
        .aliasFilter => try Single.alias(true, &ctx, q),
        .ids => try ids(&ctx, q),
        .aggregates => try Aggregates.aggregates(&ctx, q),
        .aggregatesCount => try Aggregates.aggregatesCount(&ctx, q),
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }

    try ctx.thread.query.checksum();
}
