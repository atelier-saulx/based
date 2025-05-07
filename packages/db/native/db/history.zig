const selva = @import("../selva.zig");
const napi = @import("../napi.zig");
const c = @import("../c.zig");
const db = @import("./db.zig");
const std = @import("std");
const errors = @import("../errors.zig");

fn _historyCreate(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const pathname = try napi.get([]u8, env, args[0]);
    const entryByteSize: u16 = try napi.get(u16, env, args[1]);
    var histOut: ?*selva.struct_selva_history = null;
    var externalNapi: c.napi_value = undefined;
    try errors.selva(selva.selva_history_create(pathname.ptr, @as(usize, entryByteSize), &histOut));
    _ = c.napi_create_external(env, histOut, null, null, &externalNapi);
    return externalNapi;
}

pub fn historyCreate(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return _historyCreate(napi_env, info) catch |e| {
        std.log.err("Err {any} \n", .{e});
        _ = napi.jsThrow(napi_env, "historyCreate failed\n");
        return null;
    };
}

fn _historyAppend(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(4, env, info);
    const history = try napi.get(*selva.struct_selva_history, env, args[0]);
    const typeId: u16 = try napi.get(u16, env, args[1]);
    const nodeId: u32 = try napi.get(u32, env, args[2]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[3]);
    const ts = std.time.timestamp();
    const typeEntry = db.getType(
        dbCtx,
        typeId,
    ) catch {
        return null;
    };
    const node = db.getNode(
        nodeId,
        typeEntry,
    );
    const fieldSchema = try db.getFieldSchema(
        typeEntry,
        0,
    );
    const data = db.getField(
        typeEntry,
        nodeId,
        node.?,
        fieldSchema,
        @enumFromInt(0),
    );
    selva.selva_history_append(
        history,
        ts,
        nodeId,
        data.ptr,
    );
    return null;
}

pub fn historyAppend(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return _historyAppend(napi_env, info) catch |e| {
        std.log.err("Err {any} \n", .{e});
        _ = napi.jsThrow(napi_env, "historyCreate failed\n");
        return null;
    };
}
