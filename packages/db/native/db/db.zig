const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const readInt = @import("../utils.zig").readInt;
const types = @import("../types.zig");

pub const TypeId = u16;
pub const Node = *selva.SelvaNode;
pub const Aliases = *selva.SelvaAliases;
pub const Type = *selva.SelvaTypeEntry;
pub const FieldSchema = *const selva.SelvaFieldSchema;
pub const EdgeFieldConstraint = *const selva.EdgeFieldConstraint;

var globalAllocatorArena = std.heap.ArenaAllocator.init(std.heap.raw_c_allocator);
const globalAllocator = globalAllocatorArena.allocator();

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,
    decompressor: *selva.libdeflate_decompressor,
    libdeflate_block_state: selva.libdeflate_block_state,
};

pub var dbHashmap = std.AutoHashMap(u32, *DbCtx).init(globalAllocator);

pub fn workerCtxInit() void {
    // TODO Return external and add deinit call
    selva.worker_ctx_init();
}

pub fn createDbCtx(id: u32) !*DbCtx {
    // If you want any var to persist out of the stack you have to do this (including an allocator)
    var arena = try globalAllocator.create(std.heap.ArenaAllocator);
    arena.* = std.heap.ArenaAllocator.init(globalAllocator);
    const allocator = arena.allocator();
    const b = try allocator.create(DbCtx);

    b.* = .{
        .id = 0,
        .arena = arena.*,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .decompressor = selva.libdeflate_alloc_decompressor().?,
        .libdeflate_block_state = selva.libdeflate_block_state_init(305000),
    };

    // var fba = std.heap.FixedBufferAllocator.init(&buffer);
    // const allocator = fba.allocator();

    // var buffer: [1000]u8 = undefined;
    // var fba = std.heap.FixedBufferAllocator.init(&buffer);
    try dbHashmap.put(id, b);
    return b;
}

var lastQueryId: u32 = 0;
pub fn getQueryId() u32 {
    lastQueryId += 1;
    if (lastQueryId > 4_000_000_000_000) {
        lastQueryId = 0;
    }
    return lastQueryId;
}

pub fn getType(ctx: *DbCtx, typePrefix: TypeId) !Type {
    // make fn getSelvaTypeIndex
    const selvaTypeEntry: ?*selva.SelvaTypeEntry = selva.selva_get_type_by_index(
        ctx.selva.?,
        typePrefix,
    );

    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }

    return selvaTypeEntry.?;
}

pub fn getFieldSchema(field: u8, typeEntry: ?Type) !FieldSchema {
    const s: ?*const selva.SelvaFieldSchema = selva.selva_get_fs_by_ns_field(
        selva.selva_get_ns_by_te(typeEntry.?),
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getFieldSchemaFromEdge(field: u8, typeEntry: ?Type) !FieldSchema {
    const s: ?*const selva.SelvaFieldSchema = selva.selva_get_fs_by_ns_field(
        selva.selva_get_ns_by_te(typeEntry.?),
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getField(typeEntry: ?Type, id: u32, node: Node, selvaFieldSchema: FieldSchema) []u8 {
    const fieldType: types.Prop = @enumFromInt(selvaFieldSchema.type);
    if (fieldType == types.Prop.ALIAS) {
        const target = if (id == 0) getNodeId(node) else id;
        const typeAliases = selva.selva_get_aliases(typeEntry, selvaFieldSchema.field);
        const alias = selva.selva_get_alias_by_dest(typeAliases, target);
        if (alias == null) {
            return @as([*]u8, undefined)[0..0];
        }
        // const alias = selva.selva_get_next_alias(aliasIterator);
        var len: usize = 0;
        const res = selva.selva_get_alias_name(alias, &len);
        return @as([*]u8, @constCast(res))[0..len];
    }
    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, selvaFieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.off + result.len];
}

pub fn setTextField(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, lang: [4]u8, str: *u8) !void {
    errors.selva(selva.selva_fields_set_text(ctx.selva, node, selvaFieldSchema, lang.ptr, str.ptr, str.len));
}

pub fn getTextField(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, lang: [4]u8) !?*u8 {
    var len: usize = 0;
    var str: [len]u8 = undefined;
    errors.selva(selva.selva_fields_get_text(ctx.selva, node, selvaFieldSchema, lang.ptr, &str, &len));
    return str;
}

pub fn getReference(node: Node, field: u8) ?Node {
    const result = selva.selva_fields_get_reference(node, field);
    if (result == null) {
        return null;
    }
    return result.?.*.dst;
}

pub fn getSingleReference(node: Node, field: u8) ?*selva.SelvaNodeReference {
    const result = selva.selva_fields_get_reference(node, field);
    return result;
}

pub fn getReferences(node: Node, field: u8) ?*selva.SelvaNodeReferences {
    const result = selva.selva_fields_get_references(node, field);
    return result;
}

pub fn clearReferences(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema) void {
    selva.selva_fields_clear_references(ctx.selva, node, selvaFieldSchema);
}

pub fn deleteReference(ctx: *DbCtx, node: Node, selvaFieldSchema: FieldSchema, id: u32) !void {
    try errors.selva(selva.selva_fields_del_ref(
        ctx.selva,
        node,
        selvaFieldSchema.field,
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

pub fn writeReference(ctx: *DbCtx, value: Node, target: Node, fieldSchema: FieldSchema) !?*selva.SelvaNodeReference {
    var ref: *selva.SelvaNodeReference = undefined;
    try errors.selva(selva.selva_fields_reference_set(
        ctx.selva,
        target,
        fieldSchema,
        value,
        @ptrCast(&ref),
    ));
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
        return &.{};
    }
}

pub fn getEdgeFieldSchema(edgeConstaint: *const selva.EdgeFieldConstraint, field: u8) !FieldSchema {
    const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
        edgeConstaint.*.fields_schema,
        field - 1,
    );
    if (edgeFieldSchema == null) {
        return errors.SelvaError.SELVA_NO_EDGE_FIELDSCHEMA;
    }
    return edgeFieldSchema;
}

pub fn getEdgeReferences(
    ref: *selva.SelvaNodeReference,
    field: u8,
) ?selva.SelvaNodeWeakReferences {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_references(
            ref.meta,
            field - 1,
        );
    }
    return null;
}

pub fn resolveEdgeReference(ctx: *DbCtx, fieldSchema: FieldSchema, ref: *selva.SelvaNodeWeakReference) ?Node {
    return selva.selva_fields_resolve_weak_reference(ctx.selva, fieldSchema, ref);
}

pub fn getEdgeReference(
    ref: *selva.SelvaNodeReference,
    field: u8,
) ?selva.SelvaNodeWeakReference {
    if (ref.meta != null) {
        return selva.selva_fields_get_weak_reference(
            ref.meta,
            field - 1,
        );
    }
    return null;
}

pub fn writeEdgeProp(
    data: []u8,
    node: Node,
    efc: *const selva.EdgeFieldConstraint,
    ref: *selva.SelvaNodeReference,
    field: u8,
) !void {
    try errors.selva(selva.selva_fields_set_reference_meta(
        node,
        ref,
        efc,
        field - 1,
        data.ptr,
        data.len,
    ));
}

pub fn deleteField(ctx: *DbCtx, typeEntry: Type, id: u32, node: Node, selvaFieldSchema: FieldSchema) !void {
    const fieldType: types.Prop = @enumFromInt(selvaFieldSchema.type);
    if (fieldType == types.Prop.ALIAS) {
        const typeAliases = selva.selva_get_aliases(typeEntry, selvaFieldSchema.field);
        selva.selva_del_alias_by_dest(typeAliases, if (id == 0) getNodeId(node) else id);
    } else {
        try errors.selva(selva.selva_fields_del(ctx.selva, node, selvaFieldSchema));
    }
}

pub fn getTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
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
    return selva.selva_get_node_id(node);
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

pub fn getNodeRangeHash(typeEntry: Type, start: u32, end: u32) selva.SelvaHash128 {
    return selva.selva_node_hash_range(typeEntry, start, end);
}

pub fn setAlias(id: u32, field: u8, aliasName: []u8, typeEntry: Type) !void {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    selva.selva_set_alias(typeAliases, id, aliasName.ptr, aliasName.len);
}

pub fn delAliasByName(typeEntry: Type, field: u8, aliasName: []u8) !void {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    try errors.selva(selva.selva_del_alias_by_name(typeAliases, aliasName.ptr, aliasName.len));
}

pub fn getAliasByName(typeEntry: Type, field: u8, aliasName: []u8) ?Node {
    const typeAliases = selva.selva_get_aliases(typeEntry, field);
    return selva.selva_get_alias(typeEntry, typeAliases, aliasName.ptr, aliasName.len);
}
