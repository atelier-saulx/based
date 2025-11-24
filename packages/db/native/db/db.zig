const std = @import("std");
const t = @import("../types.zig");
const selva = @import("../selva.zig").c;
const st = @import("../selva.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const Node = @import("node.zig");
const References = @import("references.zig");
const Modify = @import("../modify/common.zig");
pub const DbCtx = @import("./ctx.zig").DbCtx;
pub const DbThread = @import("./threads.zig").DbThread;

const Type = Node.Type;
pub const Aliases = st.Aliases;
pub const FieldSchema = st.FieldSchema;
pub const EdgeFieldConstraint = st.EdgeFieldConstraint;
const SelvaHash128 = st.SelvaHash128;

// TODO Don't publish from here
pub const ReferenceSmall = st.ReferenceSmall;
pub const ReferenceLarge = st.ReferenceLarge;
pub const ReferenceAny = st.ReferenceAny;

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

pub fn getFieldSchemaByNode(ctx: *DbCtx, node: st.Node, field: u8) !FieldSchema {
    const s: ?FieldSchema = selva.selva_get_fs_by_node(ctx.selva.?, node, field);
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getEdgeFieldSchema(db: *DbCtx, edgeConstraint: st.EdgeFieldConstraint, field: u8) !st.FieldSchema {
    const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
        selva.selva_get_edge_field_fields_schema(db.selva, edgeConstraint),
        field,
    );
    if (edgeFieldSchema == null) {
        return errors.SelvaError.SELVA_NO_EDGE_FIELDSCHEMA;
    }
    return edgeFieldSchema;
}

pub inline fn getEdgeFieldConstraint(fieldSchema: st.FieldSchema) st.EdgeFieldConstraint {
    return selva.selva_get_edge_field_constraint(fieldSchema);
}

pub fn getCardinalityField(node: st.Node, fieldSchema: FieldSchema) ?[]u8 {
    if (selva.selva_fields_get_selva_string(node, fieldSchema)) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return null;
    }
}

pub fn getCardinalityReference(ctx: *DbCtx, efc: EdgeFieldConstraint, ref: References.ReferenceLarge, fieldSchema: FieldSchema) []u8 {
    const edge_node = Node.getEdgeNode(ctx, efc, ref);
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
    node: st.Node,
    fieldSchema: FieldSchema,
    fieldType: t.PropType,
) []u8 {
    if (fieldType == t.PropType.alias) {
        const target = Node.getNodeId(node);
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
        const nodeId = Node.getNodeId(node);
        const vec = selva.colvec_get_vec(typeEntry, nodeId, fieldSchema);
        const len = fieldSchema.*.unnamed_0.colvec.vec_len * fieldSchema.*.unnamed_0.colvec.comp_size;
        return @as([*]u8, @ptrCast(vec))[0..len];
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, fieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn writeField(node: st.Node, fieldSchema: FieldSchema, data: []u8) !void {
    try errors.selva(switch (fieldSchema.*.type) {
        selva.SELVA_FIELD_TYPE_MICRO_BUFFER => selva.selva_fields_set_micro_buffer(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_STRING => selva.selva_fields_set_string(node, fieldSchema, data.ptr, data.len),
        selva.SELVA_FIELD_TYPE_TEXT => selva.selva_fields_set_text(node, fieldSchema, data.ptr, data.len),
        else => selva.SELVA_EINTYPE,
    });
}

pub fn setText(node: st.Node, fieldSchema: FieldSchema, str: []u8) !void {
    try errors.selva(selva.selva_fields_set_text(
        node,
        fieldSchema,
        str.ptr,
        str.len,
    ));
}

pub fn setMicroBuffer(node: st.Node, fieldSchema: FieldSchema, value: []u8) !void {
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

// TODO This should be going away
pub fn getEdgePropType(
    db: *DbCtx,
    efc: EdgeFieldConstraint,
    ref: References.ReferenceLarge,
    fieldSchema: FieldSchema,
) []u8 {
    const edge_node = Node.getEdgeNode(db, efc, ref);
    if (edge_node == null) {
        return emptySlice;
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(
        edge_node,
        fieldSchema,
    );
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
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
    node: st.Node,
    efc: EdgeFieldConstraint,
    ref: References.ReferenceLarge,
    fieldSchema: FieldSchema,
) !*selva.selva_string {
    const edge_node = selva.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0, st.markDirtyCb, ctx) orelse return errors.SelvaError.SELVA_ENOTSUP;
    return selva.selva_fields_ensure_string(edge_node, fieldSchema, selva.HLL_INIT_SIZE) orelse return errors.SelvaError.SELVA_EINTYPE;
}

pub fn deleteField(ctx: *Modify.ModifyCtx, node: st.Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.db.selva, node, fieldSchema, st.markDirtyCb, ctx));
}

pub fn deleteTextFieldTranslation(ctx: *Modify.ModifyCtx, fieldSchema: FieldSchema, lang: t.LangCode) !void {
    return errors.selva(selva.selva_fields_set_text(ctx.node, fieldSchema, &selva.selva_fields_text_tl_empty[@intFromEnum(lang)], selva.SELVA_FIELDS_TEXT_TL_EMPTY_LEN));
}

pub fn getRefTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    return result;
}

pub fn deleteNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: st.Node) !void {
    selva.selva_del_node(ctx.db.selva, typeEntry, node, st.markDirtyCb, ctx);
}

pub fn flushNode(ctx: *Modify.ModifyCtx, typeEntry: Type, node: st.Node) void {
    selva.selva_flush_node(ctx.db.selva, typeEntry, node, st.markDirtyCb, ctx);
}

pub inline fn getNodeIdAsSlice(node: st.Node) []u8 {
    return @as([*]u8, @ptrCast(node))[0..4];
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

pub fn getAliasByName(typeEntry: Type, field: u8, aliasName: []u8) ?st.Node {
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
    node: st.Node,
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
    selva.selva_db_expire_tick(ctx.db.selva, st.markDirtyCb, ctx, std.time.timestamp());
}
