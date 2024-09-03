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

fn updateSchemaInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    if (db.ctx.selva == null) {
        return errors.SelvaError.DB_NOT_CREATED;
    }

    const args = try napi.getArgs(2, env, info);
    const typeId = try napi.getStringFixedLength("type", 2, env, args[0]);
    const nrType: u16 = @bitCast(typeId);
    const schema = try napi.get([]u8, env, args[1]);

    try errors.selva(selva.selva_db_schema_create(db.ctx.selva, nrType, schema.ptr, schema.len));

    return null;
}
