const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = .{ .path = "native/lib.zig" },
        .target = target,
        .optimize = .ReleaseSmall,
        .link_libc = true,
    });

    lib.linker_allow_shlib_undefined = true;

    lib.addSystemIncludePath(.{ .path = "deps/node-v20.11.1/include/node/" });

    const dep = b.dependency("lmdb", .{ .create = true });

    lib.addIncludePath(dep.path("libraries/liblmdb"));
    lib.addCSourceFile(.{ .file = dep.path("libraries/liblmdb/mdb.c") });
    lib.addCSourceFile(.{ .file = dep.path("libraries/liblmdb/midl.c") });

    lib.linkLibC();

    const make_clibs = b.addSystemCommand(
        &[_][]const u8{
            "make",
            "-C",
            "./clibs",
        },
    );
    b.getInstallStep().dependOn(&make_clibs.step);

    lib.addIncludePath(b.path("clibs/include"));
    lib.addLibraryPath(b.path("zig-out/lib"));
    // TODO Linux rpath
    lib.root_module.addRPathSpecial("@loader_path");
    lib.linkSystemLibrary("util");
    lib.linkSystemLibrary("selva");

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = "./lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(lib);
}
