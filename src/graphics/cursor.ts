import { CircleMesh } from "./circleMesh";
import { GPUContextManager } from "./gpuContextManager";

export class CursorRenderer {
    canvas: HTMLCanvasElement;
    contextMgr: GPUContextManager;
    mesh?: CircleMesh;

    constructor(canvas: HTMLCanvasElement, contextMgr: GPUContextManager) {
        this.canvas = canvas;
        this.contextMgr = contextMgr;
    }

    update(x: number, y: number, erasing: boolean) {
        this.mesh = new CircleMesh(
            this.contextMgr.device,
            [x, y],
            this.canvas.width,
            this.canvas.height,
            [+erasing, 0, +!erasing],
            0.1
        );
    }

    render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, shouldRender: boolean) {
        if (!this.mesh || !shouldRender) return;
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, this.mesh.buffer);
        pass.setBindGroup(0, bindGroup);
        pass.draw(66, 1, 0, 0);
    }
}
