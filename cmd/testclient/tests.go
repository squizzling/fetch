package main

import (
	"context"
	"fmt"
	"io"
	"syscall/js"
	"time"

	"github.com/squizzling/fetch/pkg/fetch"
)

type TestFunc func(prefix string)

var tests = map[string]TestFunc{
	"Basic":  testBasicGet,
	"Cancel": testCancel,
}

func setResponse(prefix, message string) {
	js.Global().Get("document").Call("getElementById", prefix+"Response").Set("innerText", message)
}

func setError(prefix, message string) {
	js.Global().Get("document").Call("getElementById", prefix+"Error").Set("innerText", message)
}

func testBasicGet(prefix string) {
	resp, err := fetch.Do(context.Background(), &fetch.Request{
		URL:    "/respond",
		Method: "GET",
	})

	if err != nil {
		setError(prefix, fmt.Sprintf("fetch.Do: %v", err))
	} else {
		response, err := io.ReadAll(resp.Body)
		if err != nil {
			setError(prefix, fmt.Sprintf("io.ReadAll: %v", err))
		} else {
			setResponse(prefix, string(response))
		}
		_ = resp.Body.Close()
	}
}

func testCancel(prefix string) {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	resp, err := fetch.Do(ctx, &fetch.Request{
		URL:    "/sleep",
		Method: "GET",
	})

	if err != nil {
		if err != context.DeadlineExceeded {
			setError(prefix, fmt.Sprintf("fetch.Do: %v", err))
		} else {
			setResponse(prefix, "timed out ok")
		}
	} else {
		_, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		setError(prefix, "did not time out")
	}
}
