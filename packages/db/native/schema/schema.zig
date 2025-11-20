const db = @import("../db/db.zig");
const selva = @import("../selva.zig").c;
const napi = @import("../napi.zig");
const utils = @import("../utils.zig");
const std = @import("std");
const errors = @import("../errors.zig");

pub fn setSchemaType(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return setSchemaTypeInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn setSchemaIds(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return setSchemaIdsInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getSchemaIds(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getSchemaIdsInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn getSchemaIdsInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*db.DbCtx, env, args[0]);
    var result: napi.Value = undefined;
    _ = napi.c.napi_create_external_arraybuffer(env, ctx.ids.ptr, ctx.ids.len * 4, null, null, &result);
    return result;
}

fn setSchemaIdsInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const ids = try napi.get([]u32, env, args[0]);
    const ctx = try napi.get(*db.DbCtx, env, args[1]);
    ctx.ids = try ctx.allocator.dupe(u32, ids);
    return null;
}

// TODO olli: add binary protocol here
fn setSchemaTypeInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(3, env, info);
    const ctx = try napi.get(*db.DbCtx, env, args[0]);
    const typeId = try napi.get(u16, env, args[1]);
    const schema = try napi.get([]u8, env, args[2]);

    if (ctx.selva == null) {
        return errors.SelvaError.DB_NOT_CREATED;
    }

    try db.createType(ctx, typeId, schema);

    return null;
}
