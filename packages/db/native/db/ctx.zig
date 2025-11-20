const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig").c;
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const napi = @import("../napi.zig");
const SelvaError = @import("../errors.zig").SelvaError;
const subs = @import("./subscription/types.zig");
const threads = @import("./threads.zig");
const rand = std.crypto.random;
const deflate = @import("./decompress.zig");

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,
    subscriptions: subs.SubscriptionCtx,
    ids: []u32,
    queryCallback: *napi.Callback,
    threads: *threads.Threads,
    decompressor: *deflate.LibdeflateDecompressor,
    libdeflateBlockState: deflate.LibdeflateBlockState,
    pub fn deinit(self: *DbCtx, backing_allocator: std.mem.Allocator) void {
        self.arena.deinit();
        backing_allocator.destroy(self.arena);
    }
};

const base_allocator = std.heap.raw_c_allocator;
var db_backing_allocator: std.mem.Allocator = undefined;
var valgrind_wrapper_instance: valgrind.ValgrindAllocator = undefined; // this exists in the final program memory :(

pub fn init() void {
    if (config.enable_debug) {
        // do a check here...
        valgrind_wrapper_instance = valgrind.ValgrindAllocator.init(base_allocator);
        db_backing_allocator = valgrind_wrapper_instance.allocator();
    } else {
        db_backing_allocator = base_allocator;
    }
}

pub fn createDbCtx(queryCallback: *napi.Callback) !*DbCtx {
    var arena = try db_backing_allocator.create(std.heap.ArenaAllocator);
    errdefer db_backing_allocator.destroy(arena);
    arena.* = std.heap.ArenaAllocator.init(db_backing_allocator);
    const allocator = arena.allocator();
    const b = try allocator.create(DbCtx);
    const subscriptions = try allocator.create(subs.SubscriptionCtx);
    subscriptions.*.types = subs.TypeSubMap.init(allocator);

    subscriptions.*.lastIdMarked = 0;
    subscriptions.*.singleIdMarked = try std.heap.raw_c_allocator.alloc(
        *subs.IdSubsItem,
        subs.BLOCK_SIZE,
    );

    errdefer {
        arena.deinit();
        db_backing_allocator.destroy(arena);
    }

    b.* = .{
        .threads = try threads.Threads.init(allocator, try std.Thread.getCpuCount() - 1, b),
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .subscriptions = subscriptions.*,
        .ids = &[_]u32{},
        .queryCallback = queryCallback,
        .decompressor = selva.libdeflate_alloc_decompressor().?, // never fails
        .libdeflateBlockState = selva.libdeflate_block_state_init(305000),
    };

    return b;
}

pub fn destroyDbCtx(ctx: *DbCtx) void {
    ctx.initialized = false;
    ctx.queryCallback.deinit();
    ctx.threads.deinit();

    var it = ctx.sortIndexes.iterator();
    while (it.next()) |index| {
        var mainIt = index.value_ptr.*.main.iterator();
        while (mainIt.next()) |main| {
            selva.selva_sort_destroy(main.value_ptr.*.index);
        }
        var fieldIt = index.value_ptr.*.field.iterator();
        while (fieldIt.next()) |field| {
            selva.selva_sort_destroy(field.value_ptr.*.index);
        }
    }

    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();
}
