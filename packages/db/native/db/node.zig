const std = @import("std");
const selva = @import("../selva.zig").c;
const st = @import("../selva.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const Modify = @import("../modify/common.zig");
const DbCtx = @import("./ctx.zig").DbCtx;
const markDirtyCb = @import("db.zig").markDirtyCb;
const t = @import("../types.zig");

pub const Type = st.Type;
pub const Node = st.Node;

pub fn upsertNode(ctx: *Modify.ModifyCtx, typeEntry: st.Type, id: u32) !Node {
    const node = selva.selva_upsert_node(ctx.db.selva, typeEntry, id);
    if (node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return node.?;
}

pub fn getNode(typeEntry: st.Type, id: u32) ?Node {
    return selva.selva_find_node(typeEntry, id);
}

pub inline fn getFirstNode(typeEntry: st.Type) ?Node {
    return selva.selva_min_node(typeEntry);
}

pub inline fn getLastNode(typeEntry: st.Type) ?Node {
    return selva.selva_max_node(typeEntry);
}

pub inline fn getNextNode(typeEntry: st.Type, node: Node) ?Node {
    return selva.selva_next_node(typeEntry, node);
}

pub inline fn getPrevNode(typeEntry: st.Type, node: Node) ?Node {
    return selva.selva_prev_node(typeEntry, node);
}

pub const TypeIterator = struct {
    comptime desc: bool = false,
    typeEntry: st.Type,
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

pub inline fn getNodeId(node: Node) u32 {
    return utils.read(u32, @as([*]u8, @ptrCast(node))[0..4], 0);
}

pub inline fn getNodeTypeId(node: Node) t.TypeId {
    return selva.selva_get_node_type(node);
}

pub inline fn getNodeFromReference(dstType: st.Type, ref: anytype) ?Node {
    if (comptime @TypeOf(ref) == st.ReferenceSmall or
        @TypeOf(ref) == st.ReferenceLarge or
        @TypeOf(ref) == *allowzero selva.SelvaNodeSmallReference or
        @TypeOf(ref) == *allowzero selva.SelvaNodeLargeReference)
    {
        return selva.selva_find_node(dstType, ref.*.dst);
    } else if (comptime @TypeOf(ref) == ?st.ReferenceSmall or
        @TypeOf(ref) == ?st.ReferenceLarge or
        @TypeOf(ref) == ?*selva.SelvaNodeSmallReference or
        @TypeOf(ref) == ?*selva.SelvaNodeLargeReference)
    {
        if (ref) |r| {
            return selva.selva_find_node(dstType, r.*.dst);
        }
    } else {
        @compileLog("Invalid type: ", @TypeOf(ref));
        @compileError("Invalid type");
    }
    return null;
}

pub inline fn getReferenceNodeId(ref: ?st.ReferenceLarge) []u8 {
    if (ref) |r| {
        const id: *u32 = @ptrCast(@alignCast(&r.*.dst));
        return std.mem.asBytes(id)[0..4];
    }
    return &[_]u8{};
}

pub fn ensureRefEdgeNode(ctx: *Modify.ModifyCtx, node: Node, efc: st.EdgeFieldConstraint, ref: st.ReferenceLarge) !Node {
    const edgeNode = selva.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0, markDirtyCb, ctx);
    if (edgeNode) |n| {
        Modify.markDirtyRange(ctx, efc.edge_node_type, getNodeId(n));
        return n;
    } else {
        return errors.SelvaError.SELVA_ENOTSUP;
    }
}

pub fn getEdgeNode(db: *DbCtx, efc: st.EdgeFieldConstraint, ref: st.ReferenceLarge) ?Node {
    if (ref.*.edge == 0) {
        return null;
    }

    const edge_type = selva.selva_get_type_by_index(db.selva, efc.*.edge_node_type);
    return selva.selva_find_node(edge_type, ref.*.edge);
}
