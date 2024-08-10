const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");

const mdb = errors.mdb;
const jsThrow = errors.jsThrow;

pub var dbEnvIsDefined: bool = false;
pub var env: ?*c.MDB_env = null;

pub fn createEnv(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return createEnvInternal(napi_env, info) catch return null;
}

fn createEnvInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const path = try napi.getStringFixedLength("createEnv path", 256, napi_env, args[0]);

    if (dbEnvIsDefined) {
        c.mdb_env_close(env);
    }

    try mdb(c.mdb_env_create(&env));
    errdefer c.mdb_env_close(env);

    try mdb(c.mdb_env_set_mapsize(env, 1000 * 1000 * 1000 * 100));
    try mdb(c.mdb_env_set_maxdbs(env, 20_000_000));

    // TODO: check this number
    try mdb(c.mdb_env_set_maxreaders(env, 126));

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

    // TODO: check this `mode` number
    mdb(c.mdb_env_open(env, &path, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    dbEnvIsDefined = true;

    return null;
}
