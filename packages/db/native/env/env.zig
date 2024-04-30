const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");

const mdbCheck = errors.mdbCheck;
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

    try mdbCheck(c.mdb_env_create(&env));
    errdefer c.mdb_env_close(env);

    try mdbCheck(c.mdb_env_set_mapsize(env, 100 * 1024 * 1024 * 1024));
    try mdbCheck(c.mdb_env_set_maxdbs(env, 20_000_000));

    // TODO: check this number
    try mdbCheck(c.mdb_env_set_maxreaders(env, 126));

    var flags: c_uint = 0;

    // flags |= c.MDB_RDONLY;
    // flags |= c.MDB_NOLOCK;
    // flags |= c.MDB_NOTLS;
    flags |= c.MDB_NOSYNC;

    // TODO: check this `mode` number
    try mdbCheck(c.mdb_env_open(env, &path, flags, 0o664));

    dbEnvIsDefined = true;

    return null;
}
