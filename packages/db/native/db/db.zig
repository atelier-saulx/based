const assert = std.debug.assert;
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const modifyCtx = @import("../modify/ctx.zig");
const utils = @import("../utils.zig");
const types = @import("../types.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
pub const DbCtx = @import("./ctx.zig").DbCtx;

const read = utils.read;

pub const TypeId = u16;
pub const Node = *selva.SelvaNode;
pub const Aliases = *selva.SelvaAliases;
pub const Type = *selva.SelvaTypeEntry;
pub const FieldSchema = *const selva.SelvaFieldSchema;
pub const EdgeFieldConstraint = *const selva.EdgeFieldConstraint;

const emptySlice = &.{};
const emptyArray: []const [16]u8 = emptySlice;

extern "c" const selva_string: opaque {};

pub fn getType(ctx: *DbCtx, typeId: TypeId) !Type {
    const selvaTypeEntry: ?*selva.SelvaTypeEntry = selva.selva_get_type_by_index(
        ctx.selva.?,
        typeId,
    );
    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }
    return selvaTypeEntry.?;
}

pub fn getFieldSchema(typeEntry: ?Type, field: u8) !FieldSchema {
    const s: ?*const selva.SelvaFieldSchema = selva.selva_get_fs_by_te_field(
        typeEntry.?,
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaByNode(ctx: *DbCtx, node: Node, field: u8) !FieldSchema {
    const s: ?*const selva.SelvaFieldSchema = selva.selva_get_fs_by_node(ctx.selva.?, node, field);
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaFromEdge(field: u8, typeEntry: ?Type) !FieldSchema {
    const s: ?*const selva.SelvaFieldSchema = selva.selva_get_fs_by_te_field(
        typeEntry.?,
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getCardinalityField(node: Node, fieldSchema: FieldSchema) ?[]u8 {
    if (selva.selva_fields_get_selva_string(node, fieldSchema)) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return null;
    }
}

pub fn selvaStringDestroy(str: ?selva.selva_string) void {
    try selva.selva_string_free(str);
}

pub fn getCardinalityReference(ctx: *DbCtx, ref: *selva.SelvaNodeLargeReference, fieldSchema: FieldSchema) []u8 {
    if (selva.selva_fields_get_selva_string3(ctx.selva, ref, fieldSchema) orelse null) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return emptySlice;
    }
}

pub fn getField(
    typeEntry: ?Type,
    id: u32,
    node: Node,
    fieldSchema: FieldSchema,
    fieldType: types.Prop,
) []u8 {
    if (fieldType == types.Prop.ALIAS) {
        const target = if (id == 0) getNodeId(node) else id;
        const typeAliases = selva.selva_get_aliases(typeEntry, fieldSchema.field);
        const alias = selva.selva_get_alias_by_dest(typeAliases, target);
        if (alias == null) {
            return @as([*]u8, undefined)[0..0];
        }
        var len: usize = 0;
        const res = selva.selva_get_alias_name(alias, &len);
        return @as([*]u8, @constCast(res))[0..len];
    } else if (fieldType == types.Prop.CARDINALITY) {
        return getCardinalityField(node, fieldSchema) orelse emptySlice;
    } else if (fieldType == types.Prop.COLVEC) {
        const nodeId = if (id == 0) getNodeId(node) else id;
        const vec = selva.colvec_get_vec(typeEntry, nodeId, fieldSchema);
        const len = fieldSchema.*.unnamed_0.colvec.vec_len * fieldSchema.*.unnamed_0.colvec.comp_size;
        return @as([*]u8, @ptrCast(vec))[0..len];
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, fieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub inline fn getNodeFromReference(ref: ?*selva.SelvaNodeLargeReference) ?Node {
    if (ref) |r| {
        return r.*.dst;
    }
    return null;
}

pub inline fn getReferenceNodeId(ref: ?*selva.SelvaNodeLargeReference) []u8 {
    if (ref != null) {
        const dst = getNodeFromReference(ref);
        if (dst != null) {
            const id: *u32 = @alignCast(@ptrCast(dst));
            return std.mem.asBytes(id)[0..4];
        }
    }
    return &[_]u8{};
}

pub fn getSingleReference(ctx: *DbCtx, node: Node, fieldSchema: FieldSchema) ?*selva.SelvaNodeLargeReference {
    const result = selva.selva_fields_get_reference(ctx.selva, node, fieldSchema);
    return result;
}

pub fn getReferences(ctx: *DbCtx, node: Node, fieldSchema: FieldSchema) ?*selva.SelvaNodeReferences {
    const result = selva.selva_fields_get_references(ctx.selva, node, fieldSchema);
    return result;
}

pub fn clearReferences(ctx: *modifyCtx.ModifyCtx, node: Node, fieldSchema: FieldSchema) void {
    selva.selva_fields_clear_references(ctx.db.selva, node, fieldSchema, markDirtyCb, ctx);
}

pub fn deleteReference(ctx: *modifyCtx.ModifyCtx, node: Node, fieldSchema: FieldSchema, id: u32) !void {
    try errors.selva(selva.selva_fields_del_ref(
        ctx.db.selva,
        node,
        fieldSchema,
        id,
    ));

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    modifyCtx.markDirtyRange(ctx, dstType, id);
}

pub fn writeField(data: []u8, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(switch (fieldSchema.*.type) {
        selva.SELVA_FIELD_TYPE_MICRO_BUFFER => selva.selva_fields_set_micro_buffer2(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_STRING => selva.selva_fields_set_string(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_TEXT => selva.selva_fields_set_text(node, fieldSchema, data.ptr, data.len),
        else => selva.SELVA_EINTYPE,
    });
}

pub fn setText(str: []u8, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_set_text(
        node,
        fieldSchema,
        str.ptr,
        str.len,
    ));
}

pub fn setMicroBuffer(node: Node, fieldSchema: FieldSchema, value: []u8) !void {
    try errors.selva(selva.selva_fields_set_micro_buffer2(
        node,
        fieldSchema,
        value.ptr,
        value.len,
    ));
}

pub fn setColvec(te: Type, nodeId: selva.node_id_t, fieldSchema: FieldSchema, vec: []u8) void {
    selva.colvec_set_vec(
        te,
        nodeId,
        fieldSchema,
        vec.ptr,
    );
}

pub fn writeReference(ctx: *modifyCtx.ModifyCtx, value: Node, src: Node, fieldSchema: FieldSchema) !?*selva.SelvaNodeLargeReference {
    var refAny: selva.SelvaNodeReferenceAny = undefined;
    errors.selva(selva.selva_fields_reference_set(
        ctx.db.selva,
        src,
        fieldSchema,
        value,
        &refAny,
        markDirtyCb,
        ctx,
    )) catch |err| {
        if (err == errors.SelvaError.SELVA_EEXIST) {
            const result = selva.selva_fields_get_reference(ctx.db.selva, src, fieldSchema);
            if (result == null) {
                return err;
            }
            return result;
        } else {
            return err;
        }
    };

    assert(refAny.type == selva.SELVA_NODE_REFERENCE_LARGE);

    return refAny.p.large;
}

// want to have one without upsert
pub fn putReferences(ctx: *modifyCtx.ModifyCtx, ids: []u32, target: Node, fieldSchema: FieldSchema, typeEntry: Type) !void {
    try errors.selva(selva.selva_fields_references_insert_tail_wupsert(
        ctx.db.selva,
        target,
        fieldSchema,
        typeEntry,
        ids.ptr,
        ids.len,
    ));

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    for (ids) |id| {
        modifyCtx.markDirtyRange(ctx, dstType, id);
    }
}

// @param index 0 = first; -1 = last.
pub fn insertReference(ctx: *modifyCtx.ModifyCtx, value: Node, target: Node, fieldSchema: FieldSchema, index: isize, reorder: bool) !selva.SelvaNodeReferenceAny {
    // TODO Things can be optimized quite a bit if the type entry could be passed as an arg.
    const te_dst = selva.selva_get_type_by_node(ctx.db.selva, value);
    var ref: selva.SelvaNodeReferenceAny = undefined;
    const code = selva.selva_fields_references_insert(
        ctx.db.selva,
        target,
        fieldSchema,
        index,
        reorder,
        te_dst,
        value,
        &ref,
    );

    if (code != selva.SELVA_EEXIST) {
        try errors.selva(code);
    } else {
        // here we want to be able to pass a node pointer for the prev node
        // relevant when updating
        const efc = selva.selva_get_edge_field_constraint(fieldSchema);
        const dstType = efc.*.dst_node_type;
        modifyCtx.markDirtyRange(ctx, dstType, getNodeId(value));
    }

    return ref;
}

pub fn moveReference(
    node: Node,
    fieldSchema: FieldSchema,
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
    node: Node,
    fieldSchema: FieldSchema,
    index_a: selva.user_ssize_t,
    index_b: selva.user_ssize_t,
) !void {
    try errors.selva(selva.selva_fields_references_swap(node, fieldSchema, index_a, index_b));
}

pub fn getEdgeProp(
    ref: *selva.SelvaNodeLargeReference,
    fieldSchema: FieldSchema,
) []u8 {
    if (ref.meta != null) {
        const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw2(
            ref.meta,
            fieldSchema,
        );
        return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
    } else {
        return emptySlice;
    }
}

pub fn getEdgeFieldSchema(db: *selva.SelvaDb, edgeConstaint: *const selva.EdgeFieldConstraint, field: u8) !FieldSchema {
    const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
        selva.selva_get_edge_field_fields_schema(db, edgeConstaint),
        field,
    );
    if (edgeFieldSchema == null) {
        return errors.SelvaError.SELVA_NO_EDGE_FIELDSCHEMA;
    }
    return edgeFieldSchema;
}

pub fn getEdgeReferences(
    ref: *selva.SelvaNodeLargeReference,
    field: u8,
) ?selva.SelvaNodeWeakReferences {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_references(
            ref.meta,
            field,
        );
    }
    return null;
}

pub fn resolveEdgeReference(ctx: *DbCtx, fieldSchema: FieldSchema, ref: *selva.SelvaNodeWeakReference) ?Node {
    if (ref.dst_id == 0) {
        return null;
    }
    return selva.selva_fields_resolve_weak_reference(ctx.selva, fieldSchema, ref);
}

pub fn getEdgeReference(
    ref: *selva.SelvaNodeLargeReference,
    field: u8,
) ?selva.SelvaNodeWeakReference {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_reference(
            ref.meta,
            field,
        );
    }
    return null;
}

pub fn writeEdgeProp(
    ctx: *modifyCtx.ModifyCtx,
    data: []u8,
    node: Node,
    efc: *const selva.EdgeFieldConstraint,
    ref: *selva.SelvaNodeLargeReference,
    fieldSchema: FieldSchema,
) !void {
    try errors.selva(selva.selva_fields_set_reference_meta(
        ctx.db.selva,
        node,
        ref,
        efc,
        fieldSchema,
        data.ptr,
        data.len,
    ));
    if ((efc.flags & selva.EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP) == 0) {
        modifyCtx.markDirtyRange(ctx, ctx.typeId, ctx.id);
    } else if (ref.dst) |dst| {
        modifyCtx.markDirtyRange(ctx, efc.dst_node_type, getNodeId(dst));
    }
}

// TODO This is now hll specific but we might want to change it.
pub fn ensurePropString(
    ctx: *modifyCtx.ModifyCtx,
    fieldSchema: FieldSchema,
) !*selva.selva_string {
    return selva.selva_fields_ensure_string(ctx.node.?, fieldSchema, selva.HLL_INIT_SIZE) orelse errors.SelvaError.SELVA_EINTYPE;
}

// TODO This is now hll specific but we might want to change it.
pub fn ensureEdgePropString(
    ctx: *modifyCtx.ModifyCtx,
    node: Node,
    efc: *const selva.EdgeFieldConstraint,
    ref: *selva.SelvaNodeLargeReference,
    fieldSchema: FieldSchema,
) !*selva.selva_string {
    return selva.selva_fields_ensure_string2(
        ctx.db.selva.?,
        node,
        efc,
        ref,
        fieldSchema,
        selva.HLL_INIT_SIZE,
    ) orelse errors.SelvaError.SELVA_EINTYPE;
}

pub fn preallocReferences(ctx: *modifyCtx.ModifyCtx, len: u64) void {
    _ = selva.selva_fields_prealloc_refs(ctx.db.selva.?, ctx.node.?, ctx.fieldSchema.?, len);
}

fn markDirtyCb(ctx: ?*anyopaque, typeId: u16, nodeId: u32) callconv(.C) void {
    const mctx: *modifyCtx.ModifyCtx = @ptrCast(@alignCast(ctx));
    modifyCtx.markDirtyRange(mctx, typeId, nodeId);
}

pub fn deleteField(ctx: *modifyCtx.ModifyCtx, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.db.selva, node, fieldSchema, markDirtyCb, ctx));
}

pub fn deleteTextFieldTranslation(ctx: *modifyCtx.ModifyCtx, fieldSchema: FieldSchema, lang: types.LangCode) !void {
    return errors.selva(selva.selva_fields_set_text(ctx.node, fieldSchema, &selva.selva_fields_text_tl_empty[@intFromEnum(lang)], selva.SELVA_FIELDS_TEXT_TL_EMPTY_LEN));
}

pub fn getRefTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    return result;
}

pub fn deleteNode(ctx: *modifyCtx.ModifyCtx, typeEntry: Type, node: Node) !void {
    selva.selva_del_node(ctx.db.selva, typeEntry, node, markDirtyCb, ctx);
}

pub fn upsertNode(id: u32, typeEntry: Type) !Node {
    const node = selva.selva_upsert_node(typeEntry, id);
    if (node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return node.?;
}

pub fn getNode(id: u32, typeEntry: Type) ?Node {
    return selva.selva_find_node(typeEntry, id);
}

pub inline fn getNodeIdAsSlice(node: Node) []u8 {
    return @as([*]u8, @ptrCast(node))[0..4];
}

pub inline fn getNodeId(node: Node) u32 {
    return read(u32, @as([*]u8, @ptrCast(node))[0..4], 0);
}

pub fn getFirstNode(typeEntry: Type) ?Node {
    return selva.selva_min_node(typeEntry);
}

pub fn getLastNode(typeEntry: Type) ?Node {
    return selva.selva_max_node(typeEntry);
}

pub fn getNextNode(typeEntry: Type, node: Node) ?Node {
    return selva.selva_next_node(typeEntry, node);
}

pub fn getPrevNode(typeEntry: Type, node: Node) ?Node {
    return selva.selva_prev_node(typeEntry, node);
}

pub fn getNodeRangeHash(db: *selva.SelvaDb, typeEntry: Type, start: u32, end: u32) !selva.SelvaHash128 {
    var hash: u128 = undefined;
    try errors.selva(selva.selva_node_hash_range(db, typeEntry, start, end, &hash));
    return hash;
}

pub fn setAlias(typeEntry: Type, id: u32, field: u8, aliasName: []u8) !u32 {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    const old_dest = selva.selva_set_alias(typeAliases, id, aliasName.ptr, aliasName.len);
    return old_dest;
}

pub fn delAliasByName(typeEntry: Type, field: u8, aliasName: []u8) !u32 {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    const old_dest = selva.selva_del_alias_by_name(typeAliases, aliasName.ptr, aliasName.len);

    if (old_dest == 0) {
        return errors.SelvaError.SELVA_ENOENT;
    }

    return old_dest;
}

pub fn delAlias(typeEntry: Type, node_id: selva.node_id_t, field: u8) !void {
    const aliases = selva.selva_get_aliases(typeEntry, field);
    if (aliases != null) {
        selva.selva_del_alias_by_dest(aliases, node_id);
    }
}

pub fn getAliasByName(typeEntry: Type, field: u8, aliasName: []u8) ?Node {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    return selva.selva_get_alias(typeEntry, typeAliases, aliasName.ptr, aliasName.len);
}

pub inline fn getTextFromValueFallback(
    value: []u8,
    code: types.LangCode,
    fallbacks: []u8,
) []u8 {
    if (value.len == 0) {
        return value;
    }
    var lastFallbackValue: []u8 = undefined;
    var lastFallbackIndex: usize = fallbacks.len;
    var index: usize = 0;
    const langInt = @intFromEnum(code);
    const textTmp: *[*]const [selva.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    while (index < text.len) {
        var len: usize = undefined;
        const str: [*]const u8 = selva.selva_string_to_buf(@ptrCast(&text[index]), &len);
        const s = @as([*]u8, @constCast(str));
        const langCode = s[0];
        if (langCode == langInt) {
            return s[0..len];
        }
        if (lastFallbackIndex != 0) {
            var i: usize = 0;
            while (i < lastFallbackIndex) {
                if (langCode == fallbacks[i]) {
                    lastFallbackValue = s[0..len];
                    lastFallbackIndex = i;
                    break;
                }
                i += 1;
            }
        }
        index += 1;
    }
    if (lastFallbackIndex != fallbacks.len) {
        return lastFallbackValue;
    }
    return @as([*]u8, undefined)[0..0];
}

pub inline fn getTextFromValue(value: []u8, code: types.LangCode) []u8 {
    if (value.len == 0) {
        return value;
    }
    var index: usize = 0;
    const langInt = @intFromEnum(code);
    const textTmp: *[*]const [selva.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    while (index < text.len) {
        var len: usize = undefined;
        const str: [*]const u8 = selva.selva_string_to_buf(@ptrCast(&text[index]), &len);
        const s = @as([*]u8, @constCast(str));
        const langCode = s[0];
        if (langCode == langInt) {
            return s[0..len];
        }
        index += 1;
    }
    return @as([*]u8, undefined)[0..0];
}

pub const TextIterator = struct {
    value: []const [selva.SELVA_STRING_STRUCT_SIZE]u8,
    index: usize = 0,
    fn _next(self: *TextIterator) ?[]u8 {
        if (self.index == self.value.len) {
            return null;
        }
        var len: usize = undefined;
        const str: [*]const u8 = selva.selva_string_to_buf(@ptrCast(&self.value[self.index]), &len);
        const s = @as([*]u8, @constCast(str));
        self.index += 1;
        return s[0..len];
    }
    pub fn next(self: *TextIterator) ?[]u8 {
        return self._next();
    }
};

pub inline fn textIterator(
    value: []u8,
) TextIterator {
    if (value.len == 0) {
        return TextIterator{ .value = emptyArray };
    }
    const textTmp: *[*]const [selva.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    return TextIterator{ .value = text };
}

pub inline fn getText(
    typeEntry: ?Type,
    id: u32,
    node: Node,
    fieldSchema: FieldSchema,
    fieldType: types.Prop,
    langCode: types.LangCode,
) []u8 {
    // fallbacks
    const data = getField(typeEntry, id, node, fieldSchema, fieldType);
    return getTextFromValue(data, langCode);
}

pub fn expire(ctx: *modifyCtx.ModifyCtx) void {
    // Expire things before query
    selva.selva_db_expire_tick(ctx.db.selva, markDirtyCb, ctx, std.time.timestamp());
}
