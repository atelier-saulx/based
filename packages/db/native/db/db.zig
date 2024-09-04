const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");

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
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.len + result.off];
}

pub fn deleteField(node: Node, selvaFieldSchema: FieldSchema) !void {
    try errors.selva(selva.selva_fields_del(ctx.selva, node, selvaFieldSchema));
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
