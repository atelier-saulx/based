const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const enable_debug = b.option(bool, "enable_debug", "Enable debugging prints") orelse false;

    const options = b.addOptions();
    options.addOption(bool, "enable_debug", enable_debug);

    const opt: std.builtin.OptimizeMode = switch (enable_debug) {
        true => .Debug,
        false => .ReleaseFast,
    };

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "based_db_zig",
        .root_module = b.createModule(.{
            .root_source_file = b.path("native/lib.zig"),
            .target = target,
            .optimize = opt,
            .link_libc = true,
        }),
    });

    lib.linker_allow_shlib_undefined = true;

    lib.root_module.addOptions("config", options);

    const node_hpath = b.option([]const u8, "node_hpath", "Path to the Node.js headers") orelse "deps/node/include/node/";
    lib.addIncludePath(b.path(node_hpath));

    const rpath = b.option([]const u8, "rpath", "run-time search path") orelse "@loader_path";
    const lib_selva_path = b.option([]const u8, "libselvapath", "Path to the Selva Library") orelse "packages/db/dist/lib";
    const headers_selva_path = b.option([]const u8, "headersselvapath", "Path to the Selva Headers") orelse "packages/db/dist/lib/include";

    lib.root_module.addRPathSpecial(rpath);

    lib.addIncludePath(b.path(headers_selva_path));
    lib.addLibraryPath(b.path(lib_selva_path));
    lib.linkSystemLibrary("selva");

    lib.linkLibC();

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = "./lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
}
