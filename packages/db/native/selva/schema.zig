const std = @import("std");
const Node = @import("node.zig");
const selva = @import("selva.zig");
const napi = @import("../napi.zig");
const utils = @import("../utils.zig");
const errors = @import("../errors.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const FieldSchema = selva.FieldSchema;
pub const EdgeFieldConstraint = selva.EdgeFieldConstraint;

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
    const ctx = try napi.get(*DbCtx, env, args[0]);
    var result: napi.Value = undefined;
    _ = napi.c.napi_create_external_arraybuffer(env, ctx.ids.ptr, ctx.ids.len * 4, null, null, &result);
    return result;
}

fn setSchemaIdsInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const ids = try napi.get([]u32, env, args[0]);
    const ctx = try napi.get(*DbCtx, env, args[1]);
    ctx.ids = try ctx.allocator.dupe(u32, ids);
    return null;
}

pub fn getFieldSchema(typeEntry: ?Node.Type, field: u8) !FieldSchema {
    const s: ?FieldSchema = selva.c.selva_get_fs_by_te_field(
        typeEntry.?,
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaByNode(ctx: *DbCtx, node: Node.Node, field: u8) !FieldSchema {
    const s: ?FieldSchema = selva.c.selva_get_fs_by_node(ctx.selva.?, node, field);
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getEdgeFieldSchema(db: *DbCtx, edgeConstraint: EdgeFieldConstraint, field: u8) !FieldSchema {
    const edgeFieldSchema = selva.c.get_fs_by_fields_schema_field(
        selva.c.selva_get_edge_field_fields_schema(db.selva, edgeConstraint),
        field,
    );
    if (edgeFieldSchema == null) {
        return errors.SelvaError.SELVA_NO_EDGE_FIELDSCHEMA;
    }
    return edgeFieldSchema;
}

pub inline fn getEdgeFieldConstraint(fieldSchema: FieldSchema) EdgeFieldConstraint {
    return selva.c.selva_get_edge_field_constraint(fieldSchema);
}

pub fn getRefTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.c.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    return result;
}
