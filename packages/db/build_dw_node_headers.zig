const std = @import("std");
const Child = std.process.Child;

pub fn download_node_headers(version: []const u8) !void {
    const allocator = std.heap.page_allocator;
    var stdout = std.io.getStdOut().writer();
    var cwd = std.fs.cwd();

    const headers_url = try construct_headers_url(allocator, version);
    defer allocator.free(headers_url);

    try cwd.deleteTree("deps");
    try cwd.makeDir("deps");

    const tarball_name = std.fs.path.basename(headers_url);
    const headers_tarball = try std.fmt.allocPrint(allocator, "deps/{s}", .{tarball_name});

    try stdout.print("Downloading {s}...\n", .{headers_url});
    const proc = try Child.run(.{ .argv = &[_][]const u8{ "sh", "-c", "command -v wget > /dev/null" }, .allocator = allocator });
    const has_wget = proc.term.Exited == 0;

    if (has_wget) {
        const wget_argv = &[_][]const u8{
            "wget",
            "--quiet",
            "--show-progress",
            try std.fmt.allocPrint(allocator, "--output-document={s}", .{headers_tarball}),
            headers_url,
        };
        const wget_proc = try Child.run(.{ .argv = wget_argv, .allocator = allocator });
        if (wget_proc.term.Exited != 0) {
            try stdout.print("Failed to download {s} with wget.\n", .{headers_url});
            return;
        }
    } else {
        const curl_argv = &[_][]const u8{
            "curl",
            "--silent",
            "--progress-bar",
            "--output",
            headers_tarball,
            headers_url,
        };
        const curl_proc = try Child.run(.{ .argv = curl_argv, .allocator = allocator });
        if (curl_proc.term.Exited != 0) {
            try stdout.print("Failed to download {s} with curl.\n", .{headers_url});
            return;
        }
    }

    try stdout.print("Extracting {s}...\n", .{headers_tarball});
    const extract_proc = try Child.run(.{
        .argv = &[_][]const u8{
            "tar",
            "-xzf",
            headers_tarball,
            "-C",
            "deps",
        },
        .allocator = allocator,
    });
    if (extract_proc.term.Exited != 0) {
        try stdout.print("Extracting tarball {s} failed.\n", .{headers_tarball});
        return;
    }

    try stdout.print("Removing tarball...\n", .{});
    try cwd.deleteFile(headers_tarball);
}

fn construct_headers_url(allocator: std.mem.Allocator, version: []const u8) ![]const u8 {
    return try std.fmt.allocPrint(allocator, "https://nodejs.org/dist/{s}/node-{s}-headers.tar.gz", .{ version, version });
}

// You can run this program with `zig run build_dw_node_headers.zig -- v20.18.1`
pub fn main() !void {
    const args = try std.process.argsAlloc(std.heap.page_allocator);
    defer std.process.argsFree(std.heap.page_allocator, args);

    if (args.len < 2) {
        const stdout = std.io.getStdOut().writer();
        const exe_name = std.fs.path.basename(args[0]);
        try stdout.print("Usage: {s} <node_version>\n", .{exe_name});
        return;
    }

    const node_version = args[1];
    try download_node_headers(node_version);
}
