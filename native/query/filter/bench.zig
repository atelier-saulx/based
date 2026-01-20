const std = @import("std");
const fixed = @import("fixed.zig");
const types = @import("../../types.zig");

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    const rnd = std.crypto.random;

    // Test parameters
    const N_VALUES = 1_000_000;
    _ = N_VALUES; // unused
    const T = u32;

    // Create query buffer `q`
    // Layout: [len: u16] [values: T * len]
    // We want a large array to test SIMD
    const len: u32 = 4;

    // Create many values to cycle through to simulate cold cache reads
    const num_nodes = 100_000;
    const values_memory = try allocator.alloc(u8, num_nodes * @sizeOf(T));
    defer allocator.free(values_memory);
    rnd.bytes(values_memory);

    // Ensure we don't accidentally match everything or nothing (set first value)
    std.mem.bytesAsSlice(T, values_memory)[0] = 123456789;

    const buffer_size = @sizeOf(u32) + @sizeOf(T) * len + 128; // strict size + padding for alignment
    const q = try allocator.alloc(u8, buffer_size);
    defer allocator.free(q);

    // Fill with random data
    rnd.bytes(q);

    // Setup `q` with explicit correct values for testing
    // Write len at offset 0 (u32)
    std.mem.writeInt(u32, q[0..4], len, .little);

    const condition = types.FilterCondition{
        .op = .eqU32Batch,
        .prop = 0,
        .alignOffset = 0,
        .start = 0, // offset in value buffer
    };

    var i: usize = 0;

    // Warmup
    i = 0;
    _ = try fixed.eqBatch(T, q, &i, &condition, values_memory[0..4]);

    const runs = 1_000_000_000;
    var timer = try std.time.Timer.start();
    var found_count: usize = 0;

    const start: u64 = timer.read();

    for (0..runs) |r| {
        i = 0; // Reset buffer pointer
        const offset = (r % num_nodes) * @sizeOf(T);
        const val_ptr = values_memory[offset..][0..4];

        if (try fixed.eqBatch(T, q, &i, &condition, val_ptr)) {
            found_count += 1;
        }
    }

    const end = timer.read();
    const elapsed = end - start;
    const avg_ns = elapsed / runs;

    std.debug.print("Runs: {d}\n", .{runs});
    std.debug.print("Elements per run (vector search size): {d}\n", .{len});
    std.debug.print("Total items checked: {d}\n", .{@as(u64, runs) * @as(u64, len)});
    std.debug.print("Total time: {d} ms\n", .{elapsed / 1_000_000});
    std.debug.print("Avg time per call: {d} ns\n", .{avg_ns});
    std.debug.print("Throughput: {d:.2} million items/sec\n", .{@as(f64, @floatFromInt(runs * @as(usize, len))) / @as(f64, @floatFromInt(elapsed)) * 1000.0});
    std.debug.print("Found: {d}\n", .{found_count});
}
