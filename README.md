# inkspire

best resource to learn webgpu i've found on the net by far : https://math.hws.edu/graphicsbook/c9/s1.html 

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
- [x] learn webgpu + set shit up
    - [x] [read this article](https://surma.dev/things/webgpu/)
    - [ ] [watch these](https://www.youtube.com/watch?v=P2aWwaQv91o&list=PLn3eTxaOtL2Ns3wkxdyS3CiqkJuwQdZzn&index=12)
- [ ] Compute-based brush rendering
    - [x] draw a sexy circle
    - [x] pan across canvas
    - [ ] draw multiple circles (maybe blend vertices for those on top of each other?)
- [ ] Basic color picker implementation
- [ ] Layer management via texture binding


