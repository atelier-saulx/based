const std = @import("std");
const download = @import("build_dw_node_headers.zig");

pub fn build(b: *std.Build) void {
    download.download_node_headers("v20.11.1") catch |err| {
        std.debug.print("Fail dowloading node headers: {}\n", .{err});
        return;
    };

    const target = b.standardTargetOptions(.{});

    const base_dir = "../dist/lib/";
    const output_dir = switch (target.result.cpu.arch) {
        .x86_64 => switch (target.result.os.tag) {
            .linux => base_dir ++ "linux_x86_64",
            .macos => base_dir ++ "darwin_x86_64",
            else => "unknown_os",
        },
        .aarch64 => switch (target.result.os.tag) {
            .linux => base_dir ++ "linux_aarch64",
            .macos => base_dir ++ "darwin_arm64",
            else => "unknown_os",
        },
        else => "unknown_os",
    };

    if (std.mem.eql(u8, output_dir, "unknown_os")) {
        std.debug.print("Unknown, unsupported OS\n", .{});
        return;
    }

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = b.path("native/lib.zig"),
        .target = target,
        .optimize = .ReleaseSmall,
        .link_libc = true,
    });

    lib.linker_allow_shlib_undefined = true;

    lib.addSystemIncludePath(b.path("deps/node-v20.11.1/include/node/"));

    // Build selva
    //const make_clibs = b.addSystemCommand(
    //    &[_][]const u8{
    //        "make",
    //        "-C",
    //        "./clibs",
    //    },
    //);
    //b.getInstallStep().dependOn(&make_clibs.step);
    lib.addIncludePath(b.path("dist/lib/darwin_arm64/include/"));
    lib.addLibraryPath(b.path("dist/lib/darwin_arm64"));
    // TODO Linux rpath
    lib.root_module.addRPathSpecial("@loader_path");
    lib.linkSystemLibrary("selva");

    lib.linkLibC();

    std.debug.print("is {any}\n", .{output_dir});

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_dir = .{
            .override = .{ .custom = output_dir },
        },
        .dest_sub_path = "./lib.node",
    });

    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(lib);
}
