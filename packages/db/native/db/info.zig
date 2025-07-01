const c = @import("../c.zig");
const db = @import("db.zig");
const selva = @import("../selva.zig");
const napi = @import("../napi.zig");
const copy = @import("../utils.zig").copy;

pub fn ofType(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, env, info) catch return null;
    const typeId = napi.get(u16, env, args[0]) catch {
        return null;
    };
    const ctx = napi.get(*db.DbCtx, env, args[1]) catch return null;

    const te = selva.selva_get_type_by_index(ctx.selva, typeId);
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

pub fn nodeRangeHash(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(5, env, info) catch return null;
    const typeId = napi.get(u16, env, args[0]) catch return null;
    const start = napi.get(u32, env, args[1]) catch return null;
    const end = napi.get(u32, env, args[2]) catch return null;
    const buf = napi.get([]u8, env, args[3]) catch return null;
    const ctx = napi.get(*db.DbCtx, env, args[4]) catch return null;
    var ok: c.napi_value = undefined;
    var nil: c.napi_value = undefined;

    _ = c.napi_get_boolean(env, true, &ok);
    _ = c.napi_get_boolean(env, false, &nil);

    const te = selva.selva_get_type_by_index(ctx.selva, typeId);
    if (te == null) {
        return nil;
    }

    const hash = db.getNodeRangeHash(ctx.selva.?, te.?, start, end) catch return nil;
    copy(buf, @as([*]const u8, @ptrCast(&hash))[0..16]);

    return ok;
}
