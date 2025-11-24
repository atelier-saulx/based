const std = @import("std");
const napi = @import("./napi.zig");
const selva = @import("selva/selva.zig").c;
const db = @import("selva/db.zig");
const Node = @import("selva/Node.zig");

const Type = Node.Type;
const FieldSchema = db.FieldSchema;

pub fn colvec(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return colvecInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

const query = [_]f32{ 2311.0, 5054.0, 2713.0, 8280.0, 8651.0, 7474.0, 4173.0, 7261.0 };

fn cb(_: selva.node_id_t, vec: ?*anyopaque, arg: ?*anyopaque) callconv(.c) void {
    const fvec: [*c]f32 = @alignCast(@ptrCast(vec));
    const res: *f32 = @alignCast(@ptrCast(arg));

    const q = query[0..8];
    const d = @abs(selva.vector_l2s(fvec, q.ptr, q.len));
    if (d < res.*) {
        res.* = d;
    }
}

fn native_foreach(te: Type, fs: FieldSchema, nodeId: selva.node_id_t, len: u32, res: *f32) void {
    const cv = selva.colvec_get(te, fs);
    const block_capacity = selva.selva_get_block_capacity(te);
    const vec_size = cv.*.vec_size;
    const end: u32 = nodeId + len;
    var i: u32 = 0;

    while (i < end) {
        i += 1;
        const block_i = selva.selva_node_id2block_i3(block_capacity, i);
        const off: usize = ((i - 1) % block_capacity) * vec_size;
        const slab: [*c]u8 = @ptrCast(cv.*.v[block_i]);

        if (slab == null) {
            break;
        }

        const fvec: [*c]f32 = @alignCast(@ptrCast(slab + off));
        const q = query[0..8];
        const d = @abs(selva.vector_l2s(fvec, q.ptr, q.len));
        if (d < res.*) {
            res.* = d;
        }
    }
}

fn colvecInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(5, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const typeId = try napi.get(u16, env, args[1]);
    const field = try napi.get(u8, env, args[2]);
    const nodeId = try napi.get(u32, env, args[3]);
    const len = try napi.get(u32, env, args[4]);

    const typeEntry = try db.getType(dbCtx, typeId);
    const fs = try db.getFieldSchema(typeEntry, field);

    var res: f32 = std.math.inf(f32);
    //_ = selva.colvec_foreach(typeEntry, fs, nodeId, len, &cb, &res);
    native_foreach(typeEntry, fs, nodeId, len, &res);

    var napi_res: napi.Value = undefined;
    _ = napi.c.napi_create_double(env, res, &napi_res);

    return napi_res;
}
