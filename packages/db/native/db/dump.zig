const c = @import("../c.zig");

pub fn saveDump(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {

    // const args = try napi.getArgs(2, napi_env, info);
    // const path = try napi.getBuffer("createEnv", napi_env, args[0]);
    return null;
}

pub fn dumpIsReady(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return null;
}

pub fn loadDump(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return null;
}

pub fn verifyDump(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return null;
}
