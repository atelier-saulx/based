libdeflate
==========

This is not the famous libdeflate but a fork of it adapted for selvad.
The main difference to the original is the addition of new streaming
block by block decompression API and removal of MSVC and WIN32 support.
Gone are also the zlib and gzip formats and only raw DEFLATE is supported.
