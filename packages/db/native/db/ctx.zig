const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const c = @import("../c.zig");
const napi = @import("../napi.zig");
const SelvaError = @import("../errors.zig").SelvaError;
const subs = @import("./subscription/types.zig");
const threads = @import("./threads.zig");
const rand = std.crypto.random;

const ThreadCtx = struct {
    threadId: u64,
    decompressor: ?*selva.libdeflate_decompressor,
    libdeflateBlockState: selva.libdeflate_block_state,
};

pub fn getThreadId() u64 {
    return selva.selva_get_thread_id();
}

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    threadCtx: [42]ThreadCtx,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,
    subscriptions: subs.SubscriptionCtx,
    ids: []u32,
    queryCallback: *napi.NapiCallback,
    threads: *threads.Threads,
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

pub fn createDbCtx(env: c.napi_env, info: c.napi_callback_info) !*DbCtx {
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

    // const cb = try napi.NapiCallback.init(std.heap.raw_c_allocator, env, args[0]);
    // defer cb.deinit();
    // try cb.call(&.{});

    const args = try napi.getArgs(1, env, info);

    errdefer {
        arena.deinit();
        db_backing_allocator.destroy(arena);
    }

    b.* = .{
        .threads = try threads.Threads.init(allocator, 4, b),
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .threadCtx = undefined, //.{ .threadId = 0, .decompressor = null, .libdeflateBlockState = .{} } ** 42,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
        .subscriptions = subscriptions.*,
        .ids = &[_]u32{},
        .queryCallback = try napi.NapiCallback.init(allocator, env, args[0]),
    };

    for (&b.*.threadCtx) |*tctx| {
        tctx.* = .{ .threadId = 0, .decompressor = null, .libdeflateBlockState = undefined };
    }
    _ = createThreadCtx(b, getThreadId()) catch null;

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

    for (&ctx.threadCtx) |*tctx| {
        selva.libdeflate_block_state_deinit(&tctx.*.libdeflateBlockState);
        selva.libdeflate_free_decompressor(tctx.*.decompressor);
    }

    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();
}

pub fn createThreadCtx(ctx: *DbCtx, threadId: u64) !void {
    var set: bool = false;

    selva.membar_sync_read();
    for (&ctx.threadCtx) |*tctx| {
        if (tctx.*.threadId == 0) {
            tctx.* = .{
                .threadId = threadId,
                .decompressor = selva.libdeflate_alloc_decompressor().?, // never fails
                .libdeflateBlockState = selva.libdeflate_block_state_init(305000),
            };
            set = true;
            break;
        }
    }
    if (set == false) {
        return error.SELVA_ENOBUFS;
    }
    selva.membar_sync_write();
}

pub fn destroyThreadCtx(ctx: *DbCtx, threadId: u64) !void {
    selva.membar_sync_read();
    for (&ctx.threadCtx) |*tctx| {
        if (tctx.*.threadId == threadId) {
            selva.libdeflate_block_state_deinit(&tctx.*.libdeflateBlockState);
            selva.libdeflate_free_decompressor(tctx.*.decompressor);
            tctx.* = .{ .threadId = 0, .decompressor = null, .libdeflateBlockState = undefined };
            break;
        }
    }
    selva.membar_sync_write();
}

pub fn getThreadCtx(ctx: *DbCtx) !*ThreadCtx {
    const threadId = getThreadId();

    selva.membar_sync_read();
    for (&ctx.threadCtx) |*tctx| {
        if (tctx.*.threadId == threadId) {
            return tctx;
        }
    }

    return SelvaError.DB_NOT_CREATED;
}
