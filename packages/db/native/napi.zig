const c = @import("c.zig");
const errors = @import("errors.zig");
const std = @import("std");

pub fn jsThrow(env: c.napi_env, message: [:0]const u8) void {
    const result = c.napi_throw_error(env, null, message);
    switch (result) {
        c.napi_ok, c.napi_pending_exception => {},
        else => unreachable,
    }
}

pub fn getArgs(comptime totalArgs: comptime_int, env: c.napi_env, info: c.napi_callback_info) ![totalArgs]c.napi_value {
    var argv: [totalArgs]c.napi_value = undefined;
    var size: usize = totalArgs;
    if (c.napi_get_cb_info(env, info, &size, &argv, null, null) != c.napi_ok) {
        jsThrow(env, "Failed to get args.");
        return errors.Napi.CannotGetBuffer;
    }
    return argv;
}

pub fn getBuffer(comptime name: []const u8, env: c.napi_env, value: c.napi_value) ![]u8 {
    var buffer: [*]u8 = undefined;
    var size: usize = undefined;
    if (c.napi_get_buffer_info(env, value, @ptrCast(&buffer), @ptrCast(&size)) != c.napi_ok) {
        jsThrow(env, "Cannot get buffer for variable: " ++ name);
        return errors.Napi.CannotGetBuffer;
    }
    return @as([*]u8, buffer)[0..size];
}

pub fn getStringFixedLength(comptime name: []const u8, comptime len: comptime_int, env: c.napi_env, value: c.napi_value) ![len]u8 {
    var buffer: [len]u8 = undefined;
    if (c.napi_get_value_string_utf8(env, value, @ptrCast(&buffer), len + 1, null) != c.napi_ok) {
        jsThrow(env, "Cannot get fixed length string for variable: " ++ name);
        return errors.Napi.CannotGetString;
    }
    return buffer;
}

pub fn getInt32(comptime name: []const u8, env: c.napi_env, value: c.napi_value) !u32 {
    var res: u32 = undefined;
    if (c.napi_get_value_int32(env, value, @ptrCast(&res)) != c.napi_ok) {
        jsThrow(env, "Cannot get Int32 for variable: " ++ name);
        return errors.Napi.CannotGetInt32;
    }
    return res;
}