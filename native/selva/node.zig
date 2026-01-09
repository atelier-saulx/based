const std = @import("std");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("selva.zig");
const Schema = @import("schema.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const Modify = @import("../modify/common.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const Type = selva.Type;
pub const Node = selva.Node;

pub inline fn getType(ctx: *DbCtx, typeId: t.TypeId) !Type {
    const selvaTypeEntry: ?Type = selva.c.selva_get_type_by_index(
        ctx.selva.?,
        typeId,
    );
    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }
    return selvaTypeEntry.?;
}

pub inline fn getRefDstType(ctx: *DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == Schema.FieldSchema) {
        return getType(ctx, selva.c.selva_get_edge_field_constraint(sch).*.dst_node_type);
    } else if (comptime @TypeOf(sch) == Schema.EdgeFieldConstraint) {
        return getType(ctx, sch.*.dst_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub inline fn getEdgeType(ctx: *DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == Schema.FieldSchema) {
        return getType(ctx, selva.c.selva_get_edge_field_constraint(sch).*.edge_node_type);
    } else if (comptime @TypeOf(sch) == Schema.EdgeFieldConstraint) {
        return getType(ctx, sch.*.edge_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub inline fn getBlockCapacity(ctx: *DbCtx, typeId: t.TypeId) u64 {
    return selva.c.selva_get_block_capacity(selva.c.selva_get_type_by_index(ctx.selva, typeId));
}

pub inline fn getNodeCount(te: Type) usize {
    return selva.c.selva_node_count(te);
}

pub inline fn getNodeId(node: Node) u32 {
    return utils.read(u32, @as([*]u8, @ptrCast(node))[0..4], 0);
}

pub inline fn getNodeIdAsSlice(node: Node) []u8 {
    return @as([*]u8, @ptrCast(node))[0..4];
}

pub inline fn getNodeTypeId(node: Node) t.TypeId {
    return selva.c.selva_get_node_type(node);
}

pub inline fn upsertNode(_: *Modify.ModifyCtx, typeEntry: selva.Type, id: u32) !Node {
    const node = selva.c.selva_upsert_node(typeEntry, id);
    if (node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return node.?;
}

pub inline fn getNode(typeEntry: selva.Type, id: u32) ?Node {
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

pub fn NodeTypeIterator(
    comptime desc: bool,
) type {
    return struct {
        typeEntry: selva.Type,
        node: ?Node,
        pub fn next(self: *NodeTypeIterator(desc)) ?Node {
            const node = self.node;
            if (node) |n| {
                if (desc) {
                    self.node = getPrevNode(self.typeEntry, n);
                } else {
                    self.node = getNextNode(self.typeEntry, n);
                }
            }
            return node;
        }
    };
}

pub inline fn iterator(
    comptime desc: bool,
    typeEntry: selva.Type,
) NodeTypeIterator(desc) {
    return NodeTypeIterator(desc){
        .node = if (desc) getLastNode(typeEntry) else getFirstNode(typeEntry),
        .typeEntry = typeEntry,
    };
}

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

pub inline fn ensureRefEdgeNode(ctx: *Modify.ModifyCtx, node: Node, efc: selva.EdgeFieldConstraint, ref: selva.ReferenceLarge) !Node {
    const edgeNode = selva.c.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0);
    if (edgeNode) |n| {
        selva.markDirty(ctx, efc.edge_node_type, getNodeId(n));
        return n;
    } else {
        return errors.SelvaError.SELVA_ENOTSUP;
    }
}

pub inline fn getEdgeNode(db: *DbCtx, efc: selva.EdgeFieldConstraint, ref: selva.ReferenceLarge) ?Node {
    if (ref.*.edge == 0) {
        return null;
    }

    const edge_type = selva.c.selva_get_type_by_index(db.selva, efc.*.edge_node_type);
    return selva.c.selva_find_node(edge_type, ref.*.edge);
}

pub inline fn deleteNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: Node) !void {
    selva.c.selva_del_node(ctx.db.selva, typeEntry, node);
}

pub inline fn flushNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: Node) void {
    selva.c.selva_flush_node(ctx.db.selva, typeEntry, node);
}

pub inline fn expireNode(ctx: *Modify.ModifyCtx, typeId: t.TypeId, nodeId: u32, ts: i64) void {
    selva.c.selva_expire_node(ctx.db.selva, typeId, nodeId, ts, selva.c.SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD);
    selva.markDirty(ctx, typeId, nodeId);
}

pub inline fn expire(ctx: *Modify.ModifyCtx) void {
    // Expire things before query
    selva.c.selva_db_expire_tick(ctx.db.selva, std.time.timestamp());
}

pub inline fn getNodeBlockHash(db: *DbCtx, typeEntry: Type, start: u32, hashOut: *SelvaHash128) c_int {
    return selva.c.selva_node_block_hash(db.selva, typeEntry, start, hashOut);
}
