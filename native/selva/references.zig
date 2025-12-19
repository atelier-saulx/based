const std = @import("std");
const errors = @import("../errors.zig");
const selva = @import("selva.zig");
const t = @import("../types.zig");
const Node = @import("node.zig");
const Schema = @import("schema.zig");
const Modify = @import("../modify/common.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const ReferenceSmall = selva.ReferenceSmall;
pub const ReferenceLarge = selva.ReferenceLarge;
pub const ReferenceAny = selva.ReferenceAny;
pub const References = selva.References;

pub fn preallocReferences(ctx: *Modify.ModifyCtx, len: u64) void {
    _ = selva.c.selva_fields_prealloc_refs(ctx.db.selva.?, ctx.node.?, ctx.fieldSchema.?, len);
}

pub fn getReference(node: Node.Node, fieldSchema: Schema.FieldSchema) ?ReferenceLarge {
    return selva.c.selva_fields_get_reference(node, fieldSchema);
}

pub fn deleteReference(ctx: *Modify.ModifyCtx, node: Node.Node, fieldSchema: Schema.FieldSchema, id: u32) !void {
    try errors.selva(selva.c.selva_fields_del_ref(
        ctx.db.selva,
        node,
        fieldSchema,
        id,
        selva.markDirtyCb,
        ctx,
    ));

    const efc = selva.c.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    Modify.markDirtyRange(ctx, dstType, id);
}

pub fn referencesHas(refs: References, dstNodeId: u32) bool {
    if (refs.len == 0) {
        return false;
    }

    return selva.c.node_id_set_bsearch(refs.*.index, refs.*.refs, dstNodeId) != -1;
}

pub fn referencesGet(refs: ?References, dstNodeId: u32) ReferenceAny {
    return selva.c.selva_fields_references_get(refs.?, dstNodeId);
}

// comptime desc: bool = false,
//. add to the iterators

pub fn ReferencesIterator(comptime desc: bool) type {
    return struct {
        refs: References,
        dstType: Node.Type,
        i: u32 = 0,
        pub fn next(self: *ReferencesIterator(desc)) ?Node.Node {
            // assert self.refs.size == selva.c.SELVA_NODE_REFERENCE_SMALL and
            if (self.i < self.refs.nr_refs) {
                const index = if (desc) self.refs.nr_refs - self.i else self.i;
                const ref = self.refs.unnamed_0.small[index];
                const node = Node.getNode(self.dstType, ref.dst);
                self.i += 1;
                return node;
            } else {
                return null;
            }
        }
    };
}

pub const ReferencesIteratorEdgesResult = struct {
    node: Node.Node,
    edge: Node.Node,
};

pub fn ReferencesIteratorEdges(comptime desc: bool) type {
    return struct {
        refs: References,
        dstType: Node.Type,
        edgeType: Node.Type,
        i: u32 = 0,
        pub fn nextRef(self: *ReferencesIteratorEdges(desc)) ?ReferencesIteratorEdgesResult {
            if (self.i < self.refs.nr_refs) {
                const index = if (desc) self.refs.nr_refs - self.i else self.i;
                const ref = self.refs.unnamed_0.large[index];
                const node = Node.getNode(self.dstType, ref.dst);
                const edgeNode = Node.getNode(self.edgeType, ref.edge);
                self.i = self.i + 1;
                if (node) |n1| {
                    if (edgeNode) |n2| {
                        return ReferencesIteratorEdgesResult{ .node = n1, .edge = n2 };
                    }
                }
            }
            return null;
        }
        pub fn next(self: *ReferencesIteratorEdges(desc)) ?Node.Node {
            if (self.i < self.refs.nr_refs) {
                const index = if (desc) self.refs.nr_refs - self.i else self.i;
                const ref = self.refs.unnamed_0.large[index];
                const node = Node.getNode(self.dstType, ref.dst);
                self.i = self.i + 1;
                if (node) |n1| {
                    return n1;
                }
            }
            return null;
        }
    };
}

pub fn getReferences(
    comptime desc: bool,
    comptime edge: bool,
    db: *DbCtx,
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
) if (edge == false) ?ReferencesIterator(desc) else ?ReferencesIteratorEdges(desc) {
    const refs = selva.c.selva_fields_get_references(node, fieldSchema);
    if (refs == null or fieldSchema.type != selva.c.SELVA_FIELD_TYPE_REFERENCES) {
        return null;
    }
    const dstType = Node.getRefDstType(db, fieldSchema) catch return null;
    if (edge) {
        const edgeType = Node.getEdgeType(db, fieldSchema) catch return null;
        return ReferencesIteratorEdges(desc){ .refs = refs, .dstType = dstType, .edgeType = edgeType };
    } else {
        return ReferencesIterator(desc){ .refs = refs, .dstType = dstType };
    }
}

pub fn iterator(
    comptime desc: bool,
    comptime edge: bool,
    db: *DbCtx,
    node: Node.Node,
    prop: u8,
    typeEntry: selva.Type,
) !if (edge == false) ReferencesIterator(desc) else ReferencesIteratorEdges(desc) {
    const fieldSchema = try Schema.getFieldSchema(typeEntry, prop);
    const it = getReferences(desc, edge, db, node, fieldSchema);
    if (it) |r| {
        return r;
    } else {
        return errors.SelvaError.SELVA_EEXIST;
    }
}

pub fn clearReferences(ctx: *Modify.ModifyCtx, node: Node.Node, fieldSchema: Schema.FieldSchema) void {
    selva.c.selva_fields_clear_references(ctx.db.selva, node, fieldSchema, selva.markDirtyCb, ctx);
}

pub fn writeReference(ctx: *Modify.ModifyCtx, src: Node.Node, fieldSchema: Schema.FieldSchema, dst: Node.Node) !?ReferenceLarge {
    var refAny: selva.c.SelvaNodeReferenceAny = undefined;

    errors.selva(selva.c.selva_fields_reference_set(
        ctx.db.selva,
        src,
        fieldSchema,
        dst,
        &refAny,
        selva.markDirtyCb,
        ctx,
    )) catch |err| {
        if (err != errors.SelvaError.SELVA_EEXIST) {
            return err;
        }

        const ref = selva.c.selva_fields_get_reference(src, fieldSchema);
        if (ref == null) {
            return errors.SelvaError.SELVA_ENOENT; // how, it was just there???
        }

        refAny.type = selva.c.SELVA_NODE_REFERENCE_LARGE;
        refAny.p.large = ref;
    };

    std.debug.assert(refAny.type == selva.c.SELVA_NODE_REFERENCE_LARGE);

    return refAny.p.large;
}

pub fn putReferences(ctx: *Modify.ModifyCtx, node: Node.Node, fieldSchema: Schema.FieldSchema, ids: []u32) !void {
    try errors.selva(selva.c.selva_fields_references_insert_tail(ctx.db.selva, node, fieldSchema, try Node.getRefDstType(ctx.db, fieldSchema), ids.ptr, ids.len, selva.markDirtyCb, ctx));

    const efc = selva.c.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    for (ids) |id| {
        Modify.markDirtyRange(ctx, dstType, id);
    }
}

// @param index 0 = first; -1 = last.
pub fn insertReference(ctx: *Modify.ModifyCtx, node: Node.Node, fieldSchema: Schema.FieldSchema, dstNode: Node.Node, index: isize, reorder: bool) !selva.c.SelvaNodeReferenceAny {
    const te_dst = selva.c.selva_get_type_by_node(ctx.db.selva, dstNode);
    var ref: selva.c.SelvaNodeReferenceAny = undefined;
    const insertFlags: selva.c.selva_fields_references_insert_flags = if (reorder) selva.c.SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER else 0;
    const code = selva.c.selva_fields_references_insert(ctx.db.selva, node, fieldSchema, index, insertFlags, te_dst, dstNode, &ref, selva.markDirtyCb, ctx);

    if (code != selva.c.SELVA_EEXIST) {
        try errors.selva(code);
    } else {
        // here we want to be able to pass a node pointer for the prev node
        // relevant when updating
        const efc = selva.c.selva_get_edge_field_constraint(fieldSchema);
        const dstType = efc.*.dst_node_type;
        Modify.markDirtyRange(ctx, dstType, Node.getNodeId(dstNode));
    }

    return ref;
}

pub fn moveReference(
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
    index_old: isize,
    index_new: isize,
) !void {
    try errors.selva(selva.c.selva_fields_references_move(
        node,
        fieldSchema,
        index_old,
        index_new,
    ));
}

pub fn swapReference(
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
    index_a: selva.c.user_ssize_t,
    index_b: selva.c.user_ssize_t,
) !void {
    try errors.selva(selva.c.selva_fields_references_swap(node, fieldSchema, index_a, index_b));
}

// when youri is done with modify edges REMOVE
// this should be gone
pub fn getEdgeReference(
    db: *DbCtx,
    efc: Schema.EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?ReferenceLarge {
    const edge_node = Node.getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = Schema.getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.c.selva_fields_get_reference(edge_node, fs);
}

// TODO This should be going away
pub fn getEdgeReferences(
    db: *DbCtx,
    efc: Schema.EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?References {
    const edge_node = Node.getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = Schema.getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.c.selva_fields_get_references(edge_node, fs);
}
