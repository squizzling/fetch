package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/squizzling/fetch/static"
)

func main() {
	var mux http.ServeMux

	mux.Handle("/respond", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("Start regular request\n")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
		fmt.Printf("Stop regular request\n")
	}))

	mux.Handle("/sleep", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("Start 10s sleep\n")
		time.Sleep(10 * time.Second)
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
		fmt.Printf("Stop 10s sleep\n")
	}))

	mux.Handle("/", http.FileServer(http.FS(static.Files)))

	if err := http.ListenAndServe(":9997", http.HandlerFunc(mux.ServeHTTP)); err != nil {
		panic(err)
	}
}
