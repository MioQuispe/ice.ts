wasm-pack build --target bundler
wasm-opt --strip-debug -Oz pkg/didc_bg.wasm -o pkg/didc_bg.wasm
