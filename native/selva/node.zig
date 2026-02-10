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

pub inline fn getType(ctx: *DbCtx, v: anytype) !Type {
    var selvaTypeEntry: ?Type = undefined;

    if (comptime @TypeOf(v) == t.TypeId) {
        selvaTypeEntry = selva.c.selva_get_type_by_index(
            ctx.selva.?,
            v,
        );
    } else if (comptime @TypeOf(v) == selva.Node or
               @TypeOf(v) == ?selva.Node) {
        if (comptime @TypeOf(v) == ?selva.Node) {
            if (v == null) {
                return errors.SelvaError.SELVA_ENOENT;
            }
        }
        selvaTypeEntry = selva.c.selva_get_type_by_node(ctx.selva.?, v);
    } else {
        @compileLog("Invalid type: ", @TypeOf(v));
        @compileError("Invalid type");
    }

    return if (selvaTypeEntry == null) errors.SelvaError.SELVA_EINTYPE else selvaTypeEntry.?;
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

pub inline fn upsertNode(typeEntry: selva.Type, id: u32) !Node {
    const res = selva.c.selva_upsert_node(typeEntry, id);
    // TODO Partials
    if (res.node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return res.node.?;
}

pub inline fn getNode(typeEntry: selva.Type, id: u32) ?Node {
    const res = selva.c.selva_find_node(typeEntry, id);
    // TODO Partials
    return res.node;
}

pub inline fn getFirstNode(typeEntry: selva.Type) ?Node {
    const res = selva.c.selva_min_node(typeEntry);
    // TODO Partials
    return res.node;
}

pub inline fn getLastNode(typeEntry: selva.Type) ?Node {
    return selva.c.selva_max_node(typeEntry);
}

pub inline fn getNextNode(typeEntry: selva.Type, node: Node) ?Node {
    const res = selva.c.selva_next_node(typeEntry, node);
    // TODO Partials
    return res.node;
}

pub inline fn getPrevNode(typeEntry: selva.Type, node: Node) ?Node {
    const res = selva.c.selva_prev_node(typeEntry, node);
    // TODO Partials
    return res.node;
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
            const res = selva.c.selva_find_node(dstType, r.*.dst);
            // TODO Partial
            return res.node;
        }
    } else {
        @compileLog("Invalid type: ", @TypeOf(ref));
        @compileError("Invalid type");
    }
    return null;
}

pub inline fn getEdgeNode(db: *DbCtx, efc: selva.EdgeFieldConstraint, ref: selva.ReferenceLarge) ?Node {
    if (ref.*.edge == 0) {
        return null;
    }

    const edge_type = selva.c.selva_get_type_by_index(db.selva, efc.*.edge_node_type);
    // TODO Partials
    return selva.c.selva_find_node(edge_type, ref.*.edge).node;
}

pub inline fn deleteNode(db: *DbCtx, typeEntry: Type, node: Node) !void {
    selva.c.selva_del_node(db.selva, typeEntry, node);
}

pub inline fn flushNode(db: *DbCtx, typeEntry: Type, node: Node) void {
    selva.c.selva_flush_node(db.selva, typeEntry, node);
}

pub inline fn expireNode(ctx: *Modify.ModifyCtx, typeId: t.TypeId, nodeId: u32, ts: i64) void {
    selva.c.selva_expire_node(ctx.db.selva, typeId, nodeId, ts, selva.c.SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD);
    selva.markDirty(ctx, typeId, nodeId);
}

pub inline fn expire(db: *DbCtx) void {
    // Expire things before query
    selva.c.selva_db_expire_tick(db.selva, std.time.timestamp());
}

pub inline fn getNodeBlockHash(db: *DbCtx, typeEntry: Type, start: u32, hashOut: *SelvaHash128) c_int {
    return selva.c.selva_node_block_hash(db.selva, typeEntry, start, hashOut);
}

pub inline fn getReferenceNodeId(ref: ?selva.ReferenceLarge) []u8 {
    if (ref) |r| {
        const id: *u32 = @ptrCast(@alignCast(&r.*.dst));
        return std.mem.asBytes(id)[0..4];
    }
    return &[_]u8{};
}
