const std = @import("std");
const download = @import("build_dw_node_headers.zig");

pub fn build(b: *std.Build) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const node_versions = [_][]const u8{ "v23.6.0", "v22.13.0", "v20.18.1" };

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
    lib.addSystemIncludePath(b.path(try std.fmt.allocPrint(allocator, "{s}/include/", .{output_dir})));
    lib.addLibraryPath(b.path(output_dir));

    // Build selva
    //const make_clibs = b.addSystemCommand(
    //    &[_][]const u8{
    //        "make",
    //        "-C",
    //        "./clibs",
    //    },
    //);
    //b.getInstallStep().dependOn(&make_clibs.step);
    // TODO Linux rpath
    lib.root_module.addRPathSpecial("@loader_path");
    lib.linkSystemLibrary("selva");

    lib.linkLibC();

    for (node_versions) |version| {
        download.download_node_headers(version) catch |err| {
            std.debug.print("Failed downloading node headers for version {s}: {}\n", .{ version, err });
            return;
        };

        lib.addSystemIncludePath(b.path(try std.fmt.allocPrint(allocator, "deps/node-{s}/include/node/", .{version})));

        const lib_name = try std.fmt.allocPrint(allocator, "./lib_node-{s}.node", .{version});

        var install_lib = b.addInstallArtifact(lib, .{ .dest_dir = .{
            .override = .{ .custom = output_dir },
        }, .dest_sub_path = lib_name });

        b.getInstallStep().dependOn(&install_lib.step);
        b.installArtifact(lib);
    }
}
