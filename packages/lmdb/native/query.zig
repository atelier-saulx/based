const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env.zig");
const globals = @import("globals.zig");

const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;
const MdbError = errors.MdbError;

const SIZE_BYTES = globals.SIZE_BYTES;

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(env, info);
}

const KEY_LEN = 4;

// dbZig.query(filter, typePrefix, totalShards)

fn getQueryInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
) c.napi_value {
    var argc: usize = 3;
    var argv: [3]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var buffer_size: usize = undefined;
    var buffer_contents: ?*anyopaque = null;
    if (c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&buffer_contents)), &buffer_size) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var type_prefix: ?*anyopaque = null;
    var type_prefix_len: usize = undefined;

    if (c.napi_get_buffer_info(env, argv[1], @ptrCast(&type_prefix), &type_prefix_len) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var last_id: u32 = undefined;
    if (c.napi_get_value_int32(env, argv[2], @ptrCast(&last_id)) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    // 1 byte [operation] (= 1)
    // 2 bytes [size of filter]
    // 2 bytes [index to read]
    // 4 bytes [equal integer]

    // read from dbi

    // vectorClock 20 0 00   // 20 0 01
    // name 20 1 00          // 20 1 01

    // get id from 20 0 00 condition pass ? yes get from 20 1 00

    //

    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;

    mdbThrow(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    // "prefix000"

    const dbi_name = "10000";

    std.debug.print(" {s}", .{dbi_name});

    // dbi_name.

    // + "0" + "00"

    var cursor: ?*c.MDB_cursor = null;

    mdbThrow(c.mdb_dbi_open(txn, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi)) catch |err| {
        c.mdb_txn_abort(txn);
        return jsThrow(env, @errorName(err));
    };

    mdbThrow(c.mdb_cursor_open(txn, dbi, &cursor)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    var values = std.ArrayList(u32).init(allocator);

    var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

    var total_results: usize = 0;
    var i: u32 = 0;
    const MAX_RESULTS = 10000;

    while (total_results < MAX_RESULTS and i < last_id) {
        k.mv_data = &i;

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            if (err != MdbError.MDB_NOTFOUND) {
                // TODO instead of throwing just send an empty buffer
                return jsThrow(env, @errorName(err));
            }
        };

        // -------------------------------------------------------------
        // query loop
        // var byteLength = buffer_size;
        // while (i < byteLength) {
        //     const operation = @as([*]u8, @ptrCast(buffer_contents.?))[i];

        //     // 2 bytes
        //     const filter_size: u16 = std.mem.readInt(
        //         u16,
        //         @as([*]const u8, @ptrCast(buffer_contents.?))[i..][0..2],
        //         .little,
        //     );

        //     var j = 0;
        //     while (j < filter_size) {}

        //     i += filter_size + 3;
        // }

        total_results += 1;
        values.append(i) catch return jsThrow(env, "OOM");
        // -------------------------------------------------------------

        i += 1;
        if (i > last_id) {
            break;
        }
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_results * KEY_LEN, &data, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create Buffer");
    }

    var last_pos: usize = 0;
    for (values.items) |*key| {
        @memcpy(@as([*]u8, @ptrCast(data))[last_pos .. last_pos + KEY_LEN], @as([*]u8, @ptrCast(key)));
        last_pos += KEY_LEN;
    }

    mdbThrow(c.mdb_txn_commit(txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    return result;
}
