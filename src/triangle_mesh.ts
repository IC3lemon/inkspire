export class TriangleMesh{
    buffer : GPUBuffer // vertex buffer loaded from the cpu
    bufferLayout : GPUVertexBufferLayout

    constructor(device : GPUDevice, vertexes : Float32Array[]){

        if (vertexes.length != 3 || vertexes.some(v => v.length != 2)){
            throw new Error("expected 3 vertices on the triangle mesh, each with [x,y]")
        }
        const vertices : Float32Array = new Float32Array( // xy rgb
            [
                vertexes[0][0], vertexes[0][1], 0.0, 0.0, 0.0,
                vertexes[1][0], vertexes[1][1], 0.0, 0.0, 0.0,
                vertexes[2][0], vertexes[2][1], 0.0, 0.0, 0.0
            ]
        )
        // how the GPUbuffer is gonna be used for this object
        //  GPUBufferUsage.VERTEX -> the buffer will be used to store vertex data
        //  GPUBufferUsage.COPY_DST -> the CPU or another buffer can copy data into it
        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        // used by the device to create the buffer
        const descriptor : GPUBufferDescriptor = {
            size : vertices.byteLength,
            usage : usage,
            mappedAtCreation : true // host visible / visible to CPU ?
        }

        this.buffer = device.createBuffer(descriptor);
        new Float32Array(this.buffer.getMappedRange()).set(vertices);
        this.buffer.unmap();

        this.bufferLayout = {
            arrayStride: 20,
            attributes: [
                {
                    shaderLocation: 0,
                    format: "float32x2", // feeds into @location(0) in vertex shader
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: "float32x3", // feeds into @location(1) in vertex shader
                    offset: 8
                }
            ]
        }
    }
}

// what is shaderLocation : 0