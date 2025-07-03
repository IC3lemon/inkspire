export class CircleMesh {
    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout

    constructor(device: GPUDevice, center: number[], canvasWidth: number, canvasHeight: number) {
        const verts: number[][] = [];
        const segments = 100; // can use to increase resolution, gotta come up with a formula
        const radius = 0.2;
        const cx = center[0];
        const cy = center[1];
        const r = 0.13, g = 0.157, b = 0.192; // default brush ?
        // rgb(34, 40, 49)
        const aspectRatio = canvasWidth / canvasHeight;
        const radiusX = radius ; // dont need to do this anymore breh
        const radiusY = radius; 

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            const x = Math.cos(angle) * radiusX;
            const y = Math.sin(angle) * radiusY;

            verts.push([0, cx + x, cy + y, r, g, b]);
            verts.push([0, cx, cy, r, g, b]);     
        } // perfect circle secy

        const vertices: Float32Array = new Float32Array(verts.flat());
        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

        const descriptor: GPUBufferDescriptor = {
            size: vertices.byteLength,
            usage: usage,
            mappedAtCreation: true
        };

        this.buffer = device.createBuffer(descriptor);
        new Float32Array(this.buffer.getMappedRange()).set(vertices);
        this.buffer.unmap();

        this.bufferLayout = {
            arrayStride: 24,
            attributes: [
                {
                    shaderLocation: 0,
                    format: "float32x3",
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: "float32x3",
                    offset: 12
                }
            ]
        }
    }
}