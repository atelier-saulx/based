const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env.zig");
const globals = @import("globals.zig");

const MdbError = errors.MdbError;
const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;

const SIZE_BYTES = globals.SIZE_BYTES;

pub fn delBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return delBatchInternal(env, info, 8);
}
pub fn delBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return delBatchInternal(env, info, 4);
}

fn delBatchInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
    comptime KEY_LEN: comptime_int,
) c.napi_value {
    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var buffer_size: usize = undefined;
    var buffer_contents: ?*anyopaque = null;
    if (c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&buffer_contents)), &buffer_size) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var dbi_name: ?*anyopaque = null;
    var dbi_name_length: usize = undefined;

    var hasDbi: bool = false;
    if (argc > 1) {
        _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(&dbi_name), &dbi_name_length);
        hasDbi = true;
    }

    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    mdbThrow(c.mdb_txn_begin(Envs.env, null, 0, &txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    if (hasDbi) {
        mdbThrow(c.mdb_dbi_open(txn, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi)) catch |err| {
            return jsThrow(env, @errorName(err));
        };
    } else {
        mdbThrow(c.mdb_dbi_open(txn, null, c.MDB_INTEGERKEY, &dbi)) catch |err| {
            return jsThrow(env, @errorName(err));
        };
    }

    mdbThrow(c.mdb_cursor_open(txn, dbi, &cursor)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    var deleted_keys: i64 = 0;

    var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

    var total_data_length: usize = 0;
    var i: usize = 0;
    while (i < buffer_size) : (i += KEY_LEN) {
        k.mv_data = &(@as([*]u8, @ptrCast(buffer_contents.?))[i]);

        // std.debug.print("KEY = {x}\n", .{@as([*]u8, @ptrCast(buffer_contents.?))[i .. i + 4]});

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            switch (err) {
                MdbError.MDB_NOTFOUND => continue,
                else => return jsThrow(env, @errorName(err)),
            }
        };

        mdbThrow(c.mdb_cursor_del(cursor, 0)) catch |err| {
            return jsThrow(env, @errorName(err));
        };

        deleted_keys += 1;
        total_data_length += v.mv_size + SIZE_BYTES;
    }

    var result: c.napi_value = undefined;

    if (c.napi_create_int64(env, deleted_keys, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create int64");
    }

    mdbThrow(c.mdb_txn_commit(txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}
