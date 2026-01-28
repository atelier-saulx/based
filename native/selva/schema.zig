const Node = @import("node.zig");
const selva = @import("selva.zig");
const errors = @import("../errors.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const FieldSchema = selva.FieldSchema;
pub const EdgeFieldConstraint = selva.EdgeFieldConstraint;

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
    return selva.c.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
}
