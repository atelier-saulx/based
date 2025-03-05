const c = @import("../c.zig");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig");
const napi = @import("../napi.zig");
const utils = @import("../utils.zig");
const std = @import("std");
const errors = @import("../errors.zig");

pub fn updateSchema(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return updateSchemaInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

// TODO olli: add binary protocol here
fn updateSchemaInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(3, env, info);
    const typeId = try napi.get(u16, env, args[0]);
    const schema = try napi.get([]u8, env, args[1]);
    const ctx = try napi.get(*db.DbCtx, env, args[2]);

    if (ctx.selva == null) {
        return errors.SelvaError.DB_NOT_CREATED;
    }

    try errors.selva(selva.selva_db_create_type(ctx.selva, typeId, schema.ptr, schema.len));

    return null;
}
