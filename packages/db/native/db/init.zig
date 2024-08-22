const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");

pub fn init(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return initInternal(napi_env, info) catch return null;
}

fn initInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const path = try napi.getStringFixedLength("createEnv", 256, napi_env, args[0]);

    try errors.mdb(c.mdb_env_create(&db.ctx.env));
    errdefer c.mdb_env_close(db.ctx.env);
    try errors.mdb(c.mdb_env_set_mapsize(db.ctx.env, 1000 * 1000 * 1000 * 100));
    try errors.mdb(c.mdb_env_set_maxdbs(db.ctx.env, 20_000_000));
    try errors.mdb(c.mdb_env_set_maxreaders(db.ctx.env, 126));

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

    errors.mdb(c.mdb_env_open(db.ctx.env, &path, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    return null;
}
