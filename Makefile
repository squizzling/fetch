test:
	GOOS=js GOARCH=wasm go build -o static/app.wasm ./cmd/testclient/
	go build -o testsvr ./cmd/testsvr/
