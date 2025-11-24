const std = @import("std");
const selva = @import("selva.zig");
const Schema = @import("schema.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const Modify = @import("../modify/common.zig");
const Db = @import("../db/ctx.zig");
const t = @import("../types.zig");

pub const Type = selva.Type;
pub const Node = selva.Node;

pub fn getType(ctx: *Db.DbCtx, typeId: t.TypeId) !Type {
    const selvaTypeEntry: ?Type = selva.c.selva_get_type_by_index(
        ctx.selva.?,
        typeId,
    );
    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }
    return selvaTypeEntry.?;
}

pub inline fn getRefDstType(ctx: *Db.DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == Schema.FieldSchema) {
        return getType(ctx, selva.c.selva_get_edge_field_constraint(sch).*.dst_node_type);
    } else if (comptime @TypeOf(sch) == Schema.EdgeFieldConstraint) {
        return getType(ctx, sch.*.dst_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub inline fn getEdgeType(ctx: *Db.DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == Schema.FieldSchema) {
        return getType(ctx, selva.c.selva_get_edge_field_constraint(sch).*.edge_node_type);
    } else if (comptime @TypeOf(sch) == Schema.EdgeFieldConstraint) {
        return getType(ctx, sch.*.edge_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub inline fn getBlockCapacity(ctx: *Db.DbCtx, typeId: t.TypeId) u64 {
    return selva.c.selva_get_block_capacity(selva.c.selva_get_type_by_index(ctx.selva, typeId));
}

pub inline fn getNodeCount(te: Type) usize {
    return selva.c.selva_node_count(te);
}

pub inline fn getNodeId(node: Node) u32 {
    return utils.read(u32, @as([*]u8, @ptrCast(node))[0..4], 0);
}

pub inline fn getNodeTypeId(node: Node) t.TypeId {
    return selva.c.selva_get_node_type(node);
}

pub fn upsertNode(ctx: *Modify.ModifyCtx, typeEntry: selva.Type, id: u32) !Node {
    const node = selva.c.selva_upsert_node(ctx.db.selva, typeEntry, id);
    if (node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return node.?;
}

pub fn getNode(typeEntry: selva.Type, id: u32) ?Node {
    return selva.c.selva_find_node(typeEntry, id);
}

pub inline fn getFirstNode(typeEntry: selva.Type) ?Node {
    return selva.c.selva_min_node(typeEntry);
}

pub inline fn getLastNode(typeEntry: selva.Type) ?Node {
    return selva.c.selva_max_node(typeEntry);
}

pub inline fn getNextNode(typeEntry: selva.Type, node: Node) ?Node {
    return selva.c.selva_next_node(typeEntry, node);
}

pub inline fn getPrevNode(typeEntry: selva.Type, node: Node) ?Node {
    return selva.c.selva_prev_node(typeEntry, node);
}

pub const TypeIterator = struct {
    comptime desc: bool = false,
    typeEntry: selva.Type,
    node: ?Node = null,
    fn init(s: *const TypeIterator) TypeIterator {
        if (s.desc) {
            return TypeIterator{
                .desc = s.desc,
                .typeEntry = s.typeEntry,
                .node = getLastNode(s.typeEntry),
            };
        } else {
            return TypeIterator{
                .desc = s.desc,
                .typeEntry = s.typeEntry,
                .node = getFirstNode(s.typeEntry),
            };
        }
    }
    fn next(self: *TypeIterator) ?Node {
        const node = self.node;
        if (node) |n| {
            if (self.desc) {
                self.node = getPrevNode(self.typeEntry, n);
            } else {
                self.node = getNextNode(self.typeEntry, n);
            }
        }
        return node;
    }
};

pub inline fn getNodeFromReference(dstType: selva.Type, ref: anytype) ?Node {
    if (comptime @TypeOf(ref) == selva.ReferenceSmall or
        @TypeOf(ref) == selva.ReferenceLarge or
        @TypeOf(ref) == *allowzero selva.c.SelvaNodeSmallReference or
        @TypeOf(ref) == *allowzero selva.c.SelvaNodeLargeReference)
    {
        return selva.c.selva_find_node(dstType, ref.*.dst);
    } else if (comptime @TypeOf(ref) == ?selva.ReferenceSmall or
        @TypeOf(ref) == ?selva.ReferenceLarge or
        @TypeOf(ref) == ?*selva.c.SelvaNodeSmallReference or
        @TypeOf(ref) == ?*selva.c.SelvaNodeLargeReference)
    {
        if (ref) |r| {
            return selva.c.selva_find_node(dstType, r.*.dst);
        }
    } else {
        @compileLog("Invalid type: ", @TypeOf(ref));
        @compileError("Invalid type");
    }
    return null;
}

pub fn ensureRefEdgeNode(ctx: *Modify.ModifyCtx, node: Node, efc: selva.EdgeFieldConstraint, ref: selva.ReferenceLarge) !Node {
    const edgeNode = selva.c.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0, selva.markDirtyCb, ctx);
    if (edgeNode) |n| {
        Modify.markDirtyRange(ctx, efc.edge_node_type, getNodeId(n));
        return n;
    } else {
        return errors.SelvaError.SELVA_ENOTSUP;
    }
}

pub fn getEdgeNode(db: *Db.DbCtx, efc: selva.EdgeFieldConstraint, ref: selva.ReferenceLarge) ?Node {
    if (ref.*.edge == 0) {
        return null;
    }

    const edge_type = selva.c.selva_get_type_by_index(db.selva, efc.*.edge_node_type);
    return selva.c.selva_find_node(edge_type, ref.*.edge);
}
