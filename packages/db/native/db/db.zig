const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const readInt = @import("../utils.zig").readInt;

pub const TypeId = u16;

pub const StartSet = std.AutoHashMap(u16, u8);

pub const Node = *selva.SelvaNode;

pub const Type = *selva.SelvaTypeEntry;

pub const FieldSchema = *selva.SelvaFieldSchema;

pub const DbCtx = struct {
    initialized: bool,
    allocator: std.mem.Allocator,
    readTxn: *c.MDB_txn,
    readTxnCreated: bool,
    env: ?*c.MDB_env,
    sortIndexes: sort.Indexes,
    mainSortIndexes: std.AutoHashMap([2]u8, *StartSet),
    readOnly: bool,
    selva: ?*selva.SelvaDb,
};

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const allocator = arena.allocator();
const sortIndexes = sort.Indexes.init(allocator);
const mainSortIndexes = std.AutoHashMap([2]u8, *StartSet).init(allocator);

pub var ctx: DbCtx = .{
    .allocator = allocator,
    .readTxn = undefined,
    .env = undefined,
    .sortIndexes = sortIndexes,
    .mainSortIndexes = mainSortIndexes,
    .readTxnCreated = false,
    .initialized = false,
    .readOnly = false,
    .selva = null,
};

var lastQueryId: u32 = 0;
pub fn getQueryId() u32 {
    lastQueryId += 1;
    if (lastQueryId > 4_000_000_000_000) {
        lastQueryId = 0;
    }
    return lastQueryId;
}

pub fn getType(typePrefix: TypeId) !Type {
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
    const s: ?*selva.SelvaFieldSchema = selva.selva_get_fs_by_ns_field(
        selva.selva_get_ns_by_te(typeEntry.?),
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn getField(node: Node, selvaFieldSchema: FieldSchema) []u8 {
    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, selvaFieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off..result.len];
}

pub fn getReference(node: Node, field: u8) ?Node {
    const result = selva.selva_fields_get_reference(node, field);
    if (result == null) {
        return null;
    }
    return result.?.*.dst;
}

pub fn getReferences(node: Node, field: u8) ?*selva.SelvaNodeReferences {
    // make this return []SelvaNode or iterator over references
    return selva.selva_fields_get_references(node, field);
}

pub fn deleteField(node: Node, selvaFieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.selva, node, selvaFieldSchema));
}

pub fn clearReferences(node: Node, selvaFieldSchema: FieldSchema) void {
    selva.selva_fields_clear_references(ctx.selva, node, selvaFieldSchema);
}

pub fn writeField(data: []u8, node: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        node,
        fieldSchema,
        data.ptr,
        data.len,
    ));
}

pub fn writeReference(value: Node, target: Node, fieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        target,
        fieldSchema,
        value,
        8, // TODO use system bullshit
    ));
}

pub fn writeReferences(value: []Node, target: Node, fieldSchema: FieldSchema) !void {
    // selva_fields_references_insert() is slightly more optimized than this for insertions to
    // a `references` field but does it really make a difference?
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        target,
        fieldSchema,
        @ptrCast(value.ptr),
        value.len * 8, // TODO use system bullshit
    ));
}

// @param index 0 = first; -1 = last.
pub fn insertReference(
    value: Node,
    target: Node,
    fieldSchema: FieldSchema,
    index: selva.user_ssize_t,
) !*selva.SelvaNodeReference {
    // TODO Things can be optimized quite a bit if the type entry could be passed as an arg.
    const te_dst = selva.selva_get_type_by_node(ctx.selva, value);
    var ref: [*c]selva.SelvaNodeReference = undefined;

    try errors.selva(selva.selva_fields_references_insert(ctx.selva, target, fieldSchema, index, te_dst, value, &ref));
    return ref;
}

pub fn moveReference(node: Node, fieldSchema: FieldSchema, index_old: selva.user_ssize_t, index_new: selva.user_ssize_t) !void {
    try errors.selva(selva.selva_fields_references_move(node, fieldSchema, index_old, index_new));
}

pub fn swapReference(node: Node, fieldSchema: FieldSchema, index_a: selva.user_ssize_t, index_b: selva.user_ssize_t) !void {
    try errors.selva(selva.selva_fields_references_swap(node, fieldSchema, index_a, index_b));
}

pub fn getEdgeProp(ref: selva.SelvaNodeReference, selvaFieldSchema: FieldSchema) ?[]u8 {
    if (ref.meta) {
        return null;
    } else {
        const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw2(ref.meta, selvaFieldSchema);
        return @as([*]u8, @ptrCast(result.ptr))[result.off..result.len];
    }
}

pub fn writeEdgeProp(data: []u8, node: Node, efc: *selva.EdgeFieldConstraint, ref: *selva.SelvaNodeReference, field: u8) !void {
    try errors.selva(selva.selva_fields_set_reference_meta(node, ref, efc, field, data.ptr, data.len));
}

pub fn getTypeIdFromFieldSchema(fieldSchema: FieldSchema) u16 {
    const result = selva.selva_get_edge_field_constraint(fieldSchema).*.dst_node_type;
    // if (result == null) {
    //     return errors.SelvaError.SELVA_CANNOT_UPSERT;
    // }
    return result;
}

pub fn deleteNode(node: Node, typeEntry: Type) !void {
    selva.selva_del_node(
        ctx.selva,
        typeEntry,
        node,
    );
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

pub fn getNodeId(node: Node) u32 {
    return selva.selva_get_node_id(node);
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

pub fn setAlias(typeEntry: Type, dest: Node, aliasName: [*]u8) void {
    selva.selva_set_alias(typeEntry, dest, aliasName.ptr, aliasName.len);
}

pub fn delAliasByName(typeEntry: Type, aliasName: [*]u8) !void {
    try errors.selva(selva.selva_del_alias_by_name(typeEntry, aliasName.ptr, aliasName.len));
}

pub fn getAliasByName(typeEntry: Type, aliasName: [*]u8) ?Node {
    return selva.selva_get_alias(typeEntry, aliasName.ptr, aliasName.len);
}

pub fn insertSort(
    sortCtx: *selva.SelvaSortCtx,
    node: Node,
    sortFieldType: u8,
    value: []u8,
    start: u16,
    len: u16,
) void {
    if (sortFieldType == 1) {
        selva.selva_sort_insert_i64(sortCtx, readInt(i64, value, start), node);
        return;
    }

    if (sortFieldType == 11) {
        if (start > 0 and len > 0) {
            selva.selva_sort_insert_buf(sortCtx, value[start .. start + len].ptr, value.len, node);
        } else {
            selva.selva_sort_insert_buf(sortCtx, value.ptr, value.len, node);
        }
        return;
    }

    if (sortFieldType == 4) {
        selva.selva_sort_insert_double(sortCtx, @floatFromInt(readInt(u64, value, start)), node);
        return;
    }

    if (sortFieldType == 5) {
        selva.selva_sort_insert_i64(sortCtx, @intCast(readInt(u32, value, start)), node);
        return;
    }
    if (sortFieldType == 10) {
        selva.selva_sort_insert_i64(sortCtx, @intCast(value[start]), node);
        return;
    }
}

pub fn getSortFlag(sortFieldType: u8, asc: bool) !selva.SelvaSortOrder {
    switch (sortFieldType) {
        1 => {
            if (asc) {
                return selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        5 => {
            if (asc) {
                return selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        10 => {
            if (asc) {
                return selva.SELVA_SORT_ORDER_I64_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_I64_ASC;
            }
        },
        4 => {
            if (asc) {
                return selva.SELVA_SORT_ORDER_DOUBLE_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_DOUBLE_ASC;
            }
        },
        11 => {
            if (asc) {
                return selva.SELVA_SORT_ORDER_BUFFER_DESC;
            } else {
                return selva.SELVA_SORT_ORDER_BUFFER_ASC;
            }
        },
        else => {
            return errors.DbError.WRONG_SORTFIELD_TYPE;
        },
    }
}
