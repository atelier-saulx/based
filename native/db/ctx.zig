const std = @import("std");
const config = @import("config");
const selva = @import("../selva/selva.zig").c;
const deflate = @import("../deflate.zig");
const jemalloc = @import("../jemalloc.zig");
const valgrind = @import("../valgrind.zig");
const napi = @import("../napi.zig");
const SelvaError = @import("../errors.zig").SelvaError;
const jsBridge = @import("../thread/jsBridge.zig");
const threads = @import("../thread/thread.zig");
const sort = @import("../sort/sort.zig");
const t = @import("../types.zig");

const rand = std.crypto.random;

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: *selva.SelvaDb,
    ids: []t.NodeId,
    jsBridge: *jsBridge.Callback,
    fsPath: []u8,
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
    fsPath: []u8,
    nrThreads: u16,
    selvaDb: *selva.struct_SelvaDb,
) !*DbCtx {
    var arena = try db_backing_allocator.create(std.heap.ArenaAllocator);
    arena.* = std.heap.ArenaAllocator.init(db_backing_allocator);
    const allocator = arena.allocator();
    const dbCtxPointer = try allocator.create(DbCtx);
    const idsLen: usize = selva.selva_get_max_type(selvaDb);
    const ids = jemalloc.alloc(t.NodeId, idsLen);

    errdefer {
        arena.deinit();
        jemalloc.free(ids);
    }

    dbCtxPointer.* = .{
        .fsPath = try allocator.dupe(u8, fsPath),
        .threads = try threads.Threads.init(allocator, nrThreads, dbCtxPointer),
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = selvaDb,
        .ids = ids,
        .jsBridge = try jsBridge.Callback.init(env, dbCtxPointer, bridge),
        .decompressor = deflate.createDecompressor(),
        .libdeflateBlockState = deflate.initBlockState(305000),
    };

    return dbCtxPointer;
}

pub fn destroyDbCtx(ctx: *DbCtx) void {
    ctx.initialized = false;
    ctx.jsBridge.deinit();
    ctx.threads.deinit();

    sort.deinit(&ctx.sortIndexes);

    if (ctx.ids.len > 0) {
        jemalloc.free(ctx.ids);
        ctx.ids = &[_]u32{};
    }

    deflate.destroyDecompressor(ctx.decompressor);
    deflate.deinitBlockState(&ctx.libdeflateBlockState);

    selva.selva_db_destroy(ctx.selva);
    ctx.arena.deinit();
}
