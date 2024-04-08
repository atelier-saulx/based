const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;

pub var dbEnvIsDefined: bool = false;
pub var env: ?*c.MDB_env = null;

pub fn createEnv(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;
    if (c.napi_get_cb_info(napi_env, info, &argc, &argv, null, null) != c.napi_ok) {
        return jsThrow(napi_env, "Failed to get args.");
    }
    var strlen: usize = undefined;
    var memory: [256]u8 = undefined;

    _ = c.napi_get_value_string_utf8(napi_env, argv[0], &memory, 256, &strlen);

    const path = memory[0..strlen];

    std.debug.print("ENV PTR= {any}\n", .{env});

    if (dbEnvIsDefined) {
        c.mdb_env_close(env);
    }

    mdbThrow(c.mdb_env_create(&env)) catch |err| {
        return jsThrow(napi_env, @errorName(err));
    };
    errdefer c.mdb_env_close(env);

    std.debug.print("ENV PTR= {any}\n", .{env});

    mdbThrow(c.mdb_env_set_mapsize(env, 1000 * 1024 * 1024 * 1024)) catch |err| {
        return jsThrow(napi_env, @errorName(err));
    };
    mdbThrow(c.mdb_env_set_maxdbs(env, 20_000_000)) catch |err| {
        return jsThrow(napi_env, @errorName(err));
    };

    // TODO: check this number
    mdbThrow(c.mdb_env_set_maxreaders(env, 126)) catch |err| {
        return jsThrow(napi_env, @errorName(err));
    };

    var flags: c_uint = 0;
    // flags |= c.MDB_RDONLY;
    // flags |= c.MDB_RDONLY;
    // flags |= c.MDB_NOLOCK;
    // flags |= c.MDB_NOTLS;
    flags |= c.MDB_NOSYNC;

    // TODO: check this `mode` number
    mdbThrow(c.mdb_env_open(env, path.ptr, flags, 0o664)) catch |err| {
        return jsThrow(napi_env, @errorName(err));
    };

    dbEnvIsDefined = true;

    return null;
}

// pub fn createEnv(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
//     var argc: usize = 1;
//     var argv: [1]c.napi_value = undefined;
//     if (c.napi_get_cb_info(napi_env, info, &argc, &argv, null, null) != c.napi_ok) {
//         return jsThrow(napi_env, "Failed to get args.");
//     }
//     var strlen: usize = undefined;
//     // dynamic allocator?
//     var memory: [256]u8 = undefined;

//     // std.debug.print("============ Create db on path {any}\n", .{argv[0]});

//     _ = c.napi_get_value_string_utf8(napi_env, argv[0], &memory, 256, &strlen);

//     // std.debug.print("============ Create db on path {d} SIZE boink\n", .{strlen});

//     // std.debug.print("============ Create db on path {any} boink\n", .{memory});

//     const path = memory[0..strlen];
//     // std.debug.print("============ Create db on path {s}\n", .{path});

//     if (dbEnvIsDefined) {
//         dbEnv.deinit();
//     }

//     dbEnv = Environment.init(path.ptr, .{
//         .map_size = 1000 * 1024 * 1024 * 1024,
//         .max_dbs = 20_000_000,
//         .no_sync = true,
//     }) catch return jsThrow(napi_env, "poop");

//     dbEnvIsDefined = true;
//     return null;
// }
