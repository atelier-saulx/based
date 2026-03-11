const std = @import("std");

pub fn main() !void {
    const raw = std.heap.raw_c_allocator;

    var timer = try std.time.Timer.start();
    
    // Test native raw_c_allocator
    var ptrs: [10000][]u8 = undefined;
    
    for (0..10000) |i| {
        ptrs[i] = try raw.alloc(u8, 4096);
    }
    const t_alloc1 = timer.lap();
    
    for (0..10000) |i| {
        raw.free(ptrs[i]);
    }
    const t_free1 = timer.lap();

    std.debug.print("raw_c_allocator alloc: {} ns\n", .{t_alloc1});
    std.debug.print("raw_c_allocator free: {} ns\n", .{t_free1});
}
