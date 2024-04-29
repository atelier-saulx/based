const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const globals = @import("../globals.zig");
const napi = @import("../napi.zig");

const mdbCheck = errors.mdbCheck;
const jsThrow = errors.jsThrow;
const MdbError = errors.MdbError;

const SIZE_BYTES = globals.SIZE_BYTES;

pub fn getBatch8(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getBatchInternal(env, info, 8) catch return null;
}
pub fn getBatch4(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getBatchInternal(env, info, 4) catch return null;
}

fn getBatchInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
    comptime KEY_LEN: comptime_int,
) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const batch = try napi.getBuffer("get_batch", env, args[0]);
    const dbi_name = try napi.getBuffer("del_dbi_name", env, args[1]);

    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    // std.debug.print("Hello dbi {s}\n", .{@as([*:0]u8, @ptrCast(dbi_name))});

    try mdbCheck(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    errdefer c.mdb_txn_abort(txn);

    try mdbCheck(c.mdb_dbi_open(txn, @ptrCast(dbi_name), c.MDB_INTEGERKEY, &dbi));
    errdefer c.mdb_dbi_close(Envs.env, dbi);

    try mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    defer c.mdb_cursor_close(cursor);

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    const allocator = arena.allocator();
    defer arena.deinit();

    // TODO: this can be severely optimized by reducing the number of allocations,
    // perhaps allocating big chunks less often
    // check impl of ArrayList to see if that already happens there
    var values = std.ArrayList(c.MDB_val).init(allocator);

    var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = null };

    var total_data_length: usize = 0;
    var i: usize = 0;
    while (i < batch.len) : (i += KEY_LEN) {
        k.mv_data = &batch[i];

        // std.debug.print("KEY = {x}\n", .{@as([*]u8, @ptrCast(buffer_contents.?))[i .. i + 4]});

        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        mdbCheck(c.mdb_cursor_get(cursor, &k, &v, c.MDB_SET)) catch |err| {
            switch (err) {
                MdbError.MDB_NOTFOUND => {},
                // TODO instead of throwing just send an empty buffer
                else => return err,
            }
        };

        try values.append(v);
        total_data_length += v.mv_size + SIZE_BYTES;
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_data_length, &data, &result) != c.napi_ok) {
        return jsThrow(env, "Failed to create Buffer");
    }

    var last_pos: usize = 0;
    for (values.items) |*val| {
        // copy size
        @memcpy(@as([*]u8, @ptrCast(@alignCast(data)))[last_pos .. last_pos + SIZE_BYTES], @as([*]u8, @ptrCast(&val.mv_size))[0..SIZE_BYTES]);
        last_pos += SIZE_BYTES;

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

    try mdbCheck(c.mdb_txn_commit(txn));

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}
