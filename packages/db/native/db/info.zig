const db = @import("db.zig");
const selva = @import("../selva.zig").c;
const napi = @import("../napi.zig");
const copy = @import("../utils.zig").copy;

pub fn ofType(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
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

    var arr: napi.Value = undefined;
    const status = napi.c.napi_create_array_with_length(env, 2, &arr);
    if (status != napi.Ok) {
        return null;
    }

    var v: napi.Value = undefined;
    _ = napi.c.napi_create_uint32(env, @truncate(n), &v);
    _ = napi.c.napi_set_element(env, arr, 0, v);
    _ = napi.c.napi_create_uint32(env, if (last != null) selva.selva_get_node_id(last) else 0, &v);
    _ = napi.c.napi_set_element(env, arr, 1, v);

    return arr;
}

pub fn nodeRangeHash(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(5, env, info) catch return null;
    const typeId = napi.get(u16, env, args[0]) catch return null;
    const start = napi.get(u32, env, args[1]) catch return null;
    const end = napi.get(u32, env, args[2]) catch return null;
    const buf = napi.get([]u8, env, args[3]) catch return null;
    const ctx = napi.get(*db.DbCtx, env, args[4]) catch return null;
    var ok: napi.Value = undefined;
    var nil: napi.Value = undefined;

    _ = napi.c.napi_get_boolean(env, true, &ok);
    _ = napi.c.napi_get_boolean(env, false, &nil);

    const te = selva.selva_get_type_by_index(ctx.selva, typeId);
    if (te == null) {
        return nil;
    }

    const hash = db.getNodeRangeHash(ctx, te.?, start, end) catch return nil;
    copy(buf, @as([*]const u8, @ptrCast(&hash))[0..16]);

    return ok;
}
