const std = @import("std");
const c = @import("c.zig");
const Environment = @import("Environment.zig");
const Transaction = @import("Transaction.zig");
const Database = @import("Database.zig");
const Cursor = @import("Cursor.zig");
const errors = @import("errors.zig");
const Error = errors.Error;

var dbEnv: Environment.Environment = undefined;

var dbEnvIsDefined: bool = false;

const TranslationError = error{ExceptionThrown};

const KEY_LEN = 4;

pub fn JsThrow(env: c.napi_env, comptime message: [:0]const u8) TranslationError {
    const result = c.napi_throw_error(env, null, message);
    switch (result) {
        c.napi_ok, c.napi_pending_exception => {},
        else => unreachable,
    }
    return TranslationError.ExceptionThrown;
}

const dbthrow = errors.CtoZigError;

pub fn errorToStr(err: Error) [*c]const u8 {
    return @errorName(err);
}

pub fn throwError(env: c.napi_env, err: Error) c.napi_value {
    const result = c.napi_throw_error(env, null, errorToStr(err));
    switch (result) {
        c.napi_ok, c.napi_pending_exception => {},
        else => unreachable,
    }
    return null;
}

pub fn register_function(
    env: c.napi_env,
    exports: c.napi_value,
    comptime name: [:0]const u8,
    comptime function: fn (
        env: c.napi_env,
        info: c.napi_callback_info,
    ) callconv(.C) c.napi_value,
) !void {
    var napi_function: c.napi_value = undefined;
    if (c.napi_create_function(env, null, 0, function, null, &napi_function) != c.napi_ok) {
        return JsThrow(env, "Failed to create function " ++ name ++ "().");
    }

    if (c.napi_set_named_property(env, exports, name, napi_function) != c.napi_ok) {
        return JsThrow(env, "Failed to add " ++ name ++ "() to exports.");
    }
}

export fn napi_register_module_v1(env: c.napi_env, exports: c.napi_value) c.napi_value {
    register_function(env, exports, "createEnv", createEnv) catch return null;
    register_function(env, exports, "setBatchBuffer", setBatchBuffer) catch return null;
    register_function(env, exports, "getBatch", getBatch) catch return null;
    register_function(env, exports, "cursorSet", cursorSet) catch return null;
    register_function(env, exports, "cursorGet", cursorGet) catch return null;

    // register_function(env, exports, "txnStart",txnStart ) catch return null;
    // register_function(env, exports, "txnSet",txnSet ) catch return null;
    // register_function(env, exports, "txnGet",txnGet ) catch return null;
    // register_function(env, exports, "txnCommit",txnCommit ) catch return null;
    // register_function(env, exports, "txnAbort",txnAbort ) catch return null;

    return exports;
}

fn statusOk(env: c.napi_env, isOk: bool) c.napi_value {
    var number: c.napi_value = undefined;
    if (isOk == true) {
        _ = c.napi_create_uint32(env, 1, &number);
    } else {
        _ = c.napi_create_uint32(env, 0, &number);
    }
    return number;
}

fn createEnv(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;
    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }
    var strlen: usize = undefined;
    // dynamic allocator?
    var memory: [256]u8 = undefined;

    // std.debug.print("============ Create db on path {any}\n", .{argv[0]});

    _ = c.napi_get_value_string_utf8(env, argv[0], &memory, 256, &strlen);

    // std.debug.print("============ Create db on path {d} SIZE boink\n", .{strlen});

    // std.debug.print("============ Create db on path {any} boink\n", .{memory});

    const path = memory[0..strlen];
    // std.debug.print("============ Create db on path {s}\n", .{path});

    if (dbEnvIsDefined) {
        dbEnv.deinit();
    }

    dbEnv = Environment.init(path.ptr, .{
        .map_size = 1000 * 1024 * 1024 * 1024,
        .max_dbs = 20_000_000,
        .no_sync = true,
    }) catch return statusOk(env, false);

    dbEnvIsDefined = true;

    return statusOk(env, true);
}

fn getBatch(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var buffer_size: usize = undefined;
    var buffer_contents: ?*anyopaque = null;
    if (c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&buffer_contents)), &buffer_size) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var dbi_name: ?*anyopaque = null;
    var dbi_name_length: usize = undefined;

    var hasDbi: bool = false;
    if (argc > 1) {
        _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(&dbi_name), &dbi_name_length);
        hasDbi = true;
    }

    var db: Database = undefined;

    const txn = Transaction.init(dbEnv, .{ .mode = .ReadOnly }) catch {
        JsThrow(env, "Failed Transaction.init") catch return null;
    };

    if (hasDbi) {
        db = txn.database(@ptrCast(dbi_name), .{ .integer_key = true }) catch {
            JsThrow(env, "Failed txn.database") catch return null;
        };
    } else {
        db = txn.database(null, .{ .integer_key = true }) catch {
            JsThrow(env, "Failed txn.database") catch return null;
        };
    }

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

        dbthrow(c.mdb_get(txn.ptr, db.dbi, &k, &v)) catch |err| {
            std.debug.print("Err = {s}\n", .{errorToStr(err)});
            JsThrow(env, "Failed mdb_get") catch return null;
        };

        values.append(v) catch {
            JsThrow(env, "Failed values.append") catch return null;
        };

        total_data_length += v.mv_size + 2;
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_data_length, &data, &result) != c.napi_ok) {
        JsThrow(env, "Failed to create ArrayBuffer") catch return null;
    }

    var last_pos: usize = 0;
    for (values.items) |*val| {
        // TODO: we can probably reduce the number of @mem* calls significantly

        // copy size
        @memcpy(@as([*]u8, @ptrCast(@alignCast(data)))[last_pos .. last_pos + 2], @as([*]u8, @ptrCast(&val.mv_size))[0..2]);
        last_pos += 2;
        // std.debug.print(
        //     "IN DATA= {d}, {X}\n",
        //     .{ @as([*]u16, @ptrCast(@alignCast(data)))[0..1], @as([*]u16, @ptrCast(@alignCast(data)))[0..1] },
        // );

        // copy data
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

    txn.commit() catch {
        JsThrow(env, "Failed to txn.commit") catch return null;
    };

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}

fn setBatchBuffer(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes

    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    // dbi is second argument

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
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

    if (!dbEnvIsDefined) {
        return statusOk(env, false);
    }

    const txn = Transaction.init(dbEnv, .{ .mode = .ReadWrite }) catch {
        return statusOk(env, false);
    };
    errdefer txn.abort();

    var db: Database = undefined;
    if (hasDbi) {

        //   @as([*]u8, @ptrCast(data))[last_pos .. last_pos + val.mv_size]

        // std.debug.print("Hello dbi {s}", .{@as([*]u8, @ptrCast(dbi_name))[0..dbi_name_length]});

        db = txn.database(
            @ptrCast(dbi_name),
            .{ .integer_key = true, .create = true },
        ) catch |err| {
            std.debug.print("============= {s}\n", .{@errorName(err)});

            std.debug.print("SIZE {d}\n", .{dbi_name_length});
            std.debug.print("Hello dbi SLICE {any}\n", .{@as([*]u8, @ptrCast(dbi_name))[0..dbi_name_length]});

            std.debug.print("Hello dbi {s}'n", .{@as([*:0]u8, @ptrCast(dbi_name))});

            std.debug.print("============= {s}\n", .{@errorName(err)});
            return statusOk(env, false);
        };
    } else {
        db = txn.database(
            null,
            .{ .integer_key = true, .create = true },
        ) catch return statusOk(env, false);
    }

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
        dbthrow(c.mdb_put(txn.ptr, db.dbi, &k, &v, 0)) catch return statusOk(env, false);

        // std.debug.print("\n=================\n", .{});
        // std.debug.print("KEY= {x}\n", .{key});
        // std.debug.print("value_size bits = 0x{x}\n", .{value_size});
        // std.debug.print("value_size= {d}\n", .{value_size});
        // std.debug.print("VALUE= {x}\n", .{value});
        // std.debug.print("VALUE= {s}\n", .{value});
        // std.debug.print("=================\n", .{});
        i = i + KEY_LEN + 2 + value_size;
    }

    txn.commit() catch return statusOk(env, false);

    // c.mdb_dbi_close(dbEnv.ptr, db.dbi);

    return statusOk(env, true);
}

fn cursorSet(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes

    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    // dbi is second argument

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
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

    if (!dbEnvIsDefined) {
        return statusOk(env, false);
    }
    const txn = Transaction.init(dbEnv, .{ .mode = .ReadWrite }) catch {
        return statusOk(env, false);
    };
    // errdefer txn.abort();

    var db: Database = undefined;
    if (hasDbi) {
        db = txn.database(
            @ptrCast(dbi_name),
            .{
                .integer_key = true,
                .create = true,
                // .dup_sort = true,
                // .integer_dup = true,
                // .dup_fixed = true,
            },
        ) catch |err| {
            std.debug.print("============= {s}\n", .{@errorName(err)});
            return statusOk(env, false);
        };
    } else {
        db = txn.database(
            null,
            .{
                .integer_key = true,
                .create = true,
                // .dup_sort = true,
                // .integer_dup = true,
                // .dup_fixed = true,
            },
        ) catch return statusOk(env, false);
    }

    const cur: Cursor = Cursor.init(db) catch {
        return statusOk(env, false);
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
        dbthrow(c.mdb_cursor_put(cur.ptr, &k, &v, 0)) catch return statusOk(env, false);

        // std.debug.print("\n=================\n", .{});
        // std.debug.print("KEY= {x}\n", .{key});
        // std.debug.print("value_size bits = 0x{x}\n", .{value_size});
        // std.debug.print("value_size= {d}\n", .{value_size});
        // std.debug.print("VALUE= {x}\n", .{value});
        // std.debug.print("VALUE= {s}\n", .{value});
        // std.debug.print("=================\n", .{});
        i = i + KEY_LEN + 2 + value_size;
    }

    txn.commit() catch return statusOk(env, false);

    return statusOk(env, true);
}

fn cursorGet(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var buffer_size: usize = undefined;
    var buffer_contents: ?*anyopaque = null;
    if (c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&buffer_contents)), &buffer_size) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var dbi_name: ?*anyopaque = null;
    var dbi_name_length: usize = undefined;

    var hasDbi: bool = false;
    if (argc > 1) {
        _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(&dbi_name), &dbi_name_length);
        hasDbi = true;
    }

    var db: Database = undefined;

    const txn = Transaction.init(dbEnv, .{ .mode = .ReadWrite }) catch {
        JsThrow(env, "Failed Transaction.init") catch return null;
    };

    if (hasDbi) {
        std.debug.print("Hello dbi {s}", .{@as([*:0]u8, @ptrCast(dbi_name))});

        db = txn.database(@ptrCast(dbi_name), .{
            .integer_key = true,
            .create = true,
            // .dup_sort = true,
            // .integer_dup = true,
            // .dup_fixed = true,
        }) catch |err| {
            std.debug.print("{s}", .{@errorName(err)});
            JsThrow(env, "Failed txn.database") catch return null;
        };
    } else {
        db = txn.database(null, .{
            .integer_key = true,
            .create = true,
            // .dup_sort = true,
            // .integer_dup = true,
            // .dup_fixed = true,
        }) catch {
            JsThrow(env, "Failed txn.database") catch return null;
        };
    }

    const cur: Cursor = Cursor.init(db) catch {
        return statusOk(env, false);
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

        // while()

        // std.debug.print("\nDOIBK", .{});

        k.mv_data = &(@as([*]u8, @ptrCast(buffer_contents.?))[i]);
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        dbthrow(c.mdb_cursor_get(cur.ptr, &k, &v, c.MDB_SET)) catch |err| {
            std.debug.print("\nErr = {s}\n", .{errorToStr(err)});
            // JsThrow(env, "DOES NOT EXIST mdb_get") catch {};
        };

        values.append(v) catch {
            JsThrow(env, "Failed values.append") catch return null;
        };

        total_data_length += v.mv_size + 2;
    }

    // std.debug.print("\nDOIBK2", .{});

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_data_length, &data, &result) != c.napi_ok) {
        JsThrow(env, "Failed to create ArrayBuffer") catch return null;
    }

    var last_pos: usize = 0;
    for (values.items) |*val| {
        // TODO: we can probably reduce the number of @mem* calls significantly

        // copy size
        @memcpy(@as([*]u8, @ptrCast(@alignCast(data)))[last_pos .. last_pos + 2], @as([*]u8, @ptrCast(&val.mv_size))[0..2]);
        last_pos += 2;
        // std.debug.print(
        //     "IN DATA= {d}, {X}\n",
        //     .{ @as([*]u16, @ptrCast(@alignCast(data)))[0..1], @as([*]u16, @ptrCast(@alignCast(data)))[0..1] },
        // );

        // copy data
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

    txn.commit() catch {
        JsThrow(env, "Failed to txn.commit") catch return null;
    };

    // std.debug.print("FINAL MEM STATE= {x}\n", .{@as([*]u8, @ptrCast(data))[0..last_pos]});

    return result;
}
