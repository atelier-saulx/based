const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env.zig");
const globals = @import("globals.zig");
const runQuery = @import("runQuery.zig").runQuery;

const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;
const MdbError = errors.MdbError;

const SIZE_BYTES = globals.SIZE_BYTES;

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(env, info) catch return null;
}

const KEY_LEN = 4;

// dbZig.query(filter, typePrefix, totalShards)

// for DBI
// make simple list of ids
//

fn getQueryInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    var argc: usize = 5;
    var argv: [5]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var buffer_size: usize = undefined;
    var buffer_contents: ?*anyopaque = null;
    if (c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&buffer_contents)), &buffer_size) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var type_prefix: [2]u8 = undefined;

    if (c.napi_get_value_string_utf8(env, argv[1], @ptrCast(&type_prefix), 3, null) != c.napi_ok) {
        return jsThrow(env, "Failed to get args. (str)");
    }

    var last_id: u32 = undefined;
    if (c.napi_get_value_int32(env, argv[2], @ptrCast(&last_id)) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var start: u32 = undefined;
    if (c.napi_get_value_int32(env, argv[3], @ptrCast(&start)) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var end: u32 = undefined;
    if (c.napi_get_value_int32(env, argv[4], @ptrCast(&end)) != c.napi_ok) {
        return jsThrow(env, "Failed to get args.");
    }

    var txn: ?*c.MDB_txn = null;

    mdbThrow(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();

    var keys = std.ArrayList(u32).init(allocator);
    var keysPrev: ?std.ArrayList(u32) = null;

    var total_results: usize = 0;

    const queries: [*]u8 = @as([*]u8, @ptrCast(buffer_contents.?));

    // var i: u32 = start + 1;

    //     [
    //   48, 9, 0,  1,  4, 0, 20, 0, 3,
    //    0, 0, 0, 51, 15, 0,  7, 3, 0,
    //    1, 0, 0,  0,  2, 0,  0, 0, 3,
    //    0, 0, 0
    // ]

    var x: usize = 0;
    while (x < buffer_size) {
        const dbiChar = queries[x];
        var dbi: c.MDB_dbi = 0;
        var all_together: [5]u8 = undefined;

        const querySize: u16 = std.mem.readInt(
            u16,
            queries[x + 1 ..][0..2],
            .little,
        );

        const dbi_name = try std.fmt.bufPrint(all_together[0..5], "{s}{c}{s}", .{ type_prefix, dbiChar, "00" });

        std.debug.print("get from dbi_name {s}\n", .{dbi_name});

        var cursor: ?*c.MDB_cursor = null;

        mdbThrow(c.mdb_dbi_open(txn, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi)) catch |err| {
            if (err != MdbError.MDB_NOTFOUND) {
                c.mdb_txn_abort(txn);
                return jsThrow(env, @errorName(err));
            } else {
                c.mdb_cursor_close(cursor);
                x += querySize + 3;
                continue;
            }
        };

        mdbThrow(c.mdb_cursor_open(txn, dbi, &cursor)) catch |err| {
            c.mdb_txn_abort(txn);
            return jsThrow(env, @errorName(err));
        };
        var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

        const is_last = x + querySize + 3 == buffer_size;

        if (x == 0) {

            // then we can check for end
            var i: u32 = 1;
            while (i < last_id + 1 and (!is_last or total_results < end + start)) : (i += 1) {
                k.mv_data = &i;
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
                    if (err != MdbError.MDB_NOTFOUND) {
                        // TODO instead of throwing just send an empty buffer
                        return jsThrow(env, @errorName(err));
                    } else {
                        continue;
                    }
                };
                if (runQuery(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], queries[x + 3 .. x + 3 + querySize].ptr, buffer_size)) {
                    total_results += 1;
                    keys.append(i) catch return jsThrow(env, "OOM");
                }
                if (i > last_id) {
                    break;
                }
            }

            // if (is_last and keys.items.len != 0) {
            //     if (start > 0) {
            //         try keys.replaceRange(0, start, &.{});
            //         total_results -= start;
            //     }
            // }
        } else {
            if (keysPrev != null) {
                keysPrev.?.deinit();
            }
            keysPrev = keys;
            keys = std.ArrayList(u32).init(allocator);
            total_results = 0;
            var i: usize = 0;
            const len: usize = keysPrev.?.items.len;
            while (i < len) : (i += 1) {
                var key = keysPrev.?.items[i];
                k.mv_data = &key;
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
                    if (err != MdbError.MDB_NOTFOUND) {
                        // TODO instead of throwing just send an empty buffer
                        return jsThrow(env, @errorName(err));
                    } else {
                        // total_results -= 1;
                        // _ = keys.swapRemove(i);
                        // len -= 1;
                        // i -= 1;
                        // keys.items[i] = 0;
                        continue;
                    }
                };

                if (!runQuery(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], queries[x + 3 .. x + 3 + querySize].ptr, buffer_size)) {
                    // total_results -= 1;
                    // keys.items[i] = 0;

                    // _ = keys.swapRemove(i);
                    // len -= 1;
                    // i -= 1;
                } else {
                    total_results += 1;
                    keys.append(key) catch return jsThrow(env, "OOM");

                    if (is_last and total_results > start + end) {
                        break;
                    }
                }
            }

            if (is_last) {
                if (keys.items.len != 0) {
                    keysPrev.?.deinit();
                    if (keys.items.len < start) {
                        keys.clearAndFree();
                        total_results = 0;
                    } else {
                        if (start > 0) {
                            try keys.replaceRange(0, start, &.{});
                            total_results -= start;
                        }
                    }
                }
            }
        }

        c.mdb_cursor_close(cursor);

        if (keys.items.len == 0) {
            break;
        }

        x += querySize + 3;
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_results * KEY_LEN, &data, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create Buffer");
    }

    var last_pos: usize = 0;
    for (keys.items) |*key| {
        @memcpy(@as([*]u8, @ptrCast(data))[last_pos .. last_pos + KEY_LEN], @as([*]u8, @ptrCast(key)));
        last_pos += KEY_LEN;
    }

    mdbThrow(c.mdb_txn_commit(txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    return result;
}
