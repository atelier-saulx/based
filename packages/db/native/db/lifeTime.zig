const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");
const dump = @import("./dump.zig");
const selva = @import("../selva.zig");

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

fn startInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const id = try napi.get(u32, napi_env, args[0]);
    db.init();
    const ctx = try db.createDbCtx(id);
    ctx.selva = selva.selva_db_create();
    var externalNapi: c.napi_value = undefined;
    ctx.initialized = true;
    _ = c.napi_create_external(napi_env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn stopInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const ctx = try napi.get(*db.DbCtx, napi_env, args[0]);

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

    selva.libdeflate_block_state_deinit(&ctx.libdeflate_block_state);
    selva.libdeflate_free_decompressor(ctx.decompressor);
    _ = db.dbHashmap.remove(ctx.id);
    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();

    return null;
}
