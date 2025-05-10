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

inline fn calcTypedArraySize(arrayType: c.napi_typedarray_type, arrayLen: usize) usize {
    var size: usize = arrayLen;
    // TODO zig can't properly parse the enum c.napi_typedarray_type
    switch (arrayType) {
        //c.napi_typedarray_type.napi_int8_array, c.napi_typedarray_type.napi_uint8_array, c.napi_typedarray_type.napi_uint8_clamped_array => {
        0, 1, 2 => {
            // NOP
        },
        //c.napi_typedarray_type.napi_int16_array, c.napi_typedarray_type.napi_uint16_array => {
        3, 4 => {
            size *= 2;
        },
        //c.napi_typedarray_type.napi_int32_array, c.napi_typedarray_type.napi_uint32_array, c.napi_typedarray_type.napi_float32_array => {
        5, 6, 7 => {
            size *= 4;
        },
        //c.napi_typedarray_type.napi_float64_array, c.napi_typedarray_type.napi_bigint64_array, c.napi_typedarray_type.napi_biguint64_array => {
        8, 9, 10 => {
            size *= 8;
        },
        else => {
            // never
        },
    }
    return size;
}

pub inline fn get(comptime T: type, env: c.napi_env, value: c.napi_value) !T {
    var res: T = undefined;

    if (T == u8) {
        var x: u32 = undefined;
        if (c.napi_get_value_uint32(env, value, @ptrCast(&x)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == i8) {
        var x: i32 = undefined;
        if (c.napi_get_value_int32(env, value, @ptrCast(&x)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == u16) {
        var x: u32 = undefined;
        if (c.napi_get_value_uint32(env, value, @ptrCast(&x)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == i16) {
        if (c.napi_get_value_int16(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == u32) {
        if (c.napi_get_value_uint32(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == i32) {
        if (c.napi_get_value_int32(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == u64) {
        if (c.napi_get_value_bigint_uint64(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == i64) {
        if (c.napi_get_value_bigint_int64(env, value, @ptrCast(&res)) != c.napi_ok) {
            return errors.Napi.CannotGetInt;
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
        var arrayType: c.napi_typedarray_type = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0..size];
    }

    if (T == []u32) {
        var buffer: [*]u32 = undefined;
        var arrayType: c.napi_typedarray_type = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 4];
    }

    if (T == []u64) {
        var buffer: [*]u64 = undefined;
        var arrayType: c.napi_typedarray_type = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 8];
    }

    if (T == []f64) {
        var buffer: [*]f64 = undefined;
        var arrayType: c.napi_typedarray_type = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != c.napi_ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 8];
    }

    var external: ?*anyopaque = undefined;
    const x = c.napi_get_value_external(env, value, &external);
    if (x != c.napi_ok) {
        return errors.Napi.CannotGetExternal;
    }
    return @as(T, @ptrCast(@alignCast(external)));
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

pub fn getString(env: c.napi_env, value: c.napi_value) ![]u8 {
    var size: usize = undefined;
    if (c.napi_get_value_string_utf8(env, value, null, 0, @ptrCast(&size)) != c.napi_ok) {
        jsThrow(env, "Cannot get size for string");
        return errors.Napi.CannotGetString;
    }

    var buffer: [*]u8 = undefined;

    // wtf utf16...
    if (c.napi_get_value_string_utf8(env, value, @ptrCast(&buffer), size, null) != c.napi_ok) {
        jsThrow(env, "Cannot get fixed length string for variable");
        return errors.Napi.CannotGetString;
    }

    return buffer[0..size];
}
