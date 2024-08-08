const std = @import("std");
const c = @import("c.zig");
const errors = @import("errors.zig");
const Envs = @import("env/env.zig");
const stat = @import("env/stat.zig").stat;
const Query = @import("./query/query.zig");
const modify = @import("./modify/modify.zig").modify;

const jsThrow = errors.jsThrow;
const createEnv = Envs.createEnv;
const dbEnv = Envs.env;
const dbEnvIsDefined = Envs.dbEnvIsDefined;
const dbthrow = errors.mdbCheck;

const NapiError = error{NapiError};

pub fn registerFunction(
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
    registerFunction(env, exports, "createEnv", createEnv) catch return null;
    registerFunction(env, exports, "stat", stat) catch return null;
    registerFunction(env, exports, "getQueryById", Query.getQueryId) catch return null;
    registerFunction(env, exports, "getQueryByIds", Query.getQueryIds) catch return null;
    registerFunction(env, exports, "getQuery", Query.getQuery) catch return null;
    registerFunction(env, exports, "getQuerySort", Query.getQuerySort) catch return null;
    registerFunction(env, exports, "modify", modify) catch return null;
    return exports;
}
