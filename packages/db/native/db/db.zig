const std = @import("std");
const t = @import("../types.zig");
const errors = @import("../errors.zig");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig").c;
const Modify = @import("../modify/common.zig");
const utils = @import("../utils.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const SelvaHash128 = @import("../selva.zig").SelvaHash128;
pub const DbCtx = @import("./ctx.zig").DbCtx;
pub const DbThread = @import("./threads.zig").DbThread;

const assert = std.debug.assert;
const read = utils.read;
const move = utils.move;

pub const Node = *selva.SelvaNode;
pub const Aliases = *selva.SelvaAliases;
pub const Type = *selva.SelvaTypeEntry;
pub const FieldSchema = *const selva.SelvaFieldSchema;
pub const EdgeFieldConstraint = *const selva.EdgeFieldConstraint;
pub const ReferenceSmall = *selva.SelvaNodeSmallReference;
pub const ReferenceLarge = *selva.SelvaNodeLargeReference;
pub const ReferenceAny = selva.SelvaNodeReferenceAny;
pub const References = *const selva.SelvaNodeReferences;

const emptySlice = &.{};
const emptyArray: []const [16]u8 = emptySlice;

extern "c" const selva_string: opaque {};

pub fn getType(ctx: *DbCtx, typeId: t.TypeId) !Type {
    const selvaTypeEntry: ?Type = selva.selva_get_type_by_index(
        ctx.selva.?,
        typeId,
    );
    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }
    return selvaTypeEntry.?;
}

pub inline fn getBlockCapacity(ctx: *DbCtx, typeId: t.TypeId) u64 {
    return selva.selva_get_block_capacity(selva.selva_get_type_by_index(ctx.selva, typeId));
}

pub inline fn getNodeCount(te: Type) usize {
    return selva.selva_node_count(te);
}

pub inline fn getNodeTypeId(node: Node) t.TypeId {
    return selva.selva_get_node_type(node);
}

pub inline fn getRefDstType(ctx: *DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == FieldSchema) {
        return getType(ctx, selva.selva_get_edge_field_constraint(sch).*.dst_node_type);
    } else if (comptime @TypeOf(sch) == EdgeFieldConstraint) {
        return getType(ctx, sch.*.dst_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub inline fn getEdgeType(ctx: *DbCtx, sch: anytype) !Type {
    if (comptime @TypeOf(sch) == FieldSchema) {
        return getType(ctx, selva.selva_get_edge_field_constraint(sch).*.edge_node_type);
    } else if (comptime @TypeOf(sch) == EdgeFieldConstraint) {
        return getType(ctx, sch.*.edge_node_type);
    } else {
        @compileLog("Invalid type: ", @TypeOf(sch));
        @compileError("Invalid type");
    }
}

pub fn getFieldSchema(typeEntry: ?Type, field: u8) !FieldSchema {
    const s: ?FieldSchema = selva.selva_get_fs_by_te_field(
        typeEntry.?,
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaByNode(ctx: *DbCtx, node: Node, field: u8) !FieldSchema {
    const s: ?FieldSchema = selva.selva_get_fs_by_node(ctx.selva.?, node, field);
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaFromEdge(field: u8, typeEntry: ?Type) !FieldSchema {
    const s: ?FieldSchema = selva.selva_get_fs_by_te_field(
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

pub fn getCardinalityReference(ctx: *DbCtx, efc: EdgeFieldConstraint, ref: ReferenceLarge, fieldSchema: FieldSchema) []u8 {
    const edge_node = getEdgeNode(ctx, efc, ref);
    if (edge_node == null) {
        return emptySlice;
    }

    if (selva.selva_fields_get_selva_string(edge_node, fieldSchema) orelse null) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return emptySlice;
    }
}

pub fn getField(
    typeEntry: ?Type,
    node: Node,
    fieldSchema: FieldSchema,
    fieldType: t.PropType,
) []u8 {
    if (fieldType == t.PropType.alias) {
        const target = getNodeId(node);
        const typeAliases = selva.selva_get_aliases(typeEntry, fieldSchema.field);
        const alias = selva.selva_get_alias_by_dest(typeAliases, target);
        if (alias == null) {
            return @as([*]u8, undefined)[0..0];
        }
        var len: usize = 0;
        const res = selva.selva_get_alias_name(alias, &len);
        return @as([*]u8, @constCast(res))[0..len];
    } else if (fieldType == t.PropType.cardinality) {
        return getCardinalityField(node, fieldSchema) orelse emptySlice;
    } else if (fieldType == t.PropType.colVec) {
        const nodeId = getNodeId(node);
        const vec = selva.colvec_get_vec(typeEntry, nodeId, fieldSchema);
        const len = fieldSchema.*.unnamed_0.colvec.vec_len * fieldSchema.*.unnamed_0.colvec.comp_size;
        return @as([*]u8, @ptrCast(vec))[0..len];
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, fieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub inline fn getNodeFromReference(dstType: Type, ref: anytype) ?Node {
    if (comptime @TypeOf(ref) == ReferenceSmall or
        @TypeOf(ref) == ReferenceLarge or
        @TypeOf(ref) == *allowzero selva.SelvaNodeSmallReference or
        @TypeOf(ref) == *allowzero selva.SelvaNodeLargeReference)
    {
        return selva.selva_find_node(dstType, ref.*.dst);
    } else if (comptime @TypeOf(ref) == ?ReferenceSmall or
        @TypeOf(ref) == ?ReferenceLarge or
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

pub inline fn getReferenceNodeId(ref: ?ReferenceLarge) []u8 {
    if (ref) |r| {
        const id: *u32 = @ptrCast(@alignCast(&r.*.dst));
        return std.mem.asBytes(id)[0..4];
    }
    return &[_]u8{};
}

pub fn getSingleReference(node: Node, fieldSchema: FieldSchema) ?ReferenceLarge {
    return selva.selva_fields_get_reference(node, fieldSchema);
}

pub fn getReferences(node: Node, fieldSchema: FieldSchema) ?References {
    return selva.selva_fields_get_references(node, fieldSchema);
}

pub fn clearReferences(ctx: *Modify.ModifyCtx, node: Node, fieldSchema: FieldSchema) void {
    selva.selva_fields_clear_references(ctx.db.selva, node, fieldSchema, markDirtyCb, ctx);
}

pub fn deleteReference(ctx: *Modify.ModifyCtx, node: Node, fieldSchema: FieldSchema, id: u32) !void {
    try errors.selva(selva.selva_fields_del_ref(
        ctx.db.selva,
        node,
        fieldSchema,
        id,
        markDirtyCb,
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

pub fn writeField(node: Node, fieldSchema: FieldSchema, data: []u8) !void {
    try errors.selva(switch (fieldSchema.*.type) {
        selva.SELVA_FIELD_TYPE_MICRO_BUFFER => selva.selva_fields_set_micro_buffer(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_STRING => selva.selva_fields_set_string(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_TEXT => selva.selva_fields_set_text(node, fieldSchema, data.ptr, data.len),
        else => selva.SELVA_EINTYPE,
    });
}

pub fn setText(node: Node, fieldSchema: FieldSchema, str: []u8) !void {
    try errors.selva(selva.selva_fields_set_text(
        node,
        fieldSchema,
        str.ptr,
        str.len,
    ));
}

pub fn setMicroBuffer(node: Node, fieldSchema: FieldSchema, value: []u8) !void {
    try errors.selva(selva.selva_fields_set_micro_buffer(
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

pub fn writeReference(ctx: *Modify.ModifyCtx, src: Node, fieldSchema: FieldSchema, dst: Node) !?ReferenceLarge {
    var refAny: selva.SelvaNodeReferenceAny = undefined;

    errors.selva(selva.selva_fields_reference_set(
        ctx.db.selva,
        src,
        fieldSchema,
        dst,
        &refAny,
        markDirtyCb,
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

    assert(refAny.type == selva.SELVA_NODE_REFERENCE_LARGE);

    return refAny.p.large;
}

pub fn putReferences(ctx: *Modify.ModifyCtx, node: Node, fieldSchema: FieldSchema, ids: []u32) !void {
    try errors.selva(selva.selva_fields_references_insert_tail(ctx.db.selva, node, fieldSchema, try getRefDstType(ctx.db, fieldSchema), ids.ptr, ids.len, markDirtyCb, ctx));

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    for (ids) |id| {
        Modify.markDirtyRange(ctx, dstType, id);
    }
}

// @param index 0 = first; -1 = last.
pub fn insertReference(ctx: *Modify.ModifyCtx, node: Node, fieldSchema: FieldSchema, dstNode: Node, index: isize, reorder: bool) !selva.SelvaNodeReferenceAny {
    const te_dst = selva.selva_get_type_by_node(ctx.db.selva, dstNode);
    var ref: selva.SelvaNodeReferenceAny = undefined;
    const insertFlags: selva.selva_fields_references_insert_flags = if (reorder) selva.SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER else 0;
    const code = selva.selva_fields_references_insert(ctx.db.selva, node, fieldSchema, index, insertFlags, te_dst, dstNode, &ref, markDirtyCb, ctx);

    if (code != selva.SELVA_EEXIST) {
        try errors.selva(code);
    } else {
        // here we want to be able to pass a node pointer for the prev node
        // relevant when updating
        const efc = selva.selva_get_edge_field_constraint(fieldSchema);
        const dstType = efc.*.dst_node_type;
        Modify.markDirtyRange(ctx, dstType, getNodeId(dstNode));
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

fn getEdgeNode(db: *DbCtx, efc: EdgeFieldConstraint, ref: ReferenceLarge) ?Node {
    if (ref.*.edge == 0) {
        return null;
    }

    const edge_type = selva.selva_get_type_by_index(db.selva, efc.*.edge_node_type);
    return selva.selva_find_node(edge_type, ref.*.edge);
}

pub inline fn getEdgeFieldConstraint(fieldSchema: FieldSchema) EdgeFieldConstraint {
    return selva.selva_get_edge_field_constraint(fieldSchema);
}

pub fn getEdgeFieldSchema(db: *DbCtx, edgeConstraint: EdgeFieldConstraint, field: u8) !FieldSchema {
    const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
        selva.selva_get_edge_field_fields_schema(db.selva, edgeConstraint),
        field,
    );
    if (edgeFieldSchema == null) {
        return errors.SelvaError.SELVA_NO_EDGE_FIELDSCHEMA;
    }
    return edgeFieldSchema;
}

// TODO This should be going away
pub fn getEdgePropType(
    db: *DbCtx,
    efc: EdgeFieldConstraint,
    ref: ReferenceLarge,
    fieldSchema: FieldSchema,
) []u8 {
    const edge_node = getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return emptySlice;
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(
        edge_node,
        fieldSchema,
    );
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn getEdgeReference(
    db: *DbCtx,
    efc: EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?ReferenceLarge {
    const edge_node = getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.selva_fields_get_reference(edge_node, fs);
}

// TODO This should be going away
pub fn getEdgeReferences(
    db: *DbCtx,
    efc: EdgeFieldConstraint,
    ref: ReferenceLarge,
    field: u8,
) ?References {
    const edge_node = getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return null;
    }

    const fs = getEdgeFieldSchema(db, efc, field) catch null;
    if (fs == null) {
        return null;
    }

    return selva.selva_fields_get_references(edge_node, fs);
}

// TODO This is now hll specific but we might want to change it.
pub fn ensurePropTypeString(
    ctx: *Modify.ModifyCtx,
    fieldSchema: FieldSchema,
) !*selva.selva_string {
    return selva.selva_fields_ensure_string(ctx.node.?, fieldSchema, selva.HLL_INIT_SIZE) orelse errors.SelvaError.SELVA_EINTYPE;
}

pub fn ensureEdgePropTypeString(
    ctx: *Modify.ModifyCtx,
    node: Node,
    efc: EdgeFieldConstraint,
    ref: ReferenceLarge,
    fieldSchema: FieldSchema,
) !*selva.selva_string {
    const edge_node = selva.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0, markDirtyCb, ctx) orelse return errors.SelvaError.SELVA_ENOTSUP;
    return selva.selva_fields_ensure_string(edge_node, fieldSchema, selva.HLL_INIT_SIZE) orelse return errors.SelvaError.SELVA_EINTYPE;
}

pub fn ensureRefEdgeNode(ctx: *Modify.ModifyCtx, node: Node, efc: EdgeFieldConstraint, ref: ReferenceLarge) !Node {
    const edgeNode = selva.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0, markDirtyCb, ctx);
    if (edgeNode) |n| {
        Modify.markDirtyRange(ctx, efc.edge_node_type, getNodeId(n));
        return n;
    } else {
        return errors.SelvaError.SELVA_ENOTSUP;
    }
}

pub fn preallocReferences(ctx: *Modify.ModifyCtx, len: u64) void {
    _ = selva.selva_fields_prealloc_refs(ctx.db.selva.?, ctx.node.?, ctx.fieldSchema.?, len);
}

pub fn markDirtyCb(ctx: ?*anyopaque, typeId: u16, nodeId: u32) callconv(.c) void {
    const mctx: *Modify.ModifyCtx = @ptrCast(@alignCast(ctx));
    Modify.markDirtyRange(mctx, typeId, nodeId);
}

pub fn deleteField(ctx: *Modify.ModifyCtx, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.db.selva, node, fieldSchema, markDirtyCb, ctx));
}

pub fn deleteTextFieldTranslation(ctx: *Modify.ModifyCtx, fieldSchema: FieldSchema, lang: t.LangCode) !void {
    return errors.selva(selva.selva_fields_set_text(ctx.node, fieldSchema, &selva.selva_fields_text_tl_empty[@intFromEnum(lang)], selva.SELVA_FIELDS_TEXT_TL_EMPTY_LEN));
}

pub fn getRefTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    return result;
}

pub fn deleteNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: Node) !void {
    selva.selva_del_node(ctx.db.selva, typeEntry, node, markDirtyCb, ctx);
}

pub fn flushNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: Node) void {
    selva.selva_flush_node(ctx.db.selva, typeEntry, node, markDirtyCb, ctx);
}

pub fn upsertNode(ctx: *Modify.ModifyCtx, typeEntry: Type, id: u32) !Node {
    const node = selva.selva_upsert_node(ctx.db.selva, typeEntry, id);
    if (node == null) {
        return errors.SelvaError.SELVA_CANNOT_UPSERT;
    }
    return node.?;
}

pub fn getNode(typeEntry: Type, id: u32) ?Node {
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

pub fn getNodeBlockHash(db: *DbCtx, typeEntry: Type, start: u32, hashOut: *SelvaHash128) c_int {
    return selva.selva_node_block_hash(db.selva, typeEntry, start, hashOut);
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
    code: t.LangCode,
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

pub inline fn getTextFromValue(value: []u8, code: t.LangCode) []u8 {
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
    node: Node,
    fieldSchema: FieldSchema,
    fieldType: t.PropType,
    langCode: t.LangCode,
) []u8 {
    // fallbacks
    const data = getField(typeEntry, node, fieldSchema, fieldType);
    return getTextFromValue(data, langCode);
}

pub fn expireNode(ctx: *Modify.ModifyCtx, typeId: t.TypeId, nodeId: u32, ts: i64) void {
    selva.selva_expire_node(ctx.db.selva, typeId, nodeId, ts, selva.SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD);
    Modify.markDirtyRange(ctx, typeId, nodeId);
}

pub fn expire(ctx: *Modify.ModifyCtx) void {
    // Expire things before query
    selva.selva_db_expire_tick(ctx.db.selva, markDirtyCb, ctx, std.time.timestamp());
}
