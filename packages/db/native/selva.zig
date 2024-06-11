const c = @import("c.zig");
const selva = @cImport({
    @cInclude("selva.h");
});
const selvaError = @cImport({
    @cInclude("selva_error.h");
});
const napi = @import("napi.zig");
const lib = @import("lib.zig");

var db: ?*selva.SelvaDb = null;
//var db: ?*anyopaque = null;

fn SelvaRes2Napi(env: c.napi_env, err: c_int) c.napi_value {
    var result: c.napi_value = undefined;
    _ = c.napi_create_int32(env, err, &result);
    return result;
}

fn selva_db_create(env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    if (db != null) {
        return SelvaRes2Napi(env, selvaError.SELVA_EEXIST);
    }

    db = selva.selva_db_create();

    return SelvaRes2Napi(env, 0);
}

fn selva_db_destroy(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const totalArgs = 1;
    var args: [totalArgs]c.napi_value = undefined;
    var size: usize = totalArgs;
    if (c.napi_get_cb_info(env, info, &size, &args, null, null) != c.napi_ok) {
        return SelvaRes2Napi(env, selvaError.SELVA_EGENERAL);
    }

    const db_id = napi.getSignedInt32("db_id", env, args[0]) catch selvaError.SELVA_EGENERAL;
    if (db_id != 0) {
        return SelvaRes2Napi(env, selvaError.SELVA_ENOENT);
    }

    selva.selva_db_destroy(db);
    return SelvaRes2Napi(env, 0);
}

fn selva_db_schema_update(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const totalArgs = 2;
    var args: [totalArgs]c.napi_value = undefined;
    var size: usize = totalArgs;
    if (c.napi_get_cb_info(env, info, &size, &args, null, null) != c.napi_ok) {
        return SelvaRes2Napi(env, selvaError.SELVA_EGENERAL);
    }

    const db_id = napi.getSignedInt32("db_id", env, args[0]) catch -1;
    const schema = napi.getBuffer("schema", env, args[1]) catch "";

    if (db_id != 0) {
        return SelvaRes2Napi(env, selvaError.SELVA_ENOENT);
    }

    const res = selva.selva_db_schema_update(db, schema.ptr, schema.len);
    return SelvaRes2Napi(env, res);
}

fn selva_db_update(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const totalArgs = 4;
    var args: [totalArgs]c.napi_value = undefined;
    var size: usize = totalArgs;
    if (c.napi_get_cb_info(env, info, &size, &args, null, null) != c.napi_ok) {
        return SelvaRes2Napi(env, selvaError.SELVA_EGENERAL);
    }

    const db_id = napi.getSignedInt32("db_id", env, args[0]) catch -1;
    const node_type = napi.getInt32("node_type", env, args[1]) catch 0;
    const node_id = napi.getInt32("node_id", env, args[2]) catch 0;
    const buf = napi.getBuffer("buf", env, args[3]) catch "";

    if (db_id != 0) {
        return SelvaRes2Napi(env, selvaError.SELVA_ENOENT);
    }

    const res = selva.selva_db_update(db, node_type, node_id, buf.ptr, buf.len);
    return SelvaRes2Napi(env, res);
}

pub fn registerSelva(env: c.napi_env, exports: c.napi_value) !void {
    try lib.registerFunction(env, exports, "selva_db_create", selva_db_create);
    try lib.registerFunction(env, exports, "selva_db_destroy", selva_db_destroy);
    try lib.registerFunction(env, exports, "selva_db_schema_update", selva_db_schema_update);
    try lib.registerFunction(env, exports, "selva_db_update", selva_db_update);
}
