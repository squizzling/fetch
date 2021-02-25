// +build wasm,js

package fetch

import (
	"syscall/js"
)

var jstHeaders = js.Global().Get("Headers")

type Headers map[string]string

func (h Headers) asJS() js.Value {
	jsHeaders := jstHeaders.New()
	for k, v := range h {
		jsHeaders.Call("append", k, v)
	}
	return jsHeaders
}

func headersFromJS(jsHeaders js.Value) Headers {
	headers := make(Headers)
	respHeadersIterator := jsHeaders.Call("entries")
	for {
		next := respHeadersIterator.Call("next")
		if next.Get("done").Bool() {
			break
		}
		jsKeyValue := next.Get("value")
		jsKey := jsKeyValue.Index(0).String()
		jsValue := jsKeyValue.Index(1).String()
		headers[jsKey] = jsValue
	}
	return headers
}
