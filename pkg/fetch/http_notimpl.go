//+build !wasm,!js

package fetch

import (
	"context"
)

func Do(ctx context.Context, req *Request) (*Response, error) { panic("not implemented") }
