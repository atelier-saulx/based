const std = @import("std");
const download = @import("build_dw_node_headers.zig");

pub fn build(b: *std.Build) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const node_versions = [_][]const u8{ "v20.11.1", "v22.13.0" };

    const target = b.standardTargetOptions(.{});

    const base_dir = "../dist/lib/";
    const install_dir = switch (target.result.cpu.arch) {
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
    const output_dir = install_dir[3..];

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

    lib.addLibraryPath(b.path(output_dir));

    // Add include path for build
    lib.addIncludePath(b.path(try std.fmt.allocPrint(allocator, "{s}/include/", .{output_dir})));
    lib.addLibraryPath(b.path(output_dir));

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

        // Yes! that is uggly as hell but apparently zig expects that .dest_sub_path to be a pre-generated static string.
        // Since there is no better solution for that, we will just hardcode the values here.
        // TODO this code will be ported to TS to avoid this kind of problem.
        const dest_sub_path = if (std.mem.eql(u8, version, "v20.11.1")) "lib_node-v20.11.1.node" else if (std.mem.eql(u8, version, "v22.13.0")) "lib_node-v22.13.0.node" else return error.InvalidNodeVersion;

        std.debug.print("Building {s}...\n", .{dest_sub_path});

        var install_lib = b.addInstallArtifact(lib, .{
            .dest_dir = .{
                .override = .{ .custom = install_dir },
            },
            .dest_sub_path = dest_sub_path,
        });

        b.getInstallStep().dependOn(&install_lib.step);
        b.installArtifact(lib);
    }
    std.debug.print("Done.\n", .{});
}
