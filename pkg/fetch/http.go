// +build wasm,js

package fetch

import (
	"context"
	"errors"
	"fmt"
	"io"
	"syscall/js"
)

var ErrFetchNotAvailable = errors.New("fetch api not available")

var fetchApiUnavailable = js.Global().Get("fetch").IsUndefined()

var jstAbortController = js.Global().Get("AbortController")
var jstObject = js.Global().Get("Object")
var jstUint8Array = js.Global().Get("Uint8Array")

type Request struct {
	URL            string
	Method         string
	Headers        Headers
	Body           string // TBD
	Mode           string // cors, no-cors, same-origin
	Credentials    string // omit, same-origin, include
	Cache          string // default, no-store, reload, no-cache, force-cache, only-if-cached
	Redirect       string // follow, error, manual
	Referrer       string
	ReferrerPolicy string // no-referrer, no-referrer-when-downgrade, same-origin, origin, strict-origin, origin-when-cross-origin, strict-origin-when-cross-origin, unsafe-url
	Integrity      string
	KeepAlive      bool
}

type Response struct {
	StatusCode int
	Headers    Headers
	Body       io.ReadCloser
}

func setIfPresent(jsObject js.Value, k, v string) {
	if v != "" {
		jsObject.Set(k, v)
	}
}

func newAbortController() js.Value {
	if !jstAbortController.IsUndefined() {
		return jstAbortController.New()
	}
	return js.Undefined()
}

func makeBodyReader(jsResponse js.Value) io.ReadCloser {
	var body io.ReadCloser
	if jsBody := jsResponse.Get("body"); jsBody.IsUndefined() || jsBody.IsNull() {
		body = &arrayReader{arrayPromise: jsResponse.Call("arrayBuffer")}
	} else {
		body = &streamReader{stream: jsBody.Call("getReader")}
	}
	return body
}

func Do(ctx context.Context, req *Request) (*Response, error) {
	if fetchApiUnavailable {
		return nil, ErrFetchNotAvailable
	}

	jsOpts := jstObject.New()
	setIfPresent(jsOpts, "method", req.Method)
	setIfPresent(jsOpts, "credentials", req.Credentials)
	setIfPresent(jsOpts, "mode", req.Mode)
	setIfPresent(jsOpts, "redirect", req.Redirect)
	setIfPresent(jsOpts, "cache", req.Cache)
	setIfPresent(jsOpts, "referrerPolicy", req.ReferrerPolicy)
	setIfPresent(jsOpts, "referrer", req.Referrer)
	setIfPresent(jsOpts, "integrity", req.Integrity)
	jsOpts.Set("keepalive", req.KeepAlive)
	jsOpts.Set("headers", req.Headers.asJS())

	jsAbortController := newAbortController()
	if !jsAbortController.IsUndefined() {
		jsOpts.Set("signal", jsAbortController.Get("signal"))
	}

	if req.Body != "" {
		jsReqBodyBuffer := jstUint8Array.New(len(req.Body))
		js.CopyBytesToJS(jsReqBodyBuffer, []byte(req.Body))
		jsOpts.Set("body", jsReqBodyBuffer)
	}

	jsFetchPromise := js.Global().Call("fetch", req.URL, jsOpts)
	chResp := make(chan *Response, 1)
	chErr := make(chan error, 1)
	jsfSuccess := js.FuncOf(func(jsThis js.Value, jsArgs []js.Value) interface{} {
		jsResponse := jsArgs[0]
		chResp <- &Response{
			StatusCode: jsResponse.Get("status").Int(),
			Headers:    headersFromJS(jsResponse.Get("headers")),
			Body:       makeBodyReader(jsResponse),
		}
		return nil
	})
	jsfFailure := js.FuncOf(func(jsThis js.Value, jsArgs []js.Value) interface{} {
		chErr <- fmt.Errorf("fetch() failed: %s", jsArgs[0].Get("message").String())
		return nil
	})
	jsFetchPromise.Call("then", jsfSuccess, jsfFailure)

	defer jsfSuccess.Release()
	defer jsfFailure.Release()

	select {
	case <-ctx.Done():
		if !jsAbortController.IsUndefined() {
			jsAbortController.Call("abort")
		}
		return nil, ctx.Err()
	case resp := <-chResp:
		return resp, nil
	case err := <-chErr:
		return nil, err
	}
}

