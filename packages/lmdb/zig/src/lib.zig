const std = @import("std");
const c = @import("c.zig");
const Environment = @import("./Environment.zig");
const Transaction = @import("./Transaction.zig");
const errors = @import("./errors.zig");
const Error = errors.Error;

var dbEnv: Environment.Environment = undefined;

var dbEnvIsDefined: bool = false;

const TranslationError = error{ExceptionThrown};

pub fn throw(env: c.napi_env, comptime message: [:0]const u8) TranslationError {
    const result = c.napi_throw_error(env, null, message);
    switch (result) {
        c.napi_ok, c.napi_pending_exception => {},
        else => unreachable,
    }
    return TranslationError.ExceptionThrown;
}

pub fn errorToStr(err: Error) [*c]const u8 {
    if (err == Error.EnvDoesNotExist) {
        return "Env does not exist";
    } else {
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
        return throw(env, "Failed to create function " ++ name ++ "().");
    }

    if (c.napi_set_named_property(env, exports, name, napi_function) != c.napi_ok) {
        return throw(env, "Failed to add " ++ name ++ "() to exports.");
    }
}

export fn napi_register_module_v1(env: c.napi_env, exports: c.napi_value) c.napi_value {
    register_function(env, exports, "set", set) catch return null;
    register_function(env, exports, "createDb", createDb) catch return null;
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

fn createDb(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var argc: usize = 1;
    var argv: [1]c.napi_value = undefined;
    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        throw(env, "Failed to get args.") catch return null;
    }
    var strlen: usize = undefined;
    var memory: [16]u8 = undefined;
    _ = c.napi_get_value_string_utf8(env, argv[0], &memory, strlen, &strlen);
    const path = memory[0..strlen];
    std.debug.print("Create db on path {s}\n", .{path});

    if (dbEnvIsDefined) {
        dbEnv.deinit();
    }

    dbEnv = Environment.init(path.ptr, .{
        .map_size = 100 * 1024 * 1024 * 1024,
    }) catch return statusOk(env, false);

    dbEnvIsDefined = true;

    return statusOk(env, true);
}

fn set(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    // _ = info;

    var argc: usize = 2;
    var argv: [2]c.napi_value = undefined;

    if (c.napi_get_cb_info(env, info, &argc, &argv, null, null) != c.napi_ok) {
        throw(env, "Failed to get args.") catch return null;
    }

    var strlen: usize = undefined;

    // _ = c.napi_get_value_string_utf8(env, argv[0], null, 0, &strlen);
    // std.debug.print("snufff {d}\n", .{strlen});

    // max size 16
    var memory: [16]u8 = undefined;

    // var buffer: [10]u8 = undefined; // Define a buffer to hold the string

    _ = c.napi_get_value_string_utf8(env, argv[0], &memory, strlen, &strlen);

    std.debug.print("get stuff... {s}\n", .{memory[0..strlen]});

    // var value: [*c]u8 = undefined;

    // var memory2: [*c]u8 = undefined;

    // var anyopaque_pointer: ?*anyopaque = undefined;
    var size: usize = undefined;

    // var result: []const u8 = @as([*]u8, @ptrCast(anyopaque_pointer))[0..item_count];

    // _ = c.napi(env, argv[0], &memory2, strlen, &strlen);

    _ = c.napi_get_arraybuffer_info(env, argv[1], null, &size);
    // c.napi_get_value_u8

    // std.debug.print("snup snup {any}\n", .{anyopaque_pointer});
    std.debug.print("ffff snup {d}\n", .{size});

    // const result: []const u8 = @as([*]u8, @ptrCast(anyopaque_pointer))[0..size];

    // std.debug.print("ffff snup {any}\n", .{result});

    bla(memory[0..strlen], "bla") catch |err| return throwError(env, err);

    var number: c.napi_value = undefined;

    _ = c.napi_create_uint32(env, 1, &number);

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

/// Fun with bla!
/// pub fn bla(key: []const u8, value: []c.napi_value) !void {
pub fn bla(key: []const u8, value: []const u8) !void {
    if (!dbEnvIsDefined) {
        return Error.EnvDoesNotExist;
    }

    std.debug.print("key: {s}\n", .{key});
    std.debug.print("value: {any}\n", .{value});

    // key: []const u8, value: c.napi_value

    // defer env.deinit();

    const txn = try Transaction.init(dbEnv, .{ .mode = .ReadWrite });
    errdefer txn.abort();

    // // const currentTime = std.time.nanoTimestamp();

    try txn.set(key, value);

    // // var i: u32 = 0;
    // // var key: [4]u8 = undefined;
    // // const value = "bla";
    // // var buffer: [6]u8 = undefined; // Define a buffer to hold the string

    // // while (i < 1_000_000) : (i += 1) {
    // try txn.set(key, value);
    // // }

    // // std.debug.print("1M took ms: {}\n", .{@divFloor(std.time.nanoTimestamp() - currentTime, 1_000_000)});

    try txn.commit();
}
