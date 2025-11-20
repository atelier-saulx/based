const errors = @import("errors.zig");
const std = @import("std");

pub const c = @cImport({
    @cDefine("NAPI_VERSION", "10");
    @cInclude("node_api.h");
    @cInclude("string.h");
});

pub const Env = c.napi_env;
pub const Info = c.napi_callback_info;
pub const Value = c.napi_value;
pub const ValueType = c.napi_value_type;
pub const TypedArrayType = c.napi_typedarray_type;
pub const Ok = c.napi_ok;

pub fn jsThrow(env: Env, message: [:0]const u8) void {
    const result = c.napi_throw_error(env, null, message);
    switch (result) {
        Ok, c.napi_pending_exception => {},
        else => unreachable,
    }
}

inline fn calcTypedArraySize(arrayType: TypedArrayType, arrayLen: usize) usize {
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

pub inline fn get(comptime T: type, env: Env, value: Value) !T {
    var res: T = undefined;

    if (T == u8) {
        var x: u32 = undefined;
        if (c.napi_get_value_uint32(env, value, @ptrCast(&x)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == i8) {
        var x: i32 = undefined;
        if (c.napi_get_value_int32(env, value, @ptrCast(&x)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == u16) {
        var x: u32 = undefined;
        if (c.napi_get_value_uint32(env, value, @ptrCast(&x)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        res = @truncate(x);
        return res;
    }

    if (T == i16) {
        if (c.napi_get_value_int16(env, value, @ptrCast(&res)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == u32) {
        if (c.napi_get_value_uint32(env, value, @ptrCast(&res)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == i32) {
        if (c.napi_get_value_int32(env, value, @ptrCast(&res)) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == u64) {
        var tmp: bool = undefined;
        if (c.napi_get_value_bigint_uint64(env, value, @ptrCast(&res), &tmp) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == i64) {
        var tmp: bool = undefined;
        if (c.napi_get_value_bigint_int64(env, value, @ptrCast(&res), &tmp) != Ok) {
            return errors.Napi.CannotGetInt;
        }
        return res;
    }

    if (T == bool) {
        if (c.napi_get_value_bool(env, value, @ptrCast(&res)) != Ok) {
            return errors.Napi.CannotGetBool;
        }
        return res;
    }

    if (T == []u8) {
        var buffer: [*]u8 = undefined;
        var arrayType: TypedArrayType = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != Ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0..size];
    }

    if (T == []u32) {
        var buffer: [*]u32 = undefined;
        var arrayType: TypedArrayType = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != Ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 4];
    }

    if (T == []u64) {
        var buffer: [*]u64 = undefined;
        var arrayType: TypedArrayType = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != Ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 8];
    }

    if (T == []f64) {
        var buffer: [*]f64 = undefined;
        var arrayType: TypedArrayType = undefined;
        var arrayLen: usize = undefined;
        if (c.napi_get_typedarray_info(env, value, &arrayType, &arrayLen, @ptrCast(&buffer), null, null) != Ok) {
            return errors.Napi.CannotGetBuffer;
        }
        const size: usize = calcTypedArraySize(arrayType, arrayLen);
        return buffer[0 .. size / 8];
    }

    var external: ?*anyopaque = undefined;
    const x = c.napi_get_value_external(env, value, &external);
    if (x != Ok) {
        return errors.Napi.CannotGetExternal;
    }
    return @as(T, @ptrCast(@alignCast(external)));
}

pub fn getType(env: Env, value: Value) !ValueType {
    var t: ValueType = undefined;

    if (c.napi_typeof(env, value, &t) != Ok) {
        jsThrow(env, "Failed to get args.");
        return errors.Napi.CannotGetType;
    }

    return t;
}

pub fn getArgs(comptime totalArgs: comptime_int, env: Env, info: Info) ![totalArgs]Value {
    var argv: [totalArgs]Value = undefined;
    var size: usize = totalArgs;
    if (c.napi_get_cb_info(env, info, &size, &argv, null, null) != Ok) {
        jsThrow(env, "Failed to get args.");
        return errors.Napi.CannotGetBuffer;
    }
    return argv;
}
