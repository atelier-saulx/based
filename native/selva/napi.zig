const napi = @import("../napi.zig");
const selva = @import("selva.zig");

fn _strerror(napi_env: napi.Env, nfo: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, napi_env, nfo);
    const err = try napi.get(i32, napi_env, args[0]);
    var result: napi.Value = undefined;
    var copied: selva.c.bool = undefined;
    const str = selva.strerror(err);

    _ = napi.c.node_api_create_external_string_latin1(napi_env, @constCast(str.ptr), str.len, null, null, &result, &copied);
    return result;
}

pub fn strerror(napi_env: napi.Env, nfo: napi.Info) callconv(.c) napi.Value {
    return _strerror(napi_env, nfo) catch return null;
}

pub fn langAll(env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    var result: napi.Value = undefined;
    var copied: selva.c.bool = undefined;

    _ = napi.c.node_api_create_external_string_latin1(env, @constCast(selva.c.selva_lang_all_str), selva.c.selva_lang_all_len, null, null, &result, &copied);
    return result;
}
