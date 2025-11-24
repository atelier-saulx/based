const std = @import("std");
const db = @import("../db/db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Sort = @import("../db/sort.zig");
const Query = @import("./common.zig");
const utils = @import("../utils.zig");
const multiple = @import("./multiple.zig");
const threads = @import("../db/threads.zig");

const t = @import("../types.zig");

// -------- NAPI ---------- (put in js bridge maybe?)
pub fn getQueryBufThread(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getQueryBufInternalThread(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternalThread(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const q = try napi.get([]u8, env, args[1]);
    try dbCtx.threads.query(q);
    return null;
}
// -------------------------

pub fn getQueryThreaded(
    dbCtx: *db.DbCtx,
    buffer: []u8,
    thread: *db.DbThread,
    _: ?*Sort.SortIndexMeta,
) !void {
    var index: usize = 0;

    var ctx: Query.QueryCtx = .{
        .db = dbCtx,
        .thread = thread,
    };

    const queryId = utils.readNext(u32, buffer, &index);
    const q = buffer[index .. buffer.len - 8]; // - checksum len
    const op = utils.read(t.OpType, q, 0);
    _ = try threads.newResult(true, thread, 0, queryId, op);

    switch (op) {
        t.OpType.default => {
            try multiple.default(&ctx, q);
        },
        t.OpType.ids => {}, // can treat this the same as refs maybe?
        t.OpType.id => {
            // const id = read(u32, q, 3);
            // const filterSize = read(u16, q, 7);
            // const filterBuf = q[9 .. 9 + filterSize];
            // const include = q[9 + filterSize .. len];
            // try QueryId.default(id, &ctx, typeId, filterBuf, include);
        },
        t.OpType.alias => {},
        // t.OpType.aggregates => {},
        // t.OpType.aggregatesCount => {},
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }
}
