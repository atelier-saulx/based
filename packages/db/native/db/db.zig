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

const emptySlice = &.{};
const emptyArray: []const [16]u8 = emptySlice;

pub const DbCtx = struct {
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

pub fn createDbCtx() !*DbCtx {
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
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .decompressor = selva.libdeflate_alloc_decompressor().?,
        .libdeflate_block_state = selva.libdeflate_block_state_init(305000),
    };

    return b;
}

pub fn init() void {
    if (config.enable_debug) {
        valgrind_wrapper_instance = valgrind.ValgrindAllocator.init(base_allocator);
        db_backing_allocator = valgrind_wrapper_instance.allocator();
    } else {
        db_backing_allocator = base_allocator;
    }
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

pub fn getCardinalityField(node: Node, fieldSchema: FieldSchema) ?[]u8 {
    if (selva.selva_fields_get_selva_string(node, fieldSchema)) |stored| {
        const countDistinct = selva.hll_count(@ptrCast(stored));
        return countDistinct[0..4];
    } else {
        return null;
    }
}

pub fn getCardinalityReference(ref: *selva.SelvaNodeReference, fieldSchema: FieldSchema) []u8 {
    if (selva.selva_fields_get_selva_string3(ref, fieldSchema) orelse null) |stored| {
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
    }

    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, fieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn getTextField(ctx: *DbCtx, node: Node, fieldSchema: FieldSchema, lang: selva.selva_lang_code) !?*u8 {
    var len: usize = 0;
    var str: [len]u8 = undefined;
    errors.selva(selva.selva_fields_get_text(ctx.selva, node, fieldSchema, lang, &str, &len));
    return str;
}

pub inline fn getNodeFromReference(ref: ?*selva.SelvaNodeReference) ?Node {
    if (ref) |r| {
        return r.*.dst;
    }
    return null;
}

pub fn getSingleReference(ctx: *DbCtx, node: Node, fieldSchema: FieldSchema) ?*selva.SelvaNodeReference {
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

pub fn writeField(_: *DbCtx, data: []u8, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        node,
        fieldSchema,
        data.ptr,
        data.len,
    ));
}

pub fn writeReference(ctx: *modifyCtx.ModifyCtx, value: Node, src: Node, fieldSchema: FieldSchema) !?*selva.SelvaNodeReference {
    var ref: *selva.SelvaNodeReference = undefined;
    var dirty: [2]selva.node_id_t = undefined;
    errors.selva(selva.selva_fields_reference_set(
        ctx.db.selva,
        src,
        fieldSchema,
        value,
        @ptrCast(&ref),
        @ptrCast(&dirty),
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

    const efc = selva.selva_get_edge_field_constraint(fieldSchema);
    const dstType = efc.*.dst_node_type;
    if (dirty[0] != 0) {
        modifyCtx.markDirtyRange(ctx, dstType, dirty[0]);
    }
    if (dirty[1] != 0) {
        modifyCtx.markDirtyRange(ctx, ctx.typeId, dirty[1]);
    }
    modifyCtx.markDirtyRange(ctx, dstType, getNodeId(value));

    return ref;
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
pub fn insertReference(ctx: *modifyCtx.ModifyCtx, value: Node, target: Node, fieldSchema: FieldSchema, index: isize, reorder: bool) !*selva.SelvaNodeReference {
    // TODO Things can be optimized quite a bit if the type entry could be passed as an arg.
    const te_dst = selva.selva_get_type_by_node(ctx.db.selva, value);
    var ref: [*c]selva.SelvaNodeReference = undefined;
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
    ref: *selva.SelvaNodeReference,
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
    ctx: *modifyCtx.ModifyCtx,
    data: []u8,
    node: Node,
    efc: *const selva.EdgeFieldConstraint,
    ref: *selva.SelvaNodeReference,
    prop: u8,
) !void {
    try errors.selva(selva.selva_fields_set_reference_meta(
        ctx.db.selva,
        node,
        ref,
        efc,
        prop,
        data.ptr,
        data.len,
    ));
    if ((efc.flags & selva.EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP) == 0) {
        modifyCtx.markDirtyRange(ctx, ctx.typeId, ctx.id);
    } else if (ref.dst) |dst| {
        modifyCtx.markDirtyRange(ctx, efc.dst_node_type, getNodeId(dst));
    }
}

fn markDirtyCb(ctx: ?*anyopaque, typeId: u16, nodeId: u32) callconv(.C) void {
    const mctx: *modifyCtx.ModifyCtx = @ptrCast(@alignCast(ctx));
    modifyCtx.markDirtyRange(mctx, typeId, nodeId);
}

pub fn deleteField(ctx: *modifyCtx.ModifyCtx, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.db.selva, node, fieldSchema, markDirtyCb, ctx));
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
    fieldSchema: FieldSchema,
    fieldType: types.Prop,
    langCode: types.LangCode,
) []u8 {
    const data = getField(typeEntry, id, node, fieldSchema, fieldType);
    var iter = textIterator(data, langCode);
    while (iter.next()) |s| {
        return s;
    }
    return @as([*]u8, undefined)[0..0];
}

pub fn expire(ctx: *modifyCtx.ModifyCtx) void {
    // Expire things before query
    selva.selva_db_expire_tick(ctx.db.selva, markDirtyCb, ctx, std.time.timestamp());
}
