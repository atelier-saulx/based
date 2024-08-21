const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const dbCtx = @import("../db/ctx.zig");

pub fn init(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return createEnvInternal(napi_env, info) catch return null;
}

fn createEnvInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const ctx = try napi.getInfo(1, napi_env, info);
    const path = try napi.getStringFixedLength("createEnv", 256, napi_env, ctx.args[0]);

    // may need to make the ctx before
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    const allocator = arena.allocator();
    ctx.db = .{
        .allocator = allocator,
        .readShards = dbCtx.Shards.init(allocator),
        .txnCreated = false,
        .sortIndexes = dbCtx.Indexes.init(allocator),
        .mainSortIndexes = std.AutoHashMap([2]u8, *dbCtx.StartSet).init(allocator),
    };

    try errors.mdb(c.mdb_env_create(&ctx.db.env));
    errdefer c.mdb_env_close(ctx.db.env);

    try errors.mdb(c.mdb_env_set_mapsize(ctx.db.env, 1000 * 1000 * 1000 * 100));
    try errors.mdb(c.mdb_env_set_maxdbs(ctx.db.env, 20_000_000));

    try errors.mdb(c.mdb_env_set_maxreaders(ctx.db.env, 126));

    var flags: c_uint = 0;

    // flags |= c.MDB_RDONLY; // very nice for read shard

    // only 1 writer per db
    flags |= c.MDB_NOLOCK;

    // no sync
    flags |= c.MDB_NOSYNC;

    // no meta sync
    flags |= c.MDB_NOMETASYNC;

    // writable mmap
    flags |= c.MDB_WRITEMAP;

    errors.mdb(c.mdb_env_open(ctx.db.env, &path, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    return null;
}
