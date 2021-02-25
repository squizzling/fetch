// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

(() => {
	if (typeof global !== "undefined") {}
	else if (typeof window !== "undefined") {window.global = window;}
	else if (typeof self !== "undefined") {self.global = self;}
	else {throw new Error("cannot export Go (neither global, window nor self is defined)");}
	if (!global.require && typeof require !== "undefined") {global.require = require;}
	const E=()=>{
		const e = new Error("not implemented");
		e.code = "ENOSYS";
		return e;
	};
	if (!global.fs) {
		let o = "";
		global.fs = {
			constants: {O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1},
			writeSync(f,b) {
				o += decoder.decode(b);
				const nl = o.lastIndexOf("\n");
				if (nl!==-1) {
					console.log(o.substr(0, nl));
					o = o.substr(nl + 1);
				}
				return b.length;
			},
			write(f,b,o,l,p,c) {
				if (o!==0||l!==b.length||p!==null){c(E());return;}
				c(null,this.writeSync(f, b));
			},
		};
	}
	const encoder = new TextEncoder("utf-8");
	const decoder = new TextDecoder("utf-8");

	global.Go = class {
		su4(a,v){this.mem.setUint32(a,v,true);}
		constructor() {
			this.argv = ["js"];
			this.env = {};
			this.exit = (code) => {
				if (code !== 0) {
					console.warn("exit code:", code);
				}
			};
			this._exitPromise = new Promise((resolve) => {
				this._resolveExitPromise = resolve;
			});
			this._pendingEvent = null;
			this._s = new Map();
			this._n = 1;
			const su1=(a,v)=>{this.mem.setUint8(a,v);}
			const ss4=(a,v)=>{this.mem.setInt32(a,v,true);}
			const gu4=(a)=>{return this.mem.getUint32(a,true);}
			const gs4=(a)=>{return this.mem.getInt32(a,true);}
			const sf8=(a,v)=>{this.mem.setFloat64(a, v, true);}
			const ss8=(a,v)=>{this.su4(a,v);this.su4(a+4,Math.floor(v/4294967296))}
			const gs8=(a)=>{return gu4(a)+gs4(a+4)*4294967296;}
			const l=(a)=>{
				const f = this.mem.getFloat64(a, true);
				if (f === 0) {return undefined;}
				if (!isNaN(f)) {return f;}
				return this._v[gu4(a)];
			}

			const storeValue=(a,v)=>{
				const nanHead = 0x7FF80000;

				if (typeof v === "number" && v !== 0) {
					if (isNaN(v)) {
						su4(a+4,nanHead);
						su4(a,0);
						return;
					}
					sf8(a,v);
					return;
				}

				if (v === undefined) {
					sf8(a, 0);
					return;
				}

				let i = this._i.get(v);
				if (i === undefined) {
					i = this._p.pop();
					if (i === undefined) {
						i = this._v.length;
					}
					this._v[i] = v;
					this._c[i] = 0;
					this._i.set(v, i);
				}
				this._c[i]++;
				let t = 0;
				switch (typeof v) {
					case "object":if (v !== null) {t = 1;}break;
					case "string":t=2;break;
					case "symbol":t=3;break;
					case "function":t=4;break;
				}
				this.su4(a+4,nanHead|t);
				this.su4(a,i);
			}

			const loadSlice=(a) => {return new Uint8Array(this._inst.exports.mem.buffer,gs8(a+0),gs8(a+8));}
			const loadSliceOfValues = (a) => {
				const r=gs8(a),e=gs8(a+8),b=new Array(l);
				for (let i=0;i<e;i++) {
					b[i]=l(r+i*8);
				}
				return b;
			}

			const gs=(a)=>{return decoder.decode(new DataView(this._inst.exports.mem.buffer,gs8(a+0),gs8(a+8)));}

			const to = Date.now() - performance.now();
			this.importObject = {
				go: {
					"runtime.wasmExit": (sp) => {
						sp >>>= 0;
						const code = gs4(sp+8);
						this.exited = true;
						delete this._inst;
						delete this._v;
						delete this._c;
						delete this._i;
						delete this._p;
						this.exit(code);
					},
					"runtime.wasmWrite": (sp) => {
						sp >>>= 0;
						fs.writeSync(gs8(sp+8), new Uint8Array(this._inst.exports.mem.buffer, gs8(sp+16), gs4(sp+24)));
					},
					"runtime.resetMemoryDataView":(sp)=>{this.mem = new DataView(this._inst.exports.mem.buffer);},
					"runtime.nanotime1":(sp)=>{sp>>>=0;ss8(sp+8, (to + performance.now()) * 1000000);},
					"runtime.walltime1":(sp)=>{
						sp >>>= 0;
						const msec = (new Date).getTime();
						ss8(sp+8,msec/1000);
						ss4(sp+16,(msec%1000)*1000000);
					},
					"runtime.scheduleTimeoutEvent": (sp) => {
						sp >>>= 0;
						const id = this._n;
						this._n++;
						this._s.set(id, setTimeout(
							() => {
								this._resume();
								while (this._s.has(id)) {
									console.warn("scheduleTimeoutEvent: missed timeout event");
									this._resume();
								}
							},
							gs8(sp + 8) + 1,
						));
						ss4(sp+16,id);
					},
					"runtime.clearTimeoutEvent": (sp) => {
						sp >>>= 0;
						const id = gs4(sp+8);
						clearTimeout(this._s.get(id));
						this._s.delete(id);
					},
					"runtime.getRandomData": (sp) => {
						sp >>>= 0;
						crypto.getRandomValues(loadSlice(sp+8));
					},
					"syscall/js.finalizeRef": (sp) => {
						sp >>>= 0;
						const id = gu4(sp+8);
						this._c[id]--;
						if (this._c[id] === 0) {
							const v = this._v[id];
							this._v[id] = null;
							this._i.delete(v);
							this._p.push(id);
						}
					},
					"syscall/js.stringVal": (sp) => {
						sp >>>= 0;
						storeValue(sp + 24, gs(sp + 8));
					},
					"syscall/js.valueGet": (sp) => {
						sp >>>= 0;
						const result = Reflect.get(l(sp + 8), gs(sp + 16));
						sp = this._inst.exports.getsp() >>> 0;
						storeValue(sp + 32, result);
					},
					"syscall/js.valueSet": (sp) => {
						sp >>>= 0;
						Reflect.set(l(sp + 8), gs(sp + 16), l(sp + 32));
					},
					"syscall/js.valueDelete": (sp) => {
						sp >>>= 0;
						Reflect.deleteProperty(l(sp + 8), gs(sp + 16));
					},
					"syscall/js.valueIndex": (sp) => {
						sp >>>= 0;
						storeValue(sp + 24, Reflect.get(l(sp + 8), gs8(sp + 16)));
					},
					"syscall/js.valueSetIndex": (sp) => {
						sp >>>= 0;
						Reflect.set(l(sp + 8), gs8(sp + 16), l(sp + 24));
					},
					"syscall/js.valueCall": (sp) => {
						sp >>>= 0;
						try {
							const v = l(sp + 8);
							const m = Reflect.get(v, gs(sp + 16));
							const args = loadSliceOfValues(sp + 32);
							const result = Reflect.apply(m, v, args);
							sp = this._inst.exports.getsp() >>> 0;
							storeValue(sp + 56, result);
							su1(sp+64,1);
						} catch (err) {
							storeValue(sp + 56, err);
							su1(sp+64,0);
						}
					},
					"syscall/js.valueInvoke": (sp) => {
						sp >>>= 0;
						try {
							const v = l(sp + 8);
							const args = loadSliceOfValues(sp + 16);
							const result = Reflect.apply(v, undefined, args);
							sp = this._inst.exports.getsp() >>> 0;
							storeValue(sp + 40, result);
							su1(sp+48,1);
						} catch (err) {
							storeValue(sp + 40, err);
							su1(sp+48,0);
						}
					},
					"syscall/js.valueNew": (sp) => {
						sp >>>= 0;
						try {
							const v = l(sp + 8);
							const args = loadSliceOfValues(sp + 16);
							const result = Reflect.construct(v, args);
							sp = this._inst.exports.getsp() >>> 0;
							storeValue(sp + 40, result);
							su1(sp+48,1);
						} catch (err) {
							storeValue(sp + 40, err);
							su1(sp+48,0);
						}
					},
					"syscall/js.valueLength": (sp) => {
						sp >>>= 0;
						ss8(sp + 16, parseInt(l(sp + 8).length));
					},
					"syscall/js.valuePrepareString": (sp) => {
						sp >>>= 0;
						const str = encoder.encode(String(l(sp + 8)));
						storeValue(sp + 16, str);
						ss8(sp + 24, str.length);
					},
					"syscall/js.valueLoadString": (sp) => {
						sp >>>= 0;
						const str = l(sp + 8);
						loadSlice(sp + 16).set(str);
					},
					"syscall/js.valueInstanceOf": (sp) => {
						sp >>>= 0;
						su1(sp+24, (l(sp + 8) instanceof l(sp + 16)) ? 1 : 0)
					},
					"syscall/js.copyBytesToGo": (sp) => {
						sp >>>= 0;
						const dst = loadSlice(sp + 8);
						const src = l(sp + 32);
						if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
							su1(sp+48,0);
							return;
						}
						const toCopy = src.subarray(0, dst.length);
						dst.set(toCopy);
						ss8(sp+40, toCopy.length);
						su1(sp+48,1);
					},
					"syscall/js.copyBytesToJS": (sp) => {
						sp >>>= 0;
						const dst = l(sp + 8);
						const src = loadSlice(sp + 16);
						if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
							su1(sp+48,0);
							return;
						}
						const toCopy = src.subarray(0, dst.length);
						dst.set(toCopy);
						ss8(sp + 40, toCopy.length);
						su1(sp+48,1);
					},
					"debug": (value) => {
						console.log(value);
					},
				}
			};
		}

		async run(instance) {
			if (!(instance instanceof WebAssembly.Instance)) {
				throw new Error("Go.run: WebAssembly.Instance expected");
			}
			this._inst = instance;
			this.mem = new DataView(this._inst.exports.mem.buffer);
			this._v = [NaN,0,null,true,false,global,this];
			this._c = new Array(this._v.length).fill(Infinity);
			this._i = new Map([[0,1],[null,2],[true,3],[false,4],[global,5],[this,6]]);
			this._p = [];
			this.exited = false;
			let o = 4096;
			const p = (str) => {
				const r = o, b = encoder.encode(str + "\0");
				new Uint8Array(this.mem.buffer, o, b.length).set(b);
				o += b.length;
				if (o % 8 !== 0) {o += 8 - (o % 8);}
				return r;
			};
			const c = this.argv.length;
			const a = [];
			this.argv.forEach((arg) => {
				a.push(p(arg));
			});
			a.push(0);

			const keys = Object.keys(this.env).sort();
			keys.forEach((key) => {
				a.push(p(`${key}=${this.env[key]}`));
			});
			a.push(0);

			const argv = o;
			a.forEach((ptr) => {this.su4(o,ptr);this.su4(o+4,0);o+=8;});

			this._inst.exports.run(c, argv);
			if (this.exited) {
				this._resolveExitPromise();
			}
			await this._exitPromise;
		}

		_resume() {
			if (this.exited) {throw new Error("Go program has already exited");}
			this._inst.exports.resume();
			if (this.exited) {this._resolveExitPromise();}
		}

		_makeFuncWrapper(id) {
			const go = this;
			return function () {
				const event = {id: id, this: this, args: arguments};
				go._pendingEvent = event;
				go._resume();
				return event.result;
			};
		}
	}
})();
