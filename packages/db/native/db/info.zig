const c = @import("../c.zig");
const db = @import("db.zig");
const selva = @import("../selva.zig");
const napi = @import("../napi.zig");

pub fn ofType(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(1, env, info) catch return null;
    const typeId = napi.getStringFixedLength("type", 2, env, args[0]) catch {
        return null;
    };

    const te = selva.selva_get_type_by_index(db.ctx.selva, @bitCast(typeId));
    if (te == null) {
        return null;
    }

    const n = selva.selva_node_count(te);
    const last = selva.selva_max_node(te);

    var arr: c.napi_value = undefined;
    const status = c.napi_create_array_with_length(env, 2, &arr);
    if (status != c.napi_ok) {
        return null;
    }

    var v: c.napi_value = undefined;
    _ = c.napi_create_uint32(env, @truncate(n), &v);
    _ = c.napi_set_element(env, arr, 0, v);
    _ = c.napi_create_uint32(env, if (last != null) selva.selva_get_node_id(last) else 0, &v);
    _ = c.napi_set_element(env, arr, 1, v);

    return arr;
}
