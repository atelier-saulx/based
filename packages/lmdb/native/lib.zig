const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Error = errors.Error;
const Gets = @import("get.zig");
const Envs = @import("env.zig");
const Sets = @import("set.zig");

const jsThrow = errors.jsThrow;
const createEnv = Envs.createEnv;
const dbEnv = Envs.env;
const dbEnvIsDefined = Envs.dbEnvIsDefined;
const getBatch8 = Gets.getBatch8;
const getBatch4 = Gets.getBatch4;
const setBatch8 = Sets.setBatch8;
const setBatch4 = Sets.setBatch4;

const dbthrow = errors.mdbThrow;

const NapiError = error{NapiError};

pub fn throwError(env: c.napi_env, err: Error) c.napi_value {
    const result = c.napi_throw_error(env, null, @errorName(err));
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
        _ = jsThrow(env, "Failed to create function " ++ name ++ "().");
        return NapiError.NapiError;
    }

    if (c.napi_set_named_property(env, exports, name, napi_function) != c.napi_ok) {
        _ = jsThrow(env, "Failed to add " ++ name ++ "() to exports.");
        return NapiError.NapiError;
    }
}

export fn napi_register_module_v1(env: c.napi_env, exports: c.napi_value) c.napi_value {
    register_function(env, exports, "createEnv", createEnv) catch return null;
    register_function(env, exports, "getBatch4", getBatch4) catch return null;
    register_function(env, exports, "getBatch8", getBatch8) catch return null;
    register_function(env, exports, "setBatch4", setBatch4) catch return null;
    register_function(env, exports, "setBatch8", setBatch8) catch return null;
    return exports;
}
