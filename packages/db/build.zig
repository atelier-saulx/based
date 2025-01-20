const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = b.path("native/lib.zig"),
        .target = target,
        .optimize = .ReleaseFast,
        .link_libc = true,
    });
    lib.linker_allow_shlib_undefined = true;

    const node_hpath = b.option([]const u8, "node_hpath", "Path to the Node.js headers") orelse "deps/node/include/node/";

    lib.addIncludePath(b.path(node_hpath));

    // Build selva
    //const make_clibs = b.addSystemCommand(
    //    &[_][]const u8{
    //        "make",
    //        "-C",
    //        "./clibs",
    //    },
    //);
    //b.getInstallStep().dependOn(&make_clibs.step);

    const lib_selva_path = b.option([]const u8, "libselvapath", "Path to the Selva Library") orelse "packages/db/dist/lib";
    const headers_selva_path = b.option([]const u8, "headersselvapath", "Path to the Selva Headers") orelse "packages/db/dist/lib/include";

    lib.addIncludePath(b.path(headers_selva_path));
    lib.addLibraryPath(b.path(lib_selva_path));
    // TODO Linux rpath
    lib.root_module.addRPathSpecial("@loader_path");
    lib.linkSystemLibrary("selva");

    lib.linkLibC();

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = "./lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(lib);
}
