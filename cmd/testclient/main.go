package main

import (
	"sync"
)

func main() {
	var wg sync.WaitGroup
	wg.Add(len(tests))
	for k, v := range tests {
		go func(prefix string, fn TestFunc) {
			fn(prefix)
			wg.Done()
		}(k, v)
	}
	wg.Wait()
}
