const std = @import("std");
const c = @import("c.zig");
const Environment = @import("./Environment.zig");
const Transaction = @import("./Transaction.zig");
const Database = @import("./Database.zig");
const errors = @import("./errors.zig");
const Error = errors.Error;

var dbEnv: Environment.Environment = undefined;

var dbEnvIsDefined: bool = false;

const TranslationError = error{ExceptionThrown};

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
    if (err == Error.NO_DB_ENV) {
        return "Env does not exist";
    } else {
        std.debug.print("ERROR {any}\n", .{err});
        return "Unknown error";
    }
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
    comptime function: fn (env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value,
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
    register_function(env, exports, "set", set) catch return null;
    register_function(env, exports, "get", get) catch return null;
    register_function(env, exports, "createDb", createDb) catch return null;
    register_function(env, exports, "setBatch", setBatch) catch return null;
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

// pass pointer of env (later)
fn createDb(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;
    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }
    var strlen: usize = undefined;
    // dynamic allocator?
    var memory: [16]u8 = undefined;

    // std.debug.print("============ Create db on path {any}\n", .{argv[0]});

    _ = c.napi_get_value_string_utf8(env, argv[0], &memory, 16, &strlen);

    // std.debug.print("============ Create db on path {d} SIZE boink\n", .{strlen});

    // std.debug.print("============ Create db on path {any} boink\n", .{memory});

    const path = memory[0..strlen];
    // std.debug.print("============ Create db on path {s}\n", .{path});

    if (dbEnvIsDefined) {
        dbEnv.deinit();
    }

    dbEnv = Environment.init(path.ptr, .{ .map_size = 100 * 1024 * 1024 * 1024, .max_dbs = 200 }) catch return statusOk(env, false);

    dbEnvIsDefined = true;

    return statusOk(env, true);
}
fn get(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var keysize: usize = undefined;
    var keyValue: []u8 = undefined;
    _ = c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&keyValue)), &keysize);

    const value_buffer = getKey(keyValue) catch |err| return throwError(env, err);

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    // const pointer: [*c]?*anyopaque = @ptrCast(@alignCast(&result.ptr));

    if (c.napi_create_buffer(env, value_buffer.len, &data, &result) != c.napi_ok) {
        JsThrow(env, "Failed to create ArrayBuffer") catch return null;
    }

    std.mem.copyForwards(u8, @as([*]u8, @ptrCast(data))[0..value_buffer.len], value_buffer[0..value_buffer.len]);

    return result;
}

fn set(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    // _ = info;

    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    var value_size: usize = undefined;
    var value_buffer: []u8 = undefined;
    _ = c.napi_get_buffer_info(env, argv[1], @ptrCast(@alignCast(&value_buffer)), &value_size);

    var key_size: usize = undefined;
    var key_buffer: []u8 = undefined;
    _ = c.napi_get_buffer_info(env, argv[0], @ptrCast(@alignCast(&key_buffer)), &key_size);

    // std.debug.print("SET keySize = {d}\n", .{key_size});
    // std.debug.print("SET key = {x}\n", .{key_buffer[0..20]});
    // std.debug.print("SET valueSize = {d}\n", .{value_size});
    // std.debug.print("SET value = {x}\n", .{value_buffer[0..value_size]});

    writeSingle(key_buffer, value_buffer, value_size) catch |err| return throwError(env, err);

    return statusOk(env, true);
}

//   map_size: usize = 10 * 1024 * 1024,
//     max_dbs: u32 = 0,
//     max_readers: u32 = 126,
//     read_only: bool = false,
//     write_map: bool = false,
//     no_tls: bool = false,
//     no_lock: bool = false,
//     mode: u16 = 0o664,

pub fn writeSingle(key: []u8, value: []u8, sizeValue: usize) !void {
    if (!dbEnvIsDefined) {
        return Error.NO_DB_ENV;
    }
    // _ = sizeValue;
    const txn = try Transaction.init(dbEnv, .{ .mode = .ReadWrite });
    errdefer txn.abort();

    const db: Database = try txn.database(null, .{ .integer_key = true });

    var k: c.MDB_val = .{ .mv_size = 20, .mv_data = @ptrCast(key) };
    var v: c.MDB_val = .{ .mv_size = sizeValue, .mv_data = @ptrCast(value) };

    try dbthrow(c.mdb_put(txn.ptr, db.dbi, &k, &v, 0));
    try txn.commit();
}

fn setBatch(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    // in js: setBatch([key1, value1, key2, value2])

    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        JsThrow(env, "Failed to get args.") catch return null;
    }

    writeMultiple(env, argv[0]) catch |err| return throwError(env, err);
    return statusOk(env, true);
}

fn writeMultiple(env: c.napi_env, batch: c.napi_value) !void {
    var arraySize: u32 = undefined;

    if (c.napi_get_array_length(env, batch, &arraySize) != c.napi_ok) {
        return Error.UNKNOWN_ERROR;
    }

    if (!dbEnvIsDefined) {
        return Error.NO_DB_ENV;
    }
    const txn = try Transaction.init(dbEnv, .{ .mode = .ReadWrite });
    errdefer txn.abort();

    const db: Database = try txn.database(null, .{ .integer_key = true });

    var key: c.napi_value = undefined;
    var value: c.napi_value = undefined;
    var keyChars: [20]u8 = undefined;
    var keySize: usize = undefined;
    var valueSize: usize = undefined;
    var index: u32 = 0;
    while (index < arraySize) : (index += 2) {
        if (c.napi_get_element(env, batch, index, &key) != c.napi_ok) {
            return Error.UNKNOWN_ERROR;
        }
        if (c.napi_get_element(env, batch, index + 1, &value) != c.napi_ok) {
            return Error.UNKNOWN_ERROR;
        }

        _ = c.napi_get_value_string_utf8(env, key, &keyChars, 20, &keySize);
        _ = c.napi_get_buffer_info(env, value, null, &valueSize);

        var k: c.MDB_val = .{ .mv_size = 20, .mv_data = @ptrCast(key) };
        var v: c.MDB_val = .{ .mv_size = valueSize, .mv_data = value };
        try dbthrow(c.mdb_put(txn.ptr, db.dbi, &k, &v, 0));
    }

    try txn.commit();
}

fn getKey(key: []u8) ![]u8 {
    const txn = try Transaction.init(dbEnv, .{ .mode = .ReadOnly });
    errdefer txn.abort();

    var k: c.MDB_val = .{ .mv_size = 20, .mv_data = @ptrCast(key) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

    const db: Database = try txn.database(null, .{ .integer_key = true });
    try dbthrow(c.mdb_get(txn.ptr, db.dbi, &k, &v));
    try txn.commit();

    // std.debug.print("GET valueSize = {d}\n", .{v.mv_size});
    // std.debug.print("GET value = {x}\n", .{@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size]});

    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}
