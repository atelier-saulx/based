const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const dump = @import("../selva/dump.zig");
const selva = @import("../selva/selva.zig").c;
const dbCtx = @import("ctx.zig");

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

fn startInternal(env: napi.Env, info: napi.Info) !napi.Value {
    // does this make double things with valgrind? Ask marco
    dbCtx.init();
    const args = try napi.getArgs(3, env, info);
    const fsPath = try napi.get([]u8, env, args[1]);
    const nrThreads = try napi.get(u16, env, args[2]);
    const ctx = try dbCtx.createDbCtx(env, args[0], fsPath, nrThreads);
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
