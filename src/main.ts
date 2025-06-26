import shader from "./shaders.wgsl"
import { TriangleMesh } from "./triangle_mesh";

const Initialize = async() =>{

    const canvas:  HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("gfx-main");
    const adapter: GPUAdapter = <GPUAdapter> await navigator.gpu?.requestAdapter();
    const device: GPUDevice = <GPUDevice> await adapter?.requestDevice();
    const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");
    const format : GPUTextureFormat = "bgra8unorm";
    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    }); // initialise
    const verts1 = [
        new Float32Array([0.0, 5 / 100]),
        new Float32Array([-5 / 100, -5 / 100]),
        new Float32Array([5 / 100, -5 / 100])
    ]

    const verts2 = [
        new Float32Array([ 5 / 100,  15 / 100]),    // top point of triangle 2
        new Float32Array([ 0.0,  0.05]),    // bottom left = top of triangle 1
        new Float32Array([ 0.10,  0.05])    // bottom right (shifted right for diagonal look)
    ];

    const triangleMesh1 : TriangleMesh = new TriangleMesh(device, verts1);
    const triangleMesh2 : TriangleMesh = new TriangleMesh(device, verts2);

    const pipeline : GPURenderPipeline = device.createRenderPipeline({
        vertex : {
            module : device.createShaderModule({
                code : shader
            }),
            entryPoint : "vs_main",
            buffers: [triangleMesh1.bufferLayout]
        },

        fragment : {
            module : device.createShaderModule({
                code : shader
            }),
            entryPoint : "fs_main",
            targets : [{
                format : format
            }]
        },

        primitive : {
            topology : "triangle-list"
        },

        layout : "auto" // automatically generate the pipeline layout, including bind group layouts
    });
    // creating the pipeline
    // what the fuck is primitive topology, and layout

    const commandEncoder : GPUCommandEncoder = device.createCommandEncoder();
    const textureView : GPUTextureView = context.getCurrentTexture().createView();
    const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            clearValue: {r:1, g:1, b:1, a:0},
            loadOp: "clear",
            storeOp: "store"
        }]
    });
    // rendering, what is this renderpass ? 
    renderpass.setPipeline(pipeline);
    renderpass.setVertexBuffer(0, triangleMesh1.buffer);
    renderpass.draw(3, 1, 0, 0);

    renderpass.setVertexBuffer(0, triangleMesh2.buffer);
    renderpass.draw(3, 1, 0, 0);
    renderpass.end();
    device.queue.submit([commandEncoder.finish()]);
}

Initialize();