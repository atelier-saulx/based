const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");

pub const TypeId = [2]u8;

pub const Indexes = std.AutoHashMap(sort.SortDbiName, sort.SortIndex);

pub const StartSet = std.AutoHashMap(u16, u8);

pub const DbCtx = struct {
    initialized: bool,
    allocator: std.mem.Allocator,
    readTxn: *c.MDB_txn,
    readTxnCreated: bool,
    env: ?*c.MDB_env,
    sortIndexes: Indexes,
    mainSortIndexes: std.AutoHashMap([2]u8, *StartSet),
    readOnly: bool,
    selva: ?*selva.SelvaDb,
};

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const allocator = arena.allocator();
const sortIndexes = Indexes.init(allocator);
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

// SELVA WRAPPERS
pub fn getSelvaTypeEntry(typePrefix: [2]u8) !*selva.SelvaTypeEntry {
    // make fn getSelvaTypeIndex
    const selvaTypeEntry: ?*selva.SelvaTypeEntry = selva.selva_get_type_by_index(
        ctx.selva.?,
        @bitCast(typePrefix),
    );

    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }

    return selvaTypeEntry.?;
}

pub fn selvaGetFieldSchema(field: u8, typeEntry: ?*selva.SelvaTypeEntry) !*selva.SelvaFieldSchema {
    const s: ?*selva.SelvaFieldSchema = selva.selva_get_fs_by_ns_field(
        selva.selva_get_ns_by_te(typeEntry.?),
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn selvaGetField(node: *selva.SelvaNode, selvaFieldSchema: *selva.SelvaFieldSchema) []u8 {
    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, selvaFieldSchema);

    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.len + result.off];
}

pub fn selvaWriteField(d: []u8, selvaNode: *selva.SelvaNode, selvaFieldSchema: *selva.SelvaFieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        selvaNode,
        selvaFieldSchema,
        d.ptr,
        d.len,
    ));
}

pub fn selvaDeleteNode(selvaNode: *selva.SelvaNode, typeEntry: ?*selva.SelvaTypeEntry) !void {
    selva.selva_del_node(
        ctx.selva,
        typeEntry,
        selvaNode,
    );
}
