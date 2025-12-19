const std = @import("std");
const config = @import("config");
const selva = @import("../selva/selva.zig").c;
const deflate = @import("../deflate.zig");
const jemalloc = @import("../jemalloc.zig");
const valgrind = @import("../valgrind.zig");
const napi = @import("../napi.zig");
const SelvaError = @import("../errors.zig").SelvaError;
const Subscription = @import("subscription/common.zig");
const jsBridge = @import("../thread/jsBridge.zig");
const threads = @import("../thread/thread.zig");
const sort = @import("../sort/sort.zig");

const rand = std.crypto.random;

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,
    subscriptions: Subscription.SubscriptionCtx,
    ids: []u32,
    jsBridge: *jsBridge.Callback,
    threads: *threads.Threads,
    decompressor: *deflate.Decompressor,
    libdeflateBlockState: deflate.BlockState,
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

pub fn createDbCtx(
    env: napi.Env,
    bridge: napi.Value,
    nrThreads: u16,
) !*DbCtx {
    var arena = try db_backing_allocator.create(std.heap.ArenaAllocator);
    arena.* = std.heap.ArenaAllocator.init(db_backing_allocator);
    const allocator = arena.allocator();
    const dbCtxPointer = try allocator.create(DbCtx);
    const subscriptions = try allocator.create(Subscription.SubscriptionCtx);
    subscriptions.*.types = Subscription.TypeSubMap.init(allocator);

    subscriptions.*.gpa = std.heap.GeneralPurposeAllocator(.{}){};
    subscriptions.*.allocator = subscriptions.*.gpa.allocator();
    subscriptions.*.freeList = try Subscription.FreeList.initCapacity(subscriptions.*.allocator, 0);

    subscriptions.*.lastIdMarked = 0;
    subscriptions.*.singleIdMarked = jemalloc.alloc(*Subscription.IdSubsItem, Subscription.BLOCK_SIZE);

    errdefer {
        arena.deinit();
    }

    // config thread amount
    dbCtxPointer.* = .{
        .threads = try threads.Threads.init(allocator, nrThreads, dbCtxPointer),
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .subscriptions = subscriptions.*,
        .ids = &[_]u32{},
        .jsBridge = try jsBridge.Callback.init(env, dbCtxPointer, bridge),
        // Also per thread this is just for when on the main thread
        .decompressor = deflate.createDecompressor(),
        .libdeflateBlockState = deflate.initBlockState(305000),
    };

    return dbCtxPointer;
}

pub fn destroyDbCtx(ctx: *DbCtx) void {
    ctx.initialized = false;
    ctx.jsBridge.deinit();
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

    if (ctx.ids.len > 0) {
        ctx.allocator.free(ctx.ids);
        ctx.ids = &[_]u32{};
    }

    jemalloc.free(ctx.subscriptions.singleIdMarked);
    _ = ctx.subscriptions.gpa.deinit();
    deflate.destroyDecompressor(ctx.decompressor);
    deflate.deinitBlockState(&ctx.libdeflateBlockState);

    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();
}
