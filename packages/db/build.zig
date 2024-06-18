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

    const dep2 = b.dependency("zstd", .{ .create = true });

    lib.addIncludePath(dep2.path("lib/compress"));
    lib.addCSourceFile(.{ .file = dep2.path("lib/compress/zstd_fast.c") });

    lib.linkLibC();

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = "./lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(lib);
}
