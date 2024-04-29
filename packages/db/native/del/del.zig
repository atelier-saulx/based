const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const globals = @import("../globals.zig");
const napi = @import("../napi.zig");

const MdbError = errors.MdbError;
const mdbCheck = errors.mdbCheck;
const jsThrow = errors.jsThrow;

const db = @import("../db.zig");

pub fn delBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return delBatchInternal(env, info, 8) catch return null;
}
pub fn delBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return delBatchInternal(env, info, 4) catch return null;
}

fn delBatchInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
    comptime KEY_LEN: comptime_int,
) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const batch = try napi.getBuffer("del_batch", env, args[0]);
    const dbi_name = try napi.getBuffer("del_dbi_name", env, args[1]);

    if (!Envs.dbEnvIsDefined) {
        return error.MDN_ENV_UNDEFINED;
    }

    const txn = try db.createTransaction(false);
    errdefer c.mdb_txn_abort(txn);

    var dbi: c.MDB_dbi = 0;
    try errors.mdbCheck(c.mdb_dbi_open(txn, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi));
    errdefer c.mdb_dbi_close(Envs.env, dbi);

    var cursor: ?*c.MDB_cursor = null;
    try mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    defer c.mdb_cursor_close(cursor);

    var deleted_keys: i64 = 0;

    var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

    var i: usize = 0;
    while (i < batch.len) : (i += KEY_LEN) {
        k.mv_data = &batch[i];

        // std.debug.print("KEY = {x}\n", .{@as([*]u8, @ptrCast(buffer_contents.?))[i .. i + 4]});

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbCheck(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            switch (err) {
                MdbError.MDB_NOTFOUND => continue,
                else => return err,
            }
        };

        try mdbCheck(c.mdb_cursor_del(cursor, 0));

        deleted_keys += 1;
    }

    var result: c.napi_value = undefined;

    if (c.napi_create_int64(env, deleted_keys, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create int64");
    }

    try mdbCheck(c.mdb_txn_commit(txn));

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}
