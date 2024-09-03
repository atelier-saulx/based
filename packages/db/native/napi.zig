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

pub fn get(comptime T: type, env: c.napi_env, value: c.napi_value) !T {
    // std.debug.print("hello {any} \n", .{@typeInfo(T)});
    var res: T = undefined;

    if (T == u8) {
        if (c.napi_get_value_uint8(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint32;
        }
        return res;
    }

    if (T == i8) {
        if (c.napi_get_value_int8(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint32;
        }
        return res;
    }

    if (T == u16) {
        if (c.napi_get_value_uint16(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint32;
        }
        return res;
    }

    if (T == i16) {
        if (c.napi_get_value_int16(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint32;
        }
        return res;
    }

    if (T == u32) {
        if (c.napi_get_value_uint32(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint32;
        }
        return res;
    }

    if (T == i32) {
        if (c.napi_get_value_int32(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt32;
        }
        return res;
    }

    if (T == u64) {
        if (c.napi_get_value_bigiint_uint64(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetUint64;
        }
        return res;
    }

    if (T == i64) {
        if (c.napi_get_value_bigiint_int64(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt64;
        }
        return res;
    }

    if (T == bool) {
        if (c.napi_get_value_bool(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetBool;
        }
        return res;
    }

    if (T == []u8) {
        var buffer: [*]u8 = undefined;
        var size: usize = undefined;
        if (c.napi_get_buffer_info(env, value, @ptrCast(&buffer), @ptrCast(&size)) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        return buffer[0..size];
    }

    if (T == []u32) {
        var buffer: [*]u32 = undefined;
        var size: usize = undefined;
        if (c.napi_get_buffer_info(env, value, @ptrCast(&buffer), @ptrCast(&size)) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        return buffer[0 .. size / 4];
    }

    if (T == []u32) {
        var buffer: [*]u32 = undefined;
        var size: usize = undefined;
        if (c.napi_get_buffer_info(env, value, @ptrCast(&buffer), @ptrCast(&size)) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        return buffer[0 .. size / 4];
    }
}

pub fn getType(env: c.napi_env, value: c.napi_value) !c.napi_valuetype {
    var t: c.napi_valuetype = undefined;

    if (c.napi_typeof(env, value, &t) != c.napi_ok) {
        jsThrow(env, "Failed to get args.");
        return errors.Napi.CannotGetType;
    }

    return t;
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

pub fn getString(comptime name: []const u8, env: c.napi_env, value: c.napi_value) ![]u8 {
    var size: usize = undefined;
    if (c.napi_get_value_string_utf8(env, value, null, 0, @ptrCast(&size)) != c.napi_ok) {
        jsThrow(env, "Cannot get size for: " ++ name);
        return errors.Napi.CannotGetString;
    }
    var buffer: [*]u8 = undefined;
    if (c.napi_get_value_string_utf8(env, value, @ptrCast(&buffer), size, null) != c.napi_ok) {
        jsThrow(env, "Cannot get fixed length string for variable: " ++ name);
        return errors.Napi.CannotGetString;
    }
    return buffer[0..size];
}

pub fn getStringFixedLength(comptime name: []const u8, comptime len: comptime_int, env: c.napi_env, value: c.napi_value) ![len]u8 {
    var buffer: [len + 1]u8 = undefined;
    if (c.napi_get_value_string_utf8(env, value, @ptrCast(&buffer), len + 1, null) != c.napi_ok) {
        jsThrow(env, "Cannot get fixed length string for variable: " ++ name);
        return errors.Napi.CannotGetString;
    }
    var bufferNoNull: [len]u8 = undefined;
    @memcpy(bufferNoNull[0..len], buffer[0..len]);
    return bufferNoNull;
}
