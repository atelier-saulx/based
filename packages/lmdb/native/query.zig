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

    //
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
    var i: u32 = 1;
    const MAX_RESULTS = 10000;

    keys_loop: while (total_results < MAX_RESULTS and i < last_id + 1) : (i += 1) {
        k.mv_data = &i;

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            if (err != MdbError.MDB_NOTFOUND) {
                // TODO instead of throwing just send an empty buffer
                return jsThrow(env, @errorName(err));
            } else {
                continue :keys_loop;
            }
        };

        // std.debug.print("key = {d},{x}\n", .{ i, @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size] });

        // -------------------------------------------------------------
        // query loop
        var j: usize = 0;
        query_loop: while (j < buffer_size) {
            // op 0 field 0

            // op 1,
            // size 6, 0,
            // index 20, 0,
            // value 1, 0, 0, 0

            // op 0
            // field: 1
            // -> get dbi type 20 1 00

            // op 1 byte
            const operation = @as([*]u8, @ptrCast(buffer_contents.?))[j]; // 1 aka "="
            _ = operation; // TODO
            // std.debug.print("op = {d}\n", .{operation});

            // 2 bytes
            const filter_size: u16 = std.mem.readInt(
                u16,
                @as([*]const u8, @ptrCast(buffer_contents.?))[j + 1 ..][0..2],
                .little,
            );

            // std.debug.print("filter_size = {d}\n", .{filter_size});

            // index where to look 2 bytes
            const index: u16 = std.mem.readInt(
                u16,
                @as([*]const u8, @ptrCast(buffer_contents.?))[j + 3 ..][0..2],
                .little,
            );

            // std.debug.print("index = {d}\n", .{index});

            // value filter_size - 2 bytes
            // make loop filter_size - 5 bytes long and compare each byte
            for (
                @as([*]const u8, @ptrCast(buffer_contents.?))[j + 5 .. j + 5 + filter_size - 2],
                0..,
            ) |byte, z| {
                if (byte != @as([*]u8, @ptrCast(v.mv_data))[index + z]) {
                    // std.debug.print("COMPARISON FAILED BYTE {x} == {x}\n", .{
                    //     byte,
                    //     @as([*]u8, @ptrCast(v.mv_data))[index + z],
                    // });

                    break :query_loop;
                }
                if (index + z == v.mv_size - 1) {
                    // we reached the end without breaking, means we have a hit
                    std.debug.print("GOT A HIT WITH KEY {d}\n", .{i});

                    total_results += 1;
                    values.append(i) catch return jsThrow(env, "OOM");
                    break :query_loop;
                }
            }

            j += filter_size + 3;
        }

        // -------------------------------------------------------------

        // if i > 1e6 select correct shard and the same later

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
