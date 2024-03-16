const std = @import("std");

// Although this function looks imperative, note that its job is to
// declaratively construct a build graph that will be executed by an external
// runner.
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    // const optimize = b.standardOptimizeOption(.{});

    // b.addIm("lmdb", .{ .root_source_file = .{ .path = "deps/lmdb" } });

    // zig build-lib -dynamic -lc -isystem /usr/include/node example.zig -femit-bin=example.node

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = .{ .path = "src/lib.zig" },
        .target = target,
        .optimize = .ReleaseSmall,
        .link_libc = true,
    });

    lib.linker_allow_shlib_undefined = true;

    lib.addSystemIncludePath(.{ .path = "deps/node-v20.11.1/include/node/" });

    // const pkg = b.dependency("lmdb", .{});
    // lib.root_module.addImport("lmdb", pkg.module("lmdb"));

    lib.linkLibC();

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = "dist/lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(lib);
}
