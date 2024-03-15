const std = @import("std");

// Although this function looks imperative, note that its job is to
// declaratively construct a build graph that will be executed by an external
// runner.
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        // the name of your project
        .name = "based-db-zig",
        // your main function
        .root_source_file = .{ .path = "src/main.zig" },
        // references the ones you declared above
        .target = target,
        .optimize = optimize,
    });

    const pkg = b.dependency("lmdb", .{});
    exe.root_module.addImport("lmdb", pkg.module("lmdb"));

    b.installArtifact(exe);

    const run_exe = b.addRunArtifact(exe);

    const run_step = b.step("run", "Run it!");
    run_step.dependOn(&run_exe.step);
}
