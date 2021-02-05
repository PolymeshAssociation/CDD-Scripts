# WASM bindings for Confidential Identity Library


This library provides WASM binding for confidential library.

For comprehensive build instructions, refer to the README.md file in the
root of this repository. If you have all the necessary tools installed,
you can build the wasm bindings using

```bash
# If your active toolchain is stable, then run
rustup run nightly wasm-pack build --release

# If your active toolchain is nightly, then you can use the simpler version and run
wasm-pack build --release
```

This will create the bindings in `./pkg/` directory. You can import
these into any javascript-based project using a wasm-loader.


## CDD Provider Usage

After importing the content of `./pkg/` in your javascript project, you
can call the `process_create_cdd_id` function to create the CDD ID. The
documentation for this function can be found by running `cargo doc --open`


## Investors' Usage

After importing the content of `./pkg/` in your javascript project, you
can call the `process_create_claim_proof` function to create a
confidential proof for their claim. The documentation for this function
can be found by running `cargo doc --open`


## Simple Claim Verifier

This is not supported since the verification is handled by PolyMesh.
