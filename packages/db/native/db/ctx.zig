const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const c = @import("../c.zig");

const rand = std.crypto.random;

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,

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

pub fn createDbCtx() !*DbCtx {
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
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
    };
    return b;
}

pub fn workerCtxDeinit(_: c.napi_env, _: ?*anyopaque, _: ?*anyopaque) callconv(.C) void {
    selva.worker_ctx_deinit();
}

pub fn workerCtxInit(env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    var result: c.napi_value = undefined;
    _ = c.napi_create_external(env, null, workerCtxDeinit, null, &result);
    selva.worker_ctx_init();
    return result;
}
