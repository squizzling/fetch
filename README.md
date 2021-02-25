## What
This project essentially rips out the key parts of net/http/roundtrip_js.go and puts
them in a dedicated package with a slightly different API.

## Why
The purpose of this is a much reduced http client for webassembly.  By switching from
net/http to this, the resulting wasm file was approximately 4.2MB smaller.  Probably
because it no longer included an entire TLS stack, along with http 1 and 2 client and
servers.

## Tests
Tests can be run by running `make test && ./testsvr` and opening a browser to port 9997.

As a non-web developer, I do not have the skill set to properly validate that all fetch
behavior works as expected, so the only tests are "can it get" and "can it cancel".

## License
Parts of this code are based on the original wasm based round tripper, and the reader
implementations are copied directly from the original, and put in their own file.  I
have zero interest in understanding what this means the license needs to be, but
probably the same as the go language itself?
