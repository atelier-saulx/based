const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");
const dump = @import("./dump.zig");
const selva = @import("../selva.zig");

pub fn start(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return startInternal(napi_env, info) catch return null;
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

// have to pass the pointer to js
// NAPI_VALUE here has to be the pointer

fn startInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const id = try napi.get(u32, napi_env, args[0]);
    const ctx = try db.createDbCtx(id);
    ctx.selva = selva.selva_db_create();
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(napi_env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn stopInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const ctx = try napi.get(*db.DbCtx, napi_env, args[0]);

    var it = ctx.sortIndexes.iterator();
    while (it.next()) |index| {
        var it2 = index.value_ptr.*.main.iterator();
        while (it2.next()) |index2| {
            selva.selva_sort_destroy(index2.value_ptr.*.index);
        }
        var it3 = index.value_ptr.*.field.iterator();
        while (it3.next()) |index3| {
            selva.selva_sort_destroy(index3.value_ptr.*.index);
        }
    }

    if (ctx.selva != null) {
        selva.selva_db_destroy(ctx.selva);
    }

    ctx.selva = null;

    selva.libdeflate_block_state_deinit(&ctx.libdeflate_block_state);
    selva.libdeflate_free_decompressor(ctx.decompressor);

    _ = db.dbHashmap.remove(ctx.id);

    // free mem
    ctx.arena.deinit();

    return null;
}
