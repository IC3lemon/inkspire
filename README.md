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
│ WebGPU Context Manager       │
│ (GPUContextManager)          │
│ - Adapter, Device, Queue     │
│ - Canvas & Context           │
│ - Render Pipeline, BindGroups│
│ - Uniform buffer setup       │
└───────┬──────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Layer Manager                │
│ (future)                     │
│ - Multiple drawing layers    │
│ - Alpha blending             │
│ - Layer ordering & visibility│
└───────┬────────────┬─────────┘
        │            │
        ▼            ▼
┌──────────────┐  ┌────────────────────┐
│ StrokeManager│  │ Texture Pool       │
│ - Stroke data│  │ (future)           │
│ - Circle mesh│  │ - Cached textures  │
│ - Tapering   │  │ - Reuse + upload   │
│ - Erase logic│  │ - Dirty tracking   │
└────┬─────────┘  └────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Undo / Redo System           │
│ (future)                     │
│ - Action stack               │
│ - Layer-aware undo           │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Cursor Renderer              │
│ - Eraser / Brush preview     │
│ - Color/size indication      │
│ - (future: shader preview)   │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Renderer Core                │
│ (Renderer.ts)                │
│ - Orchestrates everything    │
│ - Handles camera movement    │
│ - Composes layers            │
│ - Manages final render pass  │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ UI + App Layer               │
│ (App.ts, HTML overlay)       │
│ - Pointer locking            │
│ - Tool switching             │
│ - Layer panel (future)       │
│ - Keyboard/mouse handlers    │
└──────────────────────────────┘

```

## TODO :
- [x] learn webgpu + set shit up
    - [x] [read this article](https://surma.dev/things/webgpu/)
    - [x] [watch these](https://www.youtube.com/watch?v=P2aWwaQv91o&list=PLn3eTxaOtL2Ns3wkxdyS3CiqkJuwQdZzn&index=12)

- [ ] Drawing Engine
    - [x] Compute-based brush rendering
         - [x] draw a sexy circle
         - [x] pan across canvas
         - [x] draw multiple circles (stupid inefficient workaround currently)
         - [x] tapered strokes
         - [ ] hyper realistic brush using [this](https://www.diva-portal.org/smash/get/diva2:970839/FULLTEXT01.pdf) maybe
         - [x] implement splines (kinda done ? pseudo stroke approach currently) {TODO}
         - [x] drop the rastered approach, implement a spline one (need to perfect) {TODO}
         - [x] stroke erasing
    - [x] Basic color picker implementation
         - [ ] maintain color palette of recent colours
         - [ ] dropper picker implementation to get colors from canvas
    - [ ] textures to the circle to make unique brushes
    - [ ] Layer management
    - [ ] Utilities and mechanics
         - [ ] Flip Canvas
         - [ ] Undo Redo
         - [ ] maintain action stack ( as strokes maybe? )
          
- [ ] clean up the html, get better UI

