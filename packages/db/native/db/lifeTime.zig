const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const dump = @import("./dump.zig");
const selva = @import("../selva.zig").c;
const dbCtx = @import("./ctx.zig");

pub fn start(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return startInternal(env, info) catch |e| {
        std.log.err("Err {any} \n", .{e});
        _ = napi.jsThrow(env, "Start failed\n");
        return null;
    };
}

pub fn stop(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return stopInternal(napi_env, info) catch return null;
}

fn getOptPath(
    env: napi.Env,
    value: napi.Value,
) !?[]u8 {
    const t = try napi.getType(env, value);
    return if (!(t == napi.c.napi_null or t == napi.c.napi_undefined)) try napi.get([]u8, env, value) else null;
}

fn startInternal(env: napi.Env, info: napi.Info) !napi.Value {
    // does this make double things with valgrind? Ask marco
    dbCtx.init();

    const args = try napi.getArgs(1, env, info);
    const jsCallback = try napi.Callback.init(env, args[0]);

    const ctx = try dbCtx.createDbCtx(jsCallback);
    ctx.selva = selva.selva_db_create();
    var externalNapi: napi.Value = undefined;
    ctx.initialized = true;
    _ = napi.c.napi_create_external(env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn stopInternal(napi_env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, napi_env, info);
    const ctx = try napi.get(*dbCtx.DbCtx, napi_env, args[0]);

    if (!ctx.initialized) {
        std.log.err("Db already de-initialized \n", .{});
        return null;
    }

    dbCtx.destroyDbCtx(ctx);

    return null;
}

pub fn getThreadId(env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    var result: napi.Value = undefined;
    if (napi.c.napi_create_bigint_uint64(env, dbCtx.getThreadId(), &result) != napi.Ok) {
        return null;
    }
    return result;
}

fn _createThreadCtx(env: napi.Env, nfo: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, nfo);
    const ctx = try napi.get(*dbCtx.DbCtx, env, args[0]);
    const threadId = try napi.get(u64, env, args[1]);

    try dbCtx.createThreadCtx(ctx, threadId);
    return null;
}

pub fn createThreadCtx(env: napi.Env, nfo: napi.Info) callconv(.c) napi.Value {
    return _createThreadCtx(env, nfo) catch {
        _ = napi.jsThrow(env, "Failed to create a thread context");
        return null;
    };
}

fn _destroyThreadCtx(env: napi.Env, nfo: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, nfo);
    const ctx = try napi.get(*dbCtx.DbCtx, env, args[0]);
    const threadId = try napi.get(u64, env, args[1]);

    try dbCtx.destroyThreadCtx(ctx, threadId);
    return null;
}

pub fn destroyThreadCtx(env: napi.Env, nfo: napi.Info) callconv(.c) napi.Value {
    return _destroyThreadCtx(env, nfo) catch null;
}
