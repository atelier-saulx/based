const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env.zig");

const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;

pub fn setBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return setBatchInternal(env, info, 8);
}
pub fn setBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return setBatchInternal(env, info, 4);
}

fn setBatchInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
    comptime KEY_LEN: comptime_int,
) c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes

    std.debug.print("IN SET ENV PTR= {any}\n", .{Envs.env});

    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    // dbi is second argument

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var data: ?*anyopaque = null;
    var data_length: usize = undefined;
    _ = c.napi_get_buffer_info(env, argv[0], @ptrCast(&data), &data_length);

    var dbi_name: ?*anyopaque = null;
    var dbi_name_length: usize = undefined;

    var hasDbi: bool = false;
    if (argc > 1) {
        _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(&dbi_name), &dbi_name_length);

        hasDbi = true;
    }

    if (!Envs.dbEnvIsDefined) {
        return jsThrow(env, "lmdb env is undefined");
    }
    var txn: ?*c.MDB_txn = null;
    const parentPtr: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    const flags: c_uint = 0;

    std.debug.print("Hello", .{});

    // _ = c.mdb_txn_begin(Envs.env, parentPtr, flags, &txn);
    mdbThrow(c.mdb_txn_begin(Envs.env, parentPtr, flags, &txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };
    std.debug.print("Hello2", .{});

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

    var i: usize = 0;
    while (i < data_length) {
        const key = @as([*]u8, @ptrCast(data.?))[i .. i + KEY_LEN];

        const size_byte1 = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN];
        const size_byte2 = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN + 1];
        const size_arr: [2]u8 = .{ size_byte1, size_byte2 };

        const value_size: u16 = std.mem.readInt(u16, &size_arr, .little);

        const value = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN + 2 .. i + KEY_LEN + 2 + @as(usize, value_size)];

        var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = @as([*]u8, @ptrCast(@alignCast(key.ptr))) };
        var v: c.MDB_val = .{ .mv_size = value_size, .mv_data = @as([*]u8, @ptrCast(@alignCast(value.ptr))) };
        // dbthrow(c.mdb_put(txn.ptr, db.dbi, &k, &v, 0)) catch return statusOk(env, false);
        mdbThrow(c.mdb_cursor_put(cursor, &k, &v, 0)) catch |err| {
            return jsThrow(env, @errorName(err));
        };

        // std.debug.print("\n=================\n", .{});
        // std.debug.print("KEY= {x}\n", .{key});
        // std.debug.print("value_size bits = 0x{x}\n", .{value_size});
        // std.debug.print("value_size= {d}\n", .{value_size});
        // std.debug.print("VALUE= {x}\n", .{value});
        // std.debug.print("VALUE= {s}\n", .{value});
        // std.debug.print("=================\n", .{});
        i = i + KEY_LEN + 2 + value_size;
    }

    mdbThrow(c.mdb_txn_commit(txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };
    return null;
}

// fn setBatchInternal(
//     env: c.napi_env,
//     info: c.napi_callback_info,
//     comptime KEY_LEN: comptime_int,
// ) c.napi_value {
//     // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes

//     std.debug.print("IN SET ENV PTR= {any}\n", .{Envs.env});

//     var argc: usize = 2;
//     var argv: [2]c.napi_value = undefined;

//     // dbi is second argument

//     if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
//         return jsThrow(env, "Failed to get args.");
//     }

//     var data: ?*anyopaque = null;
//     var data_length: usize = undefined;
//     _ = c.napi_get_buffer_info(env, argv[0], @ptrCast(&data), &data_length);

//     var dbi_name: ?*anyopaque = null;
//     var dbi_name_length: usize = undefined;

//     var hasDbi: bool = false;
//     if (argc > 1) {
//         _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(&dbi_name), &dbi_name_length);

//         hasDbi = true;
//     }

//     if (!Envs.dbEnvIsDefined) {
//         return jsThrow(env, "lmdb env is undefined");
//     }
//     // var txn: ?*c.MDB_txn = null;
//     // const parentPtr: ?*c.MDB_txn = null;
//     var dbi: c.MDB_dbi = 0;
//     var cursor: ?*c.MDB_cursor = null;

//     // const flags: c_uint = 0;

//     std.debug.print("Hello", .{});

//     // _ = c.mdb_txn_begin(Envs.env, parentPtr, flags, &txn);
//     // mdbThrow(c.mdb_txn_begin(Envs.env, parentPtr, flags, &txn)) catch |err| {
//     //     return jsThrow(env, @errorName(err));
//     // };

//     const txn = Txn.init(Envs.dbEnv, .{ .mode = .ReadWrite }) catch |err| {
//         // return statusOk(env, false);
//         std.debug.print("ERROROROROROR", .{});
//         return jsThrow(env, @errorName(err));
//     };

//     std.debug.print("Hello2", .{});

//     if (hasDbi) {
//         mdbThrow(c.mdb_dbi_open(txn.ptr, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi)) catch |err| {
//             return jsThrow(env, @errorName(err));
//         };
//     } else {
//         mdbThrow(c.mdb_dbi_open(txn.ptr, null, c.MDB_INTEGERKEY, &dbi)) catch |err| {
//             return jsThrow(env, @errorName(err));
//         };
//     }

//     mdbThrow(c.mdb_cursor_open(txn.ptr, dbi, &cursor)) catch |err| {
//         return jsThrow(env, @errorName(err));
//     };

//     var i: usize = 0;
//     while (i < data_length) {
//         const key = @as([*]u8, @ptrCast(data.?))[i .. i + KEY_LEN];

//         const size_byte1 = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN];
//         const size_byte2 = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN + 1];
//         const size_arr: [2]u8 = .{ size_byte1, size_byte2 };

//         const value_size: u16 = std.mem.readInt(u16, &size_arr, .little);

//         const value = @as([*]u8, @ptrCast(data.?))[i + KEY_LEN + 2 .. i + KEY_LEN + 2 + @as(usize, value_size)];

//         var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = @as([*]u8, @ptrCast(@alignCast(key.ptr))) };
//         var v: c.MDB_val = .{ .mv_size = value_size, .mv_data = @as([*]u8, @ptrCast(@alignCast(value.ptr))) };
//         // dbthrow(c.mdb_put(txn.ptr, db.dbi, &k, &v, 0)) catch return statusOk(env, false);
//         mdbThrow(c.mdb_cursor_put(cursor, &k, &v, 0)) catch |err| {
//             return jsThrow(env, @errorName(err));
//         };

//         // std.debug.print("\n=================\n", .{});
//         // std.debug.print("KEY= {x}\n", .{key});
//         // std.debug.print("value_size bits = 0x{x}\n", .{value_size});
//         // std.debug.print("value_size= {d}\n", .{value_size});
//         // std.debug.print("VALUE= {x}\n", .{value});
//         // std.debug.print("VALUE= {s}\n", .{value});
//         // std.debug.print("=================\n", .{});
//         i = i + KEY_LEN + 2 + value_size;
//     }

//     mdbThrow(c.mdb_txn_commit(txn.ptr)) catch |err| {
//         return jsThrow(env, @errorName(err));
//     };
//     return null;
// }
