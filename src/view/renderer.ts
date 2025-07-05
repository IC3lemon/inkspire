import shader from "./shaders/shaders.wgsl";
import { CircleMesh } from "./circle_mesh";
import { mat4 } from "gl-matrix";
import { Camera } from "../model/camera";
import { Stroke } from "./stroke_mesh";

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
    strokes!: Stroke[];
    camera : Camera;
    circleMesh!: CircleMesh;
    cursorMesh?: CircleMesh;
    circleCount: number;
    circleMeshes: CircleMesh[] = [];
    defaultBrushSize : number = 0.1;

    currentStrokePoints: number[][] = [];
    // t: number = 0.0;

    constructor(canvas : HTMLCanvasElement){
        this.canvas = canvas;
        this.strokes = [];
        this.device_deets = <HTMLElement>document.getElementById('dev-width');
        this.device_deets.innerText = this.canvas.width.toString() + 'x' + this.canvas.height.toString();
        this.camera = new Camera([10, 0, 0]);
        
        // this.t = 0;
        this.circleCount = 0;

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
        this.setCanvasResolution(); // r: 0.93, g: 0.93, b: 0.93, a: 1.0
        this.drawCircle(0, 0, [0.93, 0.93, 0.93], 0); // this.CreateAssets(); [0.13, 0.157, 0.192] init circle same colour as bg
        await this.makePipeline();
        window.addEventListener('resize', () => this.setCanvasResolution());
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
                buffers: [this.circleMeshes[0].bufferLayout]
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

    drawCircle(x : number, y : number , rgb : number[], radius : number = this.defaultBrushSize) {
        const mesh = new CircleMesh(this.device, [x, y], this.canvas.width, this.canvas.height, rgb, radius);
        this.circleMeshes.push(mesh);
        this.circleCount += 1;
    }

    async render(
        Panning : boolean, 
        Drawing : boolean, 
        mouseX : number, 
        mouseY : number, 
        drawX : number, 
        drawY : number, 
        lastDrawX : number | null,
        lastDrawY : number | null,
        Erasing : boolean
    ) { 
        var strokenum = <HTMLElement>document.getElementById('strokes');
        strokenum.innerText = this.strokes.length.toString();

        const brushColor = [0.13, 0.157, 0.192];
        this.defaultBrushSize = 0.07;

        if (Panning) {
            this.camera.pan(mouseX, mouseY);
        }

        if (Drawing && !Erasing) {
            const prevX = lastDrawX;
            const prevY = lastDrawY;

            if (prevX === null || prevY === null) {
                this.currentStrokePoints.push([drawX, drawY]);
                this.drawCircle(drawX, drawY, brushColor, this.defaultBrushSize);
            } else {
                const dx = drawX - prevX;
                const dy = drawY - prevY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const spacing = 0.02;
                const steps = Math.max(1, Math.floor(dist / spacing));

                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const x = prevX + dx * t;
                    const y = prevY + dy * t;
                    this.currentStrokePoints.push([x, y]);
                    this.drawCircle(x, y, brushColor, this.defaultBrushSize);
                }
            }

            lastDrawX = drawX;
            lastDrawY = drawY;
        }

        if (!Drawing && !Erasing && this.currentStrokePoints.length > 0) {
            const totalPoints = this.currentStrokePoints.length;
            const minBrush = 0.02;
            const maxBrush = 0.075;
            const taperPercent = 0.15;
            const radiuses: number[] = [];

            this.circleMeshes.splice(this.circleMeshes.length - totalPoints);
            this.circleCount -= totalPoints;

            const startIndex = this.circleMeshes.length;

            for (let i = 0; i < totalPoints; i++) {
                let t = 1;
                if (i < totalPoints * taperPercent) {
                    t = i / (totalPoints * taperPercent);
                } else if (i > totalPoints * (1 - taperPercent)) {
                    t = (totalPoints - i) / (totalPoints * taperPercent);
                }

                t = Math.min(1, Math.max(0, t));
                const radius = minBrush + (maxBrush - minBrush) * t;
                const [x, y] = this.currentStrokePoints[i];
                radiuses.push(radius);
                this.drawCircle(x, y, brushColor, radius);
            }

            const endIndex = this.circleMeshes.length - 1;

            this.strokes.push(new Stroke(
                this.currentStrokePoints,
                radiuses,
                brushColor,
                startIndex,
                endIndex
            ));
            this.currentStrokePoints = [];
        }

        if (Erasing && Drawing) {
            for (let i = 0; i < this.strokes.length; i++) {
                const stroke = this.strokes[i];
                if (stroke.isPointOnStroke(drawX, drawY)) {
                    const count = stroke.meshEndIndex - stroke.meshStartIndex  + 2;
                    this.circleMeshes.splice(stroke.meshStartIndex, count);
                    this.circleCount -= count;

                    this.strokes.splice(i, 1);

                    let currentIndex = 0;
                    for (const s of this.strokes) {
                        const len = s.points.length;
                        s.meshStartIndex = currentIndex;
                        s.meshEndIndex = currentIndex + len - 1;
                        currentIndex += len;
                    }

                    break; 
                }
            }
        }



        if (this.cursorMesh) {
            this.cursorMesh = undefined;
        }

        this.cursorMesh = new CircleMesh(
            this.device,
            [drawX, drawY],
            this.canvas.width,
            this.canvas.height,
            [+Erasing, 0.0, +!Erasing]
        );

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.001, 1000);
        const view = this.camera.get_view();
        const model = mat4.create();

        this.device.queue.writeBuffer(this.uniformBuffer, 0, <ArrayBuffer>model);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, <ArrayBuffer>view);
        this.device.queue.writeBuffer(this.uniformBuffer, 128, <ArrayBuffer>projection);

        const commandEncoder: GPUCommandEncoder = this.device.createCommandEncoder();
        const textureView: GPUTextureView = this.context.getCurrentTexture().createView();
        const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        for (const mesh of this.circleMeshes) {
            if (mesh.erased) continue;
            renderpass.setPipeline(this.pipeline);
            renderpass.setVertexBuffer(0, mesh.buffer);
            renderpass.setBindGroup(0, this.bindGroup);
            renderpass.draw(66, 1, 0, 0);
        }

        if (!Panning && this.cursorMesh) {
            renderpass.setPipeline(this.pipeline);
            renderpass.setVertexBuffer(0, this.cursorMesh.buffer);
            renderpass.setBindGroup(0, this.bindGroup);
            renderpass.draw(66, 1, 0, 0);
        }

        renderpass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

}