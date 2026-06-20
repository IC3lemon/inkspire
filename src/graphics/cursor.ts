import { CircleMesh } from "./circleMesh";
import { GPUContextManager } from "./gpuContextManager";

const FLOATS = 7;
const BYTES  = FLOATS * 4;

export class CursorRenderer {
    contextMgr: GPUContextManager;
    mesh!: CircleMesh;
    instanceBuffer!: GPUBuffer;
    instanceData!: Float32Array;

    constructor(contextMgr: GPUContextManager) {
        this.contextMgr = contextMgr;
    }

    initialize() {
        this.mesh = new CircleMesh(this.contextMgr.device);
        this.instanceData = new Float32Array(FLOATS);
        this.instanceBuffer = this.contextMgr.device.createBuffer({
            size: this.instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    update(x: number, y: number, erasing: boolean, cursorSize: number) {
        this.instanceData[0] = x;
        this.instanceData[1] = y;
        this.instanceData[2] = erasing ? 1.0 : 0.15;
        this.instanceData[3] = erasing ? 0.3 : 0.35;
        this.instanceData[4] = erasing ? 0.3 : 0.85;
        this.instanceData[5] = cursorSize;
        this.instanceData[6] = 0.85; // alpha

        this.contextMgr.device.queue.writeBuffer(
            this.instanceBuffer, 0,
            this.instanceData.buffer, this.instanceData.byteOffset, this.instanceData.byteLength
        );
    }

    render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, visible: boolean) {
        if (!visible) return;
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, this.mesh.buffer);
        pass.setVertexBuffer(1, this.instanceBuffer);
        pass.setBindGroup(0, bindGroup);
        pass.draw(66, 1, 0, 0);
    }
}
