const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const utils = @import("../utils.zig");
const types = @import("../types.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");

const read = utils.read;

pub const TypeId = u16;
pub const Node = *selva.SelvaNode;
pub const Aliases = *selva.SelvaAliases;
pub const Type = *selva.SelvaTypeEntry;
pub const FieldSchema = *const selva.SelvaFieldSchema;
pub const EdgeFieldConstraint = *const selva.EdgeFieldConstraint;

const base_allocator = std.heap.raw_c_allocator;
var db_backing_allocator: std.mem.Allocator = undefined;
var valgrind_wrapper_instance: valgrind.ValgrindAllocator = undefined; // this exists in the final program memory :(

pub var dbHashmap: std.AutoHashMap(u32, *DbCtx) = undefined;

const emptySlice = &.{};
const emptyArray: []const [16]u8 = emptySlice;

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,
    decompressor: *selva.libdeflate_decompressor,
    libdeflate_block_state: selva.libdeflate_block_state,

    pub fn deinit(self: *DbCtx, backing_allocator: std.mem.Allocator) void {
        self.arena.deinit();
        backing_allocator.destroy(self.arena);
    }
};

pub fn createDbCtx(id: u32) !*DbCtx {
    // If you want any var to persist out of the stack you have to do this (including an allocator)
    var arena = try db_backing_allocator.create(std.heap.ArenaAllocator);
    errdefer db_backing_allocator.destroy(arena);
    arena.* = std.heap.ArenaAllocator.init(db_backing_allocator);
    const allocator = arena.allocator();

    const b = try allocator.create(DbCtx);
    errdefer {
        arena.deinit();
        db_backing_allocator.destroy(arena);
    }

    b.* = .{
        .id = 0,
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .decompressor = selva.libdeflate_alloc_decompressor().?,
        .libdeflate_block_state = selva.libdeflate_block_state_init(305000),
    };

    try dbHashmap.put(id, b);

    return b;
}

pub fn init() void {
    if (config.enable_debug) {
        valgrind_wrapper_instance = valgrind.ValgrindAllocator.init(base_allocator);
        db_backing_allocator = valgrind_wrapper_instance.allocator();
    } else {
        db_backing_allocator = base_allocator;
    }
    dbHashmap = std.AutoHashMap(u32, *DbCtx).init(db_backing_allocator);
}

var lastQueryId: u32 = 0;
pub fn getQueryId() u32 {
    lastQueryId += 1;
    if (lastQueryId > 4_000_000_000) {
        lastQueryId = 0;
    }
    return lastQueryId;
}

pub fn getType(ctx: *DbCtx, typeId: TypeId) !Type {
    // make fn getSelvaTypeIndex
    const selvaTypeEntry: ?*selva.SelvaTypeEntry = selva.selva_get_type_by_index(
        ctx.selva.?,
        typeId,
    );

    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }

    return selvaTypeEntry.?;
}

pub fn getFieldSchema(field: u8, typeEntry: ?Type) !FieldSchema {
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

pub fn getCardinalityField(node: Node, selvaFieldSchema: FieldSchema) ?[]u8 {
    if (selva.selva_fields_get_selva_string(node, selvaFieldSchema)) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return null;
    }
}

pub fn getCardinalityReference(ref: *selva.SelvaNodeReference, selvaFieldSchema: FieldSchema) []u8 {
    if (selva.selva_fields_get_selva_string3(ref, selvaFieldSchema) orelse null) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return emptySlice;
    }
}

pub fn getCardinalityReferenceOrCreate(
    db: *selva.SelvaDb,
    node: Node,
    edgeConstraint: EdgeFieldConstraint,
    ref: *selva.SelvaNodeReference,
    selvaFieldSchema: FieldSchema,
) []u8 {
    if (selva.selva_fields_get_selva_string3(ref, selvaFieldSchema)) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        const newCardinality = selva.selva_fields_ensure_string2(db, node, edgeConstraint, ref, selvaFieldSchema, selva.HLL_INIT_SIZE);
        selva.hll_init(newCardinality, 14, true);
        const countDistinct = selva.hll_count(@ptrCast(newCardinality));
        return countDistinct[0..4];
    }
}

pub fn getField(
    typeEntry: ?Type,
    id: u32,
    node: Node,
    selvaFieldSchema: FieldSchema,
    fieldType: types.Prop,
) []u8 {
    if (fieldType == types.Prop.ALIAS) {
        const target = if (id == 0) getNodeId(node) else id;
        const typeAliases = selva.selva_get_aliases(typeEntry, selvaFieldSchema.field);
        const alias = selva.selva_get_alias_by_dest(typeAliases, target);
        if (alias == null) {
            return @as([*]u8, undefined)[0..0];
        }
        var len: usize = 0;
        const res = selva.selva_get_alias_name(alias, &len);
        return @as([*]u8, @constCast(res))[0..len];
    } else if (fieldType == types.Prop.CARDINALITY) {
        return getCardinalityField(node, selvaFieldSchema) orelse emptySlice;
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, selvaFieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn setTextField(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, lang: selva.selva_lang_code, str: *u8) !void {
    errors.selva(selva.selva_fields_set_text(ctx.selva, node, selvaFieldSchema, lang, str.ptr, str.len));
}

pub fn getTextField(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, lang: selva.selva_lang_code) !?*u8 {
    var len: usize = 0;
    var str: [len]u8 = undefined;
    errors.selva(selva.selva_fields_get_text(ctx.selva, node, selvaFieldSchema, lang, &str, &len));
    return str;
}

pub fn getReference(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) ?Node {
    const result = selva.selva_fields_get_reference(ctx.selva, node, selvaFieldSchema);
    if (result) |r| {
        return r.*.dst;
    }
    return null;
}

pub fn getSingleReference(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) ?*selva.SelvaNodeReference {
    const result = selva.selva_fields_get_reference(ctx.selva, node, selvaFieldSchema);
    return result;
}

pub fn getReferences(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) ?*selva.SelvaNodeReferences {
    const result = selva.selva_fields_get_references(ctx.selva, node, selvaFieldSchema);
    return result;
}

pub fn clearReferences(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) void {
    selva.selva_fields_clear_references(ctx.selva, node, selvaFieldSchema);
}

pub fn deleteReference(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, id: u32) !void {
    try errors.selva(selva.selva_fields_del_ref(
        ctx.selva,
        node,
        selvaFieldSchema,
        id,
    ));
}

pub fn writeField(ctx: *DbCtx, data: []u8, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        node,
        fieldSchema,
        data.ptr,
        data.len,
    ));
}

pub fn writeReference(ctx: *DbCtx, value: Node, src: Node, fieldSchema: FieldSchema) !?*selva.SelvaNodeReference {
    var ref: *selva.SelvaNodeReference = undefined;
    errors.selva(selva.selva_fields_reference_set(
        ctx.selva,
        src,
        fieldSchema,
        value,
        @ptrCast(&ref),
    )) catch |err| {
        // REMOVE THIS
        if (err == errors.SelvaError.SELVA_EEXIST) {
            const result = selva.selva_fields_get_reference(ctx.selva, src, fieldSchema);
            if (result == null) {
                return err;
            }

            std.debug.print("HERE?????? \n", .{});
            // does it get here ever?
            return result;
        } else {
            return err;
        }
    };

    return ref;
}

pub fn writeReferences(ctx: *DbCtx, value: []Node, target: Node, fieldSchema: FieldSchema) !void {
    // selva_fields_references_insert() is slightly more optimized than this for insertions to
    // a `references` field but does it really make a difference?
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        target,
        fieldSchema,
        @ptrCast(value.ptr),
        value.len * 8, // ptr len
    ));
}

pub fn putReferences(ctx: *DbCtx, ids: []u32, target: Node, fieldSchema: FieldSchema, typeEntry: Type) !void {
    try errors.selva(selva.selva_fields_references_insert_tail_wupsert(
        ctx.selva,
        target,
        fieldSchema,
        typeEntry,
        ids.ptr,
        ids.len,
    ));
}

// @param index 0 = first; -1 = last.
pub fn insertReference(ctx: *DbCtx, value: Node, target: Node, fieldSchema: FieldSchema, index: isize, reorder: bool) !*selva.SelvaNodeReference {
    // TODO Things can be optimized quite a bit if the type entry could be passed as an arg.
    const te_dst = selva.selva_get_type_by_node(ctx.selva, value);
    var ref: [*c]selva.SelvaNodeReference = undefined;
    const code = selva.selva_fields_references_insert(
        ctx.selva,
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
    ref: *selva.SelvaNodeReference,
    selvaFieldSchema: FieldSchema,
) []u8 {
    if (ref.meta != null) {
        const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw2(
            ref.meta,
            selvaFieldSchema,
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
    ctx: *DbCtx,
    ref: *selva.SelvaNodeReference,
    field: u8,
) ?selva.SelvaNodeWeakReferences {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_references(
            ctx.selva,
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
    ctx: *DbCtx,
    ref: *selva.SelvaNodeReference,
    field: u8,
) ?selva.SelvaNodeWeakReference {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_reference(
            ctx.selva,
            ref.meta,
            field,
        );
    }
    return null;
}

pub fn writeEdgeProp(
    ctx: *DbCtx,
    data: []u8,
    node: Node,
    efc: *const selva.EdgeFieldConstraint,
    ref: *selva.SelvaNodeReference,
    prop: u8,
) !void {
    try errors.selva(selva.selva_fields_set_reference_meta(
        ctx.selva,
        node,
        ref,
        efc,
        prop,
        data.ptr,
        data.len,
    ));
}

pub fn deleteField(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.selva, node, selvaFieldSchema));
}

pub fn getRefTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    return result;
}

pub fn deleteNode(ctx: *DbCtx, typeEntry: Type, node: Node) !void {
    selva.selva_del_node(ctx.selva, typeEntry, node);
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

pub inline fn getNodeId(node: Node) u32 {
    // return read(u32, @as([*]u8, @ptrCast(node))[0..4], 0);
    // return selva.selva_get_node_id(node);
    return @bitCast(@as([*]u8, @ptrCast(node))[0..4].*);
}

pub fn getNodeIdArray(node: Node) [4]u8 {
    const x: [4]u8 = @bitCast(selva.selva_get_node_id(node));
    return x;
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

pub const TextIterator = struct {
    value: []const [16]u8,
    index: usize = 0,
    code: types.LangCode,
    fn _next(self: *TextIterator) ?[]u8 {
        if (self.index == self.value.len) {
            return null;
        }
        const tl = self.value[self.index];
        const ss: *const selva.selva_string = @ptrCast(&tl);
        var len: usize = undefined;
        const str: [*]const u8 = selva.selva_string_to_buf(ss, &len);
        const s = @as([*]u8, @constCast(str));
        self.index += 1;
        return s[0..len];
    }
    fn _lang(self: *TextIterator) ?[]u8 {
        while (self._next()) |s| {
            if (s[0] == @intFromEnum(self.code)) {
                return s;
            }
        }
        return null;
    }
    pub fn next(self: *TextIterator) ?[]u8 {
        // TODO fix with comptime...
        if (self.code == types.LangCode.NONE) {
            return self._next();
        } else {
            return self._lang();
        }
    }
};

pub inline fn textIterator(value: []u8, code: types.LangCode) TextIterator {
    if (value.len == 0) {
        return TextIterator{ .value = emptyArray, .code = code };
    }
    const textTmp: *[*]const [selva.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
    const text = textTmp.*[0..value[8]];
    return TextIterator{ .value = text, .code = code };
}

pub inline fn getText(
    typeEntry: ?Type,
    id: u32,
    node: Node,
    selvaFieldSchema: FieldSchema,
    fieldType: types.Prop,
    langCode: types.LangCode,
) []u8 {
    const data = getField(typeEntry, id, node, selvaFieldSchema, fieldType);
    var iter = textIterator(data, langCode);
    var found = false;
    while (iter.next()) |s| {
        found = true;
        return s;
    }
    return @as([*]u8, undefined)[0..0];
}
