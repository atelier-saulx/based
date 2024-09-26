const std = @import("std");
const c = @import("c.zig");
const dump = @import("./db/dump.zig");
const info = @import("./db/info.zig");
const errors = @import("errors.zig");
const Query = @import("./query/query.zig");
const modify = @import("./modify/modify.zig").modify;
const lifeTime = @import("./db/lifeTime.zig");
const schema = @import("./schema/schema.zig");

const jsThrow = errors.jsThrow;
const dbthrow = errors.mdb;

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

// TODO: global structs create on init here

export fn napi_register_module_v1(env: c.napi_env, exports: c.napi_value) c.napi_value {
    std.debug.print("register napi fn \n", .{});
    // need every thing here

    // here a stack allocated global struct
    // also add multipl envs as possiblity that can be part of the same struct
    // so createEnv will create a nested global struct

    // destroy env (ignore file path)
    // close env
    // close dbis
    // remove transactions
    // startEnv
    // stopEnv those are the 2 fns

    registerFunction(env, exports, "start", lifeTime.start) catch return null;
    registerFunction(env, exports, "stop", lifeTime.stop) catch return null;
    registerFunction(env, exports, "save", dump.save) catch return null;
    registerFunction(env, exports, "isSaveReady", dump.isReady) catch return null;
    registerFunction(env, exports, "getTypeInfo", info.ofType) catch return null;
    registerFunction(env, exports, "getQueryById", Query.getQueryId) catch return null;
    registerFunction(env, exports, "getQueryByIds", Query.getQueryIds) catch return null;
    registerFunction(env, exports, "getQuery", Query.getQuery) catch return null;
    registerFunction(env, exports, "getQuerySortAsc", Query.getQuerySortAsc) catch return null;
    registerFunction(env, exports, "getQuerySortDesc", Query.getQuerySortDesc) catch return null;
    registerFunction(env, exports, "getQueryIdsSortAsc", Query.getQueryIdsSortAsc) catch return null;
    registerFunction(env, exports, "getQueryIdsSortDesc", Query.getQueryIdsSortDesc) catch return null;
    registerFunction(env, exports, "getQueryIdsSortAscLarge", Query.getQueryIdsSortAscLarge) catch return null;
    registerFunction(env, exports, "getQueryIdsSortDescLarge", Query.getQueryIdsSortDescLarge) catch return null;
    registerFunction(env, exports, "getQueryIdsSortAscManual", Query.getQueryIdsSortDescManual) catch return null;
    registerFunction(env, exports, "getQueryIdsSortDescManual", Query.getQueryIdsSortAscManual) catch return null;
    registerFunction(env, exports, "modify", modify) catch return null;

    registerFunction(env, exports, "updateSchema", schema.updateSchema) catch return null;

    return exports;
}
