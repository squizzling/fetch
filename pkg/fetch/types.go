package fetch

import (
	"io"
)

type Headers map[string]string

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
