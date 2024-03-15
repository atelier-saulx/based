const std = @import("std");

// Although this function looks imperative, note that its job is to
// declaratively construct a build graph that will be executed by an external
// runner.
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // zig build-lib -dynamic -lc -isystem /usr/include/node example.zig -femit-bin=example.node

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = .{ .path = "src/lib.zig" },
        .target = target,
        .optimize = optimize,
    });

    const pkg = b.dependency("lmdb", .{});
    lib.root_module.addImport("lmdb", pkg.module("lmdb"));
    b.install(lib);
}
