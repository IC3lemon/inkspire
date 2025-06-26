# inkspire

## `installation`
```sh
git clone <this-repo-url>
npm i
npm run build
```
## `plan for da arch`
```
┌──────────────────────────────┐
│ WebGPU Device & Queue       │
│ - Resource management       │
│ - Compute/Render commands   │
└───────┬──────────────────────┘
        │
┌───────▼──────────────────────┐
│ Compute Shaders             │
│ - Brush simulation          │
│ - Particle systems          │
│ - Physics-based effects      │
└───────┬──────────────────────┘
        │
┌───────▼──────────────────────┐
│ Render Pipeline             │
│ - Vertex processing         │
│ - Fragment blending         │
│ - Post-processing effects   │
└───────┬──────────────────────┘
        │
┌───────▼──────────────────────┐
│ Texture Management          │
│ - Layer storage             │
│ - Dirty rectangle tracking  │
│ - Async texture transfers   │
└──────────────────────────────┘
```

## TODO :
get core drawing working first
- [x] learn webgpu + set shit up
- [ ] Compute-based brush rendering
- [ ] Layer management via texture binding
- [ ] Basic color picker implementation