const std = @import("std");
const t = @import("../types.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("selva.zig");
const Schema = @import("schema.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const Node = @import("node.zig");
const References = @import("references.zig");
const Modify = @import("../modify/common.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const Aliases = selva.Aliases;

const emptySlice = &.{};
const emptyArray: []const [16]u8 = emptySlice;

extern "c" const selva_string: opaque {};

pub fn getCardinality(node: Node.Node, fieldSchema: Schema.FieldSchema) ?[]u8 {
    if (selva.c.selva_fields_get_selva_string(node, fieldSchema)) |stored| {
        const countDistinct = selva.c.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return null;
    }
}

pub fn getCardinalityReference(ctx: *DbCtx, efc: Schema.EdgeFieldConstraint, ref: References.ReferenceLarge, fieldSchema: Schema.FieldSchema) []u8 {
    const edge_node = Node.getEdgeNode(ctx, efc, ref);
    if (edge_node == null) {
        return emptySlice;
    }

    if (selva.c.selva_fields_get_selva_string(edge_node, fieldSchema) orelse null) |stored| {
        const countDistinct = selva.c.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return emptySlice;
    }
}

pub fn get(
    typeEntry: ?Node.Type,
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
    propType: t.PropType,
) []u8 {
    if (propType == t.PropType.alias) {
        const target = Node.getNodeId(node);
        const typeAliases = selva.c.selva_get_aliases(typeEntry, fieldSchema.field);
        const alias = selva.c.selva_get_alias_by_dest(typeAliases, target);
        if (alias == null) {
            return @as([*]u8, undefined)[0..0];
        }
        var len: usize = 0;
        const res = selva.c.selva_get_alias_name(alias, &len);
        return @as([*]u8, @constCast(res))[0..len];
    } else if (propType == t.PropType.cardinality) {
        return getCardinality(node, fieldSchema) orelse emptySlice;
    } else if (propType == t.PropType.colVec) {
        const nodeId = Node.getNodeId(node);
        const vec = selva.c.colvec_get_vec(typeEntry, nodeId, fieldSchema);
        const len = fieldSchema.*.unnamed_0.colvec.vec_len * fieldSchema.*.unnamed_0.colvec.comp_size;
        return @as([*]u8, @ptrCast(vec))[0..len];
    } else {
        const result: selva.c.SelvaFieldsPointer = selva.c.selva_fields_get_raw(node, fieldSchema);
        return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
    }
}

pub inline fn getRaw(
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
) []u8 {
    const result: selva.c.SelvaFieldsPointer = selva.c.selva_fields_get_raw(node, fieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn set(node: Node.Node, fieldSchema: Schema.FieldSchema, data: []u8) !void {
    try errors.selva(switch (fieldSchema.*.type) {
        selva.c.SELVA_FIELD_TYPE_MICRO_BUFFER => selva.c.selva_fields_set_micro_buffer(node, fieldSchema, data.ptr, data.len),
        selva.c.SELVA_FIELD_TYPE_STRING => selva.c.selva_fields_set_string(node, fieldSchema, data.ptr, data.len),
        selva.c.SELVA_FIELD_TYPE_TEXT => selva.c.selva_fields_set_text(node, fieldSchema, data.ptr, data.len),
        else => selva.c.SELVA_EINTYPE,
    });
}

pub inline fn setText(node: Node.Node, fieldSchema: Schema.FieldSchema, str: []u8) !void {
    try errors.selva(selva.c.selva_fields_set_text(
        node,
        fieldSchema,
        str.ptr,
        str.len,
    ));
}

pub inline fn setMicroBuffer(node: Node.Node, fieldSchema: Schema.FieldSchema, value: []u8) !void {
    try errors.selva(selva.c.selva_fields_set_micro_buffer(
        node,
        fieldSchema,
        value.ptr,
        value.len,
    ));
}

pub inline fn setColvec(te: Node.Type, nodeId: selva.c.node_id_t, fieldSchema: Schema.FieldSchema, vec: []u8) void {
    selva.c.colvec_set_vec(
        te,
        nodeId,
        fieldSchema,
        vec.ptr,
    );
}

// TODO This is now hll specific but we might want to change it.
pub fn ensurePropTypeString(
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
) !*selva.c.selva_string {
    return selva.c.selva_fields_ensure_string(node, fieldSchema, selva.c.HLL_INIT_SIZE) orelse errors.SelvaError.SELVA_EINTYPE;
}

pub fn ensureEdgePropTypeString(
    ctx: *Modify.ModifyCtx,
    node: Node.Node,
    efc: Schema.EdgeFieldConstraint,
    ref: References.ReferenceLarge,
    fieldSchema: Schema.FieldSchema,
) !*selva.c.selva_string {
    const edge_node = selva.c.selva_fields_ensure_ref_edge(ctx.db.selva, node, efc, ref, 0) orelse return errors.SelvaError.SELVA_ENOTSUP;
    return selva.c.selva_fields_ensure_string(edge_node, fieldSchema, selva.c.HLL_INIT_SIZE) orelse return errors.SelvaError.SELVA_EINTYPE;
}

pub inline fn deleteField(ctx: *Modify.ModifyCtx, node: Node.Node, fieldSchema: Schema.FieldSchema) !void {
    try errors.selva(selva.c.selva_fields_del(ctx.db.selva, node, fieldSchema));
}

pub inline fn deleteTextFieldTranslation(ctx: *Modify.ModifyCtx, fieldSchema: Schema.FieldSchema, lang: t.LangCode) !void {
    return errors.selva(selva.c.selva_fields_set_text(ctx.node, fieldSchema, &selva.c.selva_fields_text_tl_empty[@intFromEnum(lang)], selva.c.SELVA_FIELDS_TEXT_TL_EMPTY_LEN));
}

pub inline fn textFromValueFallback(
    value: []u8,
    code: t.LangCode,
    fallback: t.LangCode,
) []u8 {
    if (value.len == 0) {
        return value;
    }
    var hasFallback: bool = false;
    var lastFallbackValue: []u8 = undefined;
    var index: usize = 0;
    const textTmp: *[*]const [selva.c.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    while (index < text.len) {
        var len: usize = undefined;
        const str: [*]const u8 = selva.c.selva_string_to_buf(@ptrCast(&text[index]), &len);
        const s = @as([*]u8, @constCast(str));
        const langCode: t.LangCode = @enumFromInt(s[0]);
        if (langCode == code) {
            return s[0..len];
        }
        if (!hasFallback and langCode == fallback) {
            hasFallback = true;
            lastFallbackValue = s[0..len];
        }
        index += 1;
    }
    if (hasFallback) {
        return lastFallbackValue;
    }
    return @as([*]u8, undefined)[0..0];
}

pub inline fn textFromValueFallbacks(
    value: []u8,
    code: t.LangCode,
    fallbacks: []t.LangCode,
) []u8 {
    if (value.len == 0) {
        return value;
    }
    var lastFallbackValue: []u8 = undefined;
    var lastFallbackIndex: usize = fallbacks.len;
    var index: usize = 0;
    const textTmp: *[*]const [selva.c.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    while (index < text.len) {
        var len: usize = undefined;
        const str: [*]const u8 = selva.c.selva_string_to_buf(@ptrCast(&text[index]), &len);
        const s = @as([*]u8, @constCast(str));
        const langCode: t.LangCode = @enumFromInt(s[0]);
        if (langCode == code) {
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

pub inline fn textFromValue(value: []u8, code: t.LangCode) []u8 {
    if (value.len == 0) {
        return value;
    }
    var index: usize = 0;
    const langInt = @intFromEnum(code);
    const textTmp: *[*]const [selva.c.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    while (index < text.len) {
        var len: usize = undefined;
        const str: [*]const u8 = selva.c.selva_string_to_buf(@ptrCast(&text[index]), &len);
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
    value: []const [selva.c.SELVA_STRING_STRUCT_SIZE]u8,
    index: usize = 0,
    fn _next(self: *TextIterator) ?[]u8 {
        if (self.index == self.value.len) {
            return null;
        }
        var len: usize = undefined;
        const str: [*]const u8 = selva.c.selva_string_to_buf(@ptrCast(&self.value[self.index]), &len);
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
    const textTmp: *[*]const [selva.c.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    return TextIterator{ .value = textTmp.*[0..value[8]] };
}

pub inline fn getText(
    typeEntry: ?Node.Type,
    node: Node.Node,
    fieldSchema: Schema.FieldSchema,
    fieldType: t.PropType,
    langCode: t.LangCode,
) []u8 {
    // fallbacks
    const data = get(typeEntry, node, fieldSchema, fieldType);
    return textFromValue(data, langCode);
}

pub fn setAlias(typeEntry: Node.Type, id: u32, field: u8, aliasName: []u8) !u32 {
    const typeAliases = selva.c.selva_get_aliases(typeEntry, field);
    const old_dest = selva.c.selva_set_alias(typeAliases, id, aliasName.ptr, aliasName.len);
    return old_dest;
}

pub fn delAliasByName(typeEntry: Node.Type, field: u8, aliasName: []u8) !u32 {
    const typeAliases = selva.c.selva_get_aliases(typeEntry, field);
    const old_dest = selva.c.selva_del_alias_by_name(typeAliases, aliasName.ptr, aliasName.len);

    if (old_dest == 0) {
        return errors.SelvaError.SELVA_ENOENT;
    }

    return old_dest;
}

pub fn delAlias(typeEntry: Node.Type, node_id: selva.c.node_id_t, field: u8) !void {
    const aliases = selva.c.selva_get_aliases(typeEntry, field);
    if (aliases != null) {
        selva.c.selva_del_alias_by_dest(aliases, node_id);
    }
}

pub fn getAliasByName(typeEntry: Node.Type, field: u8, aliasName: []u8) ?Node.Node {
    const typeAliases = selva.c.selva_get_aliases(typeEntry, field);
    const res = selva.c.selva_get_alias(typeEntry, typeAliases, aliasName.ptr, aliasName.len);
    // TODO Partials
    return res.node;
}
