const std = @import("std");
const errors = @import("../errors.zig");
const selva = @import("../selva.zig").c;
const st = @import("../selva.zig");
const t = @import("../types.zig");
const Db = @import("db.zig");
const Node = @import("node.zig");
const Modify = @import("../modify/common.zig");
pub const DbCtx = @import("ctx.zig").DbCtx;

pub const ReferenceSmall = st.ReferenceSmall;
pub const ReferenceLarge = st.ReferenceLarge;
pub const ReferenceAny = st.ReferenceAny;
pub const References = st.References;

pub fn preallocReferences(ctx: *Modify.ModifyCtx, len: u64) void {
    _ = selva.selva_fields_prealloc_refs(ctx.db.selva.?, ctx.node.?, ctx.fieldSchema.?, len);
}

pub fn getSingleReference(node: st.Node, fieldSchema: st.FieldSchema) ?ReferenceLarge {
    return selva.selva_fields_get_reference(node, fieldSchema);
}

pub fn getReferences(node: st.Node, fieldSchema: st.FieldSchema) ?References {
    return selva.selva_fields_get_references(node, fieldSchema);
}

pub fn clearReferences(ctx: *Modify.ModifyCtx, node: st.Node, fieldSchema: st.FieldSchema) void {
    selva.selva_fields_clear_references(ctx.db.selva, node, fieldSchema, st.markDirtyCb, ctx);
}

pub fn deleteReference(ctx: *Modify.ModifyCtx, node: st.Node, fieldSchema: st.FieldSchema, id: u32) !void {
    try errors.selva(selva.selva_fields_del_ref(
        ctx.db.selva,
        node,
        fieldSchema,
        id,
        st.markDirtyCb,
        ctx,
    ));

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    Modify.markDirtyRange(ctx, dstType, id);
}

pub fn referencesHas(refs: References, dstNodeId: u32) bool {
    if (refs.len == 0) {
        return false;
    }

    return selva.node_id_set_bsearch(refs.*.index, refs.*.refs, dstNodeId) != -1;
}

pub fn referencesGet(refs: ?References, dstNodeId: u32) ReferenceAny {
    return selva.selva_fields_references_get(refs.?, dstNodeId);
}

pub fn writeReference(ctx: *Modify.ModifyCtx, src: st.Node, fieldSchema: st.FieldSchema, dst: st.Node) !?ReferenceLarge {
    var refAny: selva.SelvaNodeReferenceAny = undefined;

    errors.selva(selva.selva_fields_reference_set(
        ctx.db.selva,
        src,
        fieldSchema,
        dst,
        &refAny,
        st.markDirtyCb,
        ctx,
    )) catch |err| {
        if (err != errors.SelvaError.SELVA_EEXIST) {
            return err;
        }

        const ref = selva.selva_fields_get_reference(src, fieldSchema);
        if (ref == null) {
            return errors.SelvaError.SELVA_ENOENT; // how, it was just there???
        }

        refAny.type = selva.SELVA_NODE_REFERENCE_LARGE;
        refAny.p.large = ref;
    };

    std.debug.assert(refAny.type == selva.SELVA_NODE_REFERENCE_LARGE);

    return refAny.p.large;
}

pub fn putReferences(ctx: *Modify.ModifyCtx, node: st.Node, fieldSchema: st.FieldSchema, ids: []u32) !void {
    try errors.selva(selva.selva_fields_references_insert_tail(ctx.db.selva, node, fieldSchema, try Db.getRefDstType(ctx.db, fieldSchema), ids.ptr, ids.len, st.markDirtyCb, ctx));

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    for (ids) |id| {
        Modify.markDirtyRange(ctx, dstType, id);
    }
}

// @param index 0 = first; -1 = last.
pub fn insertReference(ctx: *Modify.ModifyCtx, node: st.Node, fieldSchema: st.FieldSchema, dstNode: st.Node, index: isize, reorder: bool) !selva.SelvaNodeReferenceAny {
    const te_dst = selva.selva_get_type_by_node(ctx.db.selva, dstNode);
    var ref: selva.SelvaNodeReferenceAny = undefined;
    const insertFlags: selva.selva_fields_references_insert_flags = if (reorder) selva.SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER else 0;
    const code = selva.selva_fields_references_insert(ctx.db.selva, node, fieldSchema, index, insertFlags, te_dst, dstNode, &ref, st.markDirtyCb, ctx);

    if (code != selva.SELVA_EEXIST) {
        try errors.selva(code);
    } else {
        // here we want to be able to pass a node pointer for the prev node
        // relevant when updating
        const efc = selva.selva_get_edge_field_constraint(fieldSchema);
        const dstType = efc.*.dst_node_type;
        Modify.markDirtyRange(ctx, dstType, Node.getNodeId(dstNode));
    }

    return ref;
}

pub fn moveReference(
    node: st.Node,
    fieldSchema: st.FieldSchema,
    index_old: isize,
    index_new: isize,
) !void {
    try errors.selva(selva.selva_fields_references_move(
        node,
        fieldSchema,
        index_old,
        index_new,
    ));
}

pub fn swapReference(
    node: st.Node,
    fieldSchema: st.FieldSchema,
    index_a: selva.user_ssize_t,
    index_b: selva.user_ssize_t,
) !void {
    try errors.selva(selva.selva_fields_references_swap(node, fieldSchema, index_a, index_b));
}

pub fn getEdgeReference(
    db: *DbCtx,
    efc: st.EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?ReferenceLarge {
    const edge_node = Node.getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = Db.getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.selva_fields_get_reference(edge_node, fs);
}

// TODO This should be going away
pub fn getEdgeReferences(
    db: *DbCtx,
    efc: st.EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?References {
    const edge_node = Node.getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = Db.getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.selva_fields_get_references(edge_node, fs);
}

//const ReferencesIteratorResult = struct {
//    node: Node,
//    edgeNode: Node,
//};
//
//const ReferencesIterator1 = struct {
//    refs:
//    i: u32 = 0,
//    fn next(self: *ReferencesIterator1) Node {
//        self.node = null;
//        return null;
//    }
//};
//
//const ReferencesIterator2 = struct {
//    node: ?Node = null,
//    fn next(self: *ReferencesIterator2) ?ReferencesIteratorResult {
//        self.node = null;
//        return null;
//    }
//};
