const std = @import("std");
const c = @import("c.zig");
const selva = @import("selva.zig");
const dump = @import("./db/dump.zig");
const info = @import("./db/info.zig");
const errors = @import("errors.zig");
const Query = @import("./query/query.zig");
const modify = @import("./modify/modify.zig").modify;
const lifeTime = @import("./db/lifeTime.zig");
const history = @import("./db/history.zig");
const schema = @import("./schema/schema.zig");
const db = @import("./db/db.zig");
const sort = @import("./db/sort.zig");
const string = @import("./string.zig");
const napi = @import("./napi.zig");
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

fn workerCtxDeinit(_: c.napi_env, _: ?*anyopaque, _: ?*anyopaque) callconv(.C) void {
    selva.worker_ctx_deinit();
}

fn workerCtxInit(env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    var result: c.napi_value = undefined;
    _ = c.napi_create_external(env, null, workerCtxDeinit, null, &result);

    selva.worker_ctx_init();

    return result;
}

fn externalFromInt(napi_env: c.napi_env, inf: c.napi_callback_info) callconv(.C) c.napi_value {
    return _externalFromInt(napi_env, inf) catch return null;
}

fn intFromExternal(napi_env: c.napi_env, inf: c.napi_callback_info) callconv(.C) c.napi_value {
    return _intFromExternal(napi_env, inf) catch return null;
}

fn _intFromExternal(napi_env: c.napi_env, inf: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, inf);
    const external = try napi.get(*db.DbCtx, napi_env, args[0]);
    var result: c.napi_value = undefined;

    if (c.napi_create_bigint_uint64(napi_env, @intFromPtr(external), &result) != c.napi_ok) {
        return null;
    }

    return result;
}

fn _externalFromInt(napi_env: c.napi_env, inf: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, inf);
    var address: u64 = undefined;
    var result: c.napi_value = undefined;
    var lossless: bool = undefined;

    if (c.napi_get_value_bigint_uint64(napi_env, args[0], &address, &lossless) != c.napi_ok) {
        return errors.Napi.CannotGetInt;
    }

    if (c.napi_create_external(napi_env, @ptrFromInt(@as(usize, address)), null, null, &result) != c.napi_ok) {
        return null;
    }

    return result;
}

// TODO: global structs create on init here

export fn napi_register_module_v1(env: c.napi_env, exports: c.napi_value) c.napi_value {
    registerFunction(env, exports, "workerCtxInit", workerCtxInit) catch return null;
    registerFunction(env, exports, "start", lifeTime.start) catch return null;
    registerFunction(env, exports, "stop", lifeTime.stop) catch return null;

    registerFunction(env, exports, "saveCommon", dump.saveCommon) catch return null;
    registerFunction(env, exports, "saveRange", dump.saveRange) catch return null;
    registerFunction(env, exports, "loadCommon", dump.loadCommon) catch return null;
    registerFunction(env, exports, "loadRange", dump.loadRange) catch return null;

    registerFunction(env, exports, "getTypeInfo", info.ofType) catch return null;
    registerFunction(env, exports, "getNodeRangeHash", info.nodeRangeHash) catch return null;
    registerFunction(env, exports, "updateSchema", schema.updateSchema) catch return null;
    registerFunction(env, exports, "getQueryBuf", Query.getQueryBuf) catch return null;
    registerFunction(env, exports, "modify", modify) catch return null;
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

    registerFunction(env, exports, "historyCreate", history.historyCreate) catch return null;
    registerFunction(env, exports, "historyAppend", history.historyAppend) catch return null;

    return exports;
}
