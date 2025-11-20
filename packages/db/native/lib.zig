const std = @import("std");
const selva = @import("selva.zig").c;
const dump = @import("./db/dump.zig");
const info = @import("./db/info.zig");
const errors = @import("errors.zig");
const Query = @import("./query/query.zig");
const modify = @import("./modify/modify.zig");
const lifeTime = @import("./db/lifeTime.zig");
const schema = @import("./schema/schema.zig");
const sort = @import("./db/sort.zig");
const string = @import("./string.zig");
const napi = @import("./napi.zig");
const jsThrow = errors.jsThrow;
const dbthrow = errors.mdb;
const colvecTest = @import("./colvec.zig").colvec;
const dbCtx = @import("./db/ctx.zig");
const subscriptions = @import("./db/subscription/subscription.zig");

const strerror_zig = @import("selva.zig").strerror_zig;
const NapiError = error{NapiError};
const DbCtx = dbCtx.DbCtx;

pub fn registerFunction(
    env: napi.Env,
    exports: napi.Value,
    comptime name: [:0]const u8,
    comptime function: fn (
        env: napi.Env,
        info: napi.Info,
    ) callconv(.c) napi.Value,
) !void {
    var napi_function: napi.Value = undefined;
    if (napi.c.napi_create_function(env, null, 0, function, null, &napi_function) != napi.Ok) {
        _ = jsThrow(env, "Failed to create function " ++ name ++ "().");
        return NapiError.NapiError;
    }
    if (napi.c.napi_set_named_property(env, exports, name, napi_function) != napi.Ok) {
        _ = jsThrow(env, "Failed to add " ++ name ++ "() to exports.");
        return NapiError.NapiError;
    }
}

fn externalFromInt(napi_env: napi.Env, inf: napi.Info) callconv(.c) napi.Value {
    return _externalFromInt(napi_env, inf) catch return null;
}

fn intFromExternal(napi_env: napi.Env, inf: napi.Info) callconv(.c) napi.Value {
    return _intFromExternal(napi_env, inf) catch return null;
}

fn _intFromExternal(napi_env: napi.Env, inf: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, napi_env, inf);
    const external = try napi.get(*DbCtx, napi_env, args[0]);
    var result: napi.Value = undefined;
    if (napi.c.napi_create_bigint_uint64(napi_env, @intFromPtr(external), &result) != napi.Ok) {
        return null;
    }
    return result;
}

fn _externalFromInt(napi_env: napi.Env, inf: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, napi_env, inf);
    var address: u64 = undefined;
    var result: napi.Value = undefined;
    var lossless: bool = undefined;
    if (napi.c.napi_get_value_bigint_uint64(napi_env, args[0], &address, &lossless) != napi.Ok) {
        return errors.Napi.CannotGetInt;
    }
    if (napi.c.napi_create_external(napi_env, @ptrFromInt(@as(usize, address)), null, null, &result) != napi.Ok) {
        return null;
    }
    return result;
}

fn membarSyncRead(_: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    selva.membar_sync_read();
    return null;
}

fn membarSyncWrite(_: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    selva.membar_sync_write();
    return null;
}

fn _selvaStrerror(napi_env: napi.Env, nfo: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, napi_env, nfo);
    const err = try napi.get(i32, napi_env, args[0]);
    var result: napi.Value = undefined;
    var copied: selva.bool = undefined;
    const str = strerror_zig(err);
    // std.debug.print("{any} {any} {any} \n", .{ result, copied, str });
    _ = napi.c.node_api_create_external_string_latin1(napi_env, @constCast(str.ptr), str.len, null, null, &result, &copied);
    return result;
}

fn selvaStrerror(napi_env: napi.Env, nfo: napi.Info) callconv(.c) napi.Value {
    return _selvaStrerror(napi_env, nfo) catch return null;
}

fn selvaLangAll(napi_env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    var result: napi.Value = undefined;
    var copied: selva.bool = undefined;

    _ = napi.c.node_api_create_external_string_latin1(napi_env, @constCast(selva.selva_lang_all_str), selva.selva_lang_all_len, null, null, &result, &copied);
    return result;
}

export fn napi_register_module_v1(env: napi.Env, exports: napi.Value) napi.Value {
    registerFunction(env, exports, "start", lifeTime.start) catch return null;
    registerFunction(env, exports, "stop", lifeTime.stop) catch return null;
    registerFunction(env, exports, "getThreadId", lifeTime.getThreadId) catch return null;

    registerFunction(env, exports, "createThreadCtx", lifeTime.createThreadCtx) catch return null;
    registerFunction(env, exports, "destroyThreadCtx", lifeTime.destroyThreadCtx) catch return null;

    registerFunction(env, exports, "saveCommon", dump.saveCommon) catch return null;
    registerFunction(env, exports, "saveBlock", dump.saveBlock) catch return null;
    registerFunction(env, exports, "loadCommon", dump.loadCommon) catch return null;
    registerFunction(env, exports, "loadBlock", dump.loadBlock) catch return null;
    registerFunction(env, exports, "delBlock", dump.delBlock) catch return null;
    registerFunction(env, exports, "getNodeRangeHash", info.nodeRangeHash) catch return null;
    registerFunction(env, exports, "setSchemaType", schema.setSchemaType) catch return null;
    registerFunction(env, exports, "setSchemaIds", schema.setSchemaIds) catch return null;
    registerFunction(env, exports, "getSchemaIds", schema.getSchemaIds) catch return null;

    // registerFunction(env, exports, "getQueryBuf", Query.getQueryBuf) catch return null;

    registerFunction(env, exports, "getQueryBufThread", Query.getQueryBufThread) catch return null;
    registerFunction(env, exports, "modifyThread", modify.modifyThread) catch return null;

    // this is temp will be called on callback
    registerFunction(env, exports, "getQueryResults", Query.getQueryResults) catch return null;

    registerFunction(env, exports, "modify", modify.modify) catch return null;
    registerFunction(env, exports, "externalFromInt", externalFromInt) catch return null;
    registerFunction(env, exports, "intFromExternal", intFromExternal) catch return null;

    registerFunction(env, exports, "hashCreate", string.hashCreate) catch return null;
    registerFunction(env, exports, "hashReset", string.hashReset) catch return null;
    registerFunction(env, exports, "hashUpdate", string.hashUpdate) catch return null;
    registerFunction(env, exports, "hashDigest", string.hashDigest) catch return null;
    registerFunction(env, exports, "xxHash64", string.xxHash64) catch return null;
    registerFunction(env, exports, "crc32", string.crc32) catch return null;
    registerFunction(env, exports, "compress", string.compress) catch return null;
    registerFunction(env, exports, "decompress", string.decompress) catch return null;
    registerFunction(env, exports, "createCompressor", string.createCompressor) catch return null;
    registerFunction(env, exports, "createDecompressor", string.createDecompressor) catch return null;
    registerFunction(env, exports, "equals", string.equals) catch return null;

    registerFunction(env, exports, "createSortIndex", sort.createSortIndexNode) catch return null;
    registerFunction(env, exports, "destroySortIndex", sort.destroySortIndexNode) catch return null;

    registerFunction(env, exports, "membarSyncRead", membarSyncRead) catch return null;
    registerFunction(env, exports, "membarSyncWrite", membarSyncWrite) catch return null;

    registerFunction(env, exports, "selvaStrerror", selvaStrerror) catch return null;

    registerFunction(env, exports, "selvaLangAll", selvaLangAll) catch return null;

    registerFunction(env, exports, "colvecTest", colvecTest) catch return null;

    // subscriptions
    registerFunction(env, exports, "addMultiSubscription", subscriptions.addMultiSubscription) catch return null;
    registerFunction(env, exports, "removeMultiSubscription", subscriptions.removeMultiSubscription) catch return null;
    registerFunction(env, exports, "addIdSubscription", subscriptions.addIdSubscription) catch return null;
    registerFunction(env, exports, "removeIdSubscription", subscriptions.removeIdSubscription) catch return null;
    registerFunction(env, exports, "getMarkedIdSubscriptions", subscriptions.getMarkedIdSubscriptions) catch return null;
    registerFunction(env, exports, "getMarkedMultiSubscriptions", subscriptions.getMarkedMultiSubscriptions) catch return null;

    return exports;
}
