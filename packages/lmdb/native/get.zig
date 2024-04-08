const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env.zig");

const mdbThrow = errors.mdbThrow;
const jsThrow = errors.jsThrow;

pub fn getBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getBatchInternal(env, info, 8);
}
pub fn getBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getBatchInternal(env, info, 4);
}

fn getBatchInternal(
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

    mdbThrow(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn)) catch |err| {
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

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    // TODO: this can be severely optimized by reducing the number of allocations,
    // perhaps allocating big chunks less often
    // check impl of ArrayList to see if that already happens there
    var values = std.ArrayList(c.MDB_val).init(allocator);

    var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

    var total_data_length: usize = 0;
    var i: usize = 0;
    while (i < buffer_size) : (i += KEY_LEN) {
        k.mv_data = &(@as([*]u8, @ptrCast(buffer_contents.?))[i]);

        // std.debug.print("KEY = {x}\n", .{@as([*]u8, @ptrCast(buffer_contents.?))[i .. i + 4]});

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbThrow(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            return jsThrow(env, @errorName(err));
        };

        values.append(v) catch return jsThrow(env, "OOM");

        total_data_length += v.mv_size + 2;
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_data_length, &data, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create Buffer");
    }

    var last_pos: usize = 0;
    for (values.items) |*val| {
        // copy size
        @memcpy(@as([*]u8, @ptrCast(@alignCast(data)))[last_pos .. last_pos + 2], @as([*]u8, @ptrCast(&val.mv_size))[0..2]);
        last_pos += 2;

        @memcpy(
            @as([*]u8, @ptrCast(data))[last_pos .. last_pos + val.mv_size],
            @as([*]u8, @ptrCast(val.mv_data))[0..val.mv_size],
        );

        // std.debug.print("WROTE SIZE = {d}\n", .{@as([*]u16, @ptrCast(@alignCast(data)))[0..1]});
        // std.debug.print("WROTE SIZE = {x}\n", .{@as([*]u16, @ptrCast(@alignCast(data)))[0..1]});
        // std.debug.print("WROTE VALUE = {s}\n", .{@as([*]u8, @ptrCast(data))[last_pos .. last_pos + val.mv_size]});
        // std.debug.print("WROTE VALUE = {x}\n", .{@as([*]u8, @ptrCast(data))[last_pos .. last_pos + val.mv_size]});

        last_pos += val.mv_size;
    }

    // txn.commit() catch {
    //     return jsThrow(env, "Failed to txn.commit");
    // };

    mdbThrow(c.mdb_txn_commit(txn)) catch |err| {
        return jsThrow(env, @errorName(err));
    };

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}
