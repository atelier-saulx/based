const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const globals = @import("../globals.zig");
const napi = @import("../napi.zig");

const mdbCheck = errors.mdbCheck;
const jsThrow = errors.jsThrow;
const SIZE_BYTES = globals.SIZE_BYTES;

pub fn setBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return setBatchInternal(env, info, 8) catch |err| return jsThrow(env, @errorName(err));
}

pub fn setBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return setBatchInternal(env, info, 4) catch |err| return jsThrow(env, @errorName(err));
}

fn setBatchInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
    comptime KEY_LEN: comptime_int,
) !c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes

    const args = try napi.getArgs(2, env, info);
    const batch = try napi.getBuffer("set_batch", env, args[0]);
    const dbi_name = try napi.getBuffer("set_dbi_name", env, args[1]);

    if (!Envs.dbEnvIsDefined) {
        return error.MDN_ENV_UNDEFINED;
    }

    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    try mdbCheck(c.mdb_txn_begin(Envs.env, null, 0, &txn));
    errdefer c.mdb_txn_abort(txn);

    var flags: c_uint = 0;

    flags |= c.MDB_INTEGERKEY;
    flags |= c.MDB_CREATE;

    try mdbCheck(c.mdb_dbi_open(txn, @ptrCast(dbi_name), flags, &dbi));
    errdefer c.mdb_dbi_close(Envs.env, dbi);

    try mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    errdefer c.mdb_cursor_close(cursor);

    var i: usize = 0;
    while (i < batch.len) {
        const key = batch[i .. i + KEY_LEN];
        const value_size = std.mem.readInt(u32, batch[i + KEY_LEN ..][0..4], .little);
        const value = batch[i + KEY_LEN + SIZE_BYTES .. i + KEY_LEN + SIZE_BYTES + @as(usize, value_size)];
        var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = key.ptr };
        var v: c.MDB_val = .{ .mv_size = value_size, .mv_data = value.ptr };
        try mdbCheck(c.mdb_cursor_put(cursor, &k, &v, 0));
        i = i + KEY_LEN + SIZE_BYTES + value_size;
    }

    try mdbCheck(c.mdb_txn_commit(txn));
    return null;
}
