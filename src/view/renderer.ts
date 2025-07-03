import shader from "./shaders/shaders.wgsl";
import { CircleMesh } from "./circle_mesh";
import { mat4 } from "gl-matrix";
import { Camera } from "../model/camera";

export class Renderer{
    canvas : HTMLCanvasElement;
    device_deets : HTMLElement;
    // Device stuff
    adapter!: GPUAdapter;
    device!: GPUDevice;
    context!: GPUCanvasContext;
    format!: GPUTextureFormat;
    resolutionScale : number = 2.0;
    //Pipeline stuff
    uniformBuffer !: GPUBuffer;
    bindGroup!: GPUBindGroup;
    pipeline!: GPURenderPipeline;
    //Assets
    camera : Camera;
    circleMesh!: CircleMesh;
    t: number = 0.0;

    constructor(canvas : HTMLCanvasElement){
        this.canvas = canvas;
        this.device_deets = <HTMLElement>document.getElementById('dev-width');
        this.device_deets.innerText = this.canvas.width.toString() + 'x' + this.canvas.height.toString();
        this.camera = new Camera([10, 0, 0]);
        this.t = 0;
    }
    setCanvasResolution() {
        const cssWidth = 800;
        const cssHeight = 600;

        const res = this.resolutionScale;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        this.canvas.width = cssWidth * res;
        this.canvas.height = cssHeight * res;

        this.device_deets.innerText = `${this.canvas.width}x${this.canvas.height}`;

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque"
        });
    }

    async Initialize() {
        await this.setupDevice();
        this.setCanvasResolution();
        this.createAssets();
        await this.makePipeline();

        window.addEventListener('resize', () => this.setCanvasResolution());
        // this.render();
    }

    async setupDevice() {
        //adapter: wrapper around (physical) GPU.
        //Describes features and limits
        this.adapter = <GPUAdapter> await navigator.gpu?.requestAdapter();
        //device: wrapper around GPU functionality
        //Function calls are made through the device
        this.device = <GPUDevice> await this.adapter?.requestDevice();
        //context: similar to vulkan instance (or OpenGL context)
        this.context = <GPUCanvasContext> this.canvas.getContext("webgpu");
        this.format = "bgra8unorm";
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque"
        });
    }

    async makePipeline() {
        this.uniformBuffer = this.device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding : 0,
                    visibility : GPUShaderStage.VERTEX,
                    buffer : {}
                }
            ],
        });

        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding : 0,
                resource : {
                    buffer : this.uniformBuffer
                }
            }]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        this.pipeline = this.device.createRenderPipeline({
            vertex : {
                module : this.device.createShaderModule({
                    code : shader
                }),
                entryPoint : "vs_main",
                buffers: [this.circleMesh.bufferLayout,]
            },
    
            fragment : {
                module : this.device.createShaderModule({
                    code : shader
                }),
                entryPoint : "fs_main",
                targets : [{
                    format : this.format
                }]
            },
    
            primitive : {
                topology : "triangle-strip"
            },
    
            layout: pipelineLayout
        });
    }

    createAssets() {
        this.circleMesh = new CircleMesh(this.device, [0, 0], this.canvas.width, this.canvas.height);
    }

    async render(isPanning : boolean, mouseX : number, mouseY : number) { 

        if (isPanning) {
            this.camera.pan(mouseX, mouseY);
        }
        
        const projection = mat4.create();
        mat4.perspective(projection, Math.PI/4, this.canvas.width/this.canvas.height, 0.001, 1000);
        const view = this.camera.get_view();
        const model = mat4.create();

        this.device.queue.writeBuffer(this.uniformBuffer, 0, <ArrayBuffer>model); 
        this.device.queue.writeBuffer(this.uniformBuffer, 64, <ArrayBuffer>view); 
        this.device.queue.writeBuffer(this.uniformBuffer, 128, <ArrayBuffer>projection); 

        const commandEncoder : GPUCommandEncoder = this.device.createCommandEncoder();
        const textureView : GPUTextureView = this.context.getCurrentTexture().createView();
        const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {r: 0.93, g: 0.93, b: 0.93, a: 1.0}, // rgb(238, 238, 238)
                loadOp: "clear",
                storeOp: "store"
            }]
        });
        renderpass.setPipeline(this.pipeline);
        renderpass.setVertexBuffer(0, this.circleMesh.buffer);
        renderpass.setBindGroup(0, this.bindGroup);
        renderpass.draw(66, 1, 0, 0);    // vertexCount = 2 * (segments + 1)
        renderpass.end();
    
        this.device.queue.submit([commandEncoder.finish()]);
    }
}