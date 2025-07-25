const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const dump = @import("./dump.zig");
const selva = @import("../selva.zig");
const dbCtx = @import("./ctx.zig");

pub fn start(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return startInternal(napi_env, info) catch |e| {
        std.log.err("Err {any} \n", .{e});
        _ = napi.jsThrow(napi_env, "Start failed\n");
        return null;
    };
}

pub fn stop(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return stopInternal(napi_env, info) catch return null;
}

fn getOptPath(
    env: c.napi_env,
    value: c.napi_value,
) !?[]u8 {
    const t = try napi.getType(env, value);
    return if (!(t == c.napi_null or t == c.napi_undefined)) try napi.get([]u8, env, value) else null;
}

fn startInternal(napi_env: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // does this make double things with valgrind? Ask marco
    dbCtx.init();
    const ctx = try dbCtx.createDbCtx();
    ctx.selva = selva.selva_db_create();
    var externalNapi: c.napi_value = undefined;
    ctx.initialized = true;
    _ = c.napi_create_external(napi_env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn createThreadCtx(napi_env: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    const ctx = try dbCtx.createDbCtx();
    ctx.selva = selva.selva_db_create();
    var externalNapi: c.napi_value = undefined;
    ctx.initialized = true;
    _ = c.napi_create_external(napi_env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn removeThreadCtx(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const thread = try napi.get(*dbCtx.ThreadCtx, napi_env, args[0]);
    thread.deinit();
    return null;
}

fn stopInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const ctx = try napi.get(*dbCtx.DbCtx, napi_env, args[0]);
    // threadCtx

    if (!ctx.initialized) {
        std.log.err("Db already de-initialized \n", .{});
        return null;
    }

    ctx.initialized = false;

    var it = ctx.sortIndexes.iterator();
    while (it.next()) |index| {
        var mainIt = index.value_ptr.*.main.iterator();
        while (mainIt.next()) |main| {
            selva.selva_sort_destroy(main.value_ptr.*.index);
        }
        var fieldIt = index.value_ptr.*.field.iterator();
        while (fieldIt.next()) |field| {
            selva.selva_sort_destroy(field.value_ptr.*.index);
        }
    }

    // clear thread specific as well

    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();

    return null;
}
