import shader from "../shaders/shaders.wgsl";
import { mat4 } from "gl-matrix";

export class GPUContextManager {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    adapter!: GPUAdapter;
    context!: GPUCanvasContext;
    format: GPUTextureFormat = "bgra8unorm";
    uniformBuffer!: GPUBuffer;
    bindGroup!: GPUBindGroup;
    pipeline!: GPURenderPipeline;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async setup() {
        this.adapter = await navigator.gpu?.requestAdapter() as GPUAdapter;
        this.device = await this.adapter?.requestDevice() as GPUDevice;
        this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    }

    configure() {
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque"
        });
    }

    async createPipeline(bufferLayout: GPUVertexBufferLayout) {
        this.uniformBuffer = this.device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            }]
        });

        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: "vs_main",
                buffers: [bufferLayout]
            },
            fragment: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: "fs_main",
                targets: [{ format: this.format }]
            },
            primitive: { topology: "triangle-strip" }
        });
    }

    updateUniforms(model: mat4, view: mat4, projection: mat4) {
        this.device.queue.writeBuffer(this.uniformBuffer, 0, model as ArrayBuffer);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, view as ArrayBuffer);
        this.device.queue.writeBuffer(this.uniformBuffer, 128, projection as ArrayBuffer);
    }
}
