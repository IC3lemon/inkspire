import { mat4 } from "gl-matrix";
import { Camera } from "../core/camera";
import { GPUContextManager } from "./gpuContextManager";
import { StrokeManager } from "./strokeManager";
import { CursorRenderer } from "./cursor";
import { HistoryManager } from "../control/historyManager";

export class Renderer {
    canvas: HTMLCanvasElement;
    deviceInfoElem: HTMLElement;
    resolutionScale: number = 2.0;
    camera: Camera;
    zoomValue : number = 10;

    contextMgr: GPUContextManager;
    strokeMgr: StrokeManager;
    cursorRenderer: CursorRenderer;

    historyManager : HistoryManager;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.deviceInfoElem = document.getElementById("dev-width")!;
        this.camera = new Camera([this.zoomValue, 0, 0]);
        this.historyManager = new HistoryManager();
        this.contextMgr = new GPUContextManager(canvas);
        this.strokeMgr = new StrokeManager(canvas, this.contextMgr, this.historyManager, 0.07, 0.02);
        this.cursorRenderer = new CursorRenderer(canvas, this.contextMgr);
    }

    async initialize() {
        await this.contextMgr.setup();
        this.setCanvasResolution();
        this.contextMgr.configure();

        await this.contextMgr.createPipeline(
            this.strokeMgr.getBufferLayout()
        );

        window.addEventListener("resize", () => this.setCanvasResolution());
        this.canvas.toDataURL("image/png")
    }

    private setCanvasResolution() {
        const cssWidth = 800;
        const cssHeight = 600;
        const res = this.resolutionScale;

        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        this.canvas.width = cssWidth * res;
        this.canvas.height = cssHeight * res;

        this.deviceInfoElem.innerText = `${this.canvas.width}x${this.canvas.height}`;

        this.contextMgr.configure();
    }

    async render(
        panning: boolean,
        drawing: boolean,
        mouseX: number,
        mouseY: number,
        drawX: number,
        drawY: number,
        lastDrawX: number | null,
        lastDrawY: number | null,
        erasing: boolean,
        brushSize : number = 0.07,
        brushColor : number[] = [0.13, 0.157, 0.192] 
    ) {
        document.getElementById('brushSize')!.innerText = brushSize.toString();
        if (panning) {
            this.camera.pan(mouseX, mouseY);
        }

        this.strokeMgr.update(drawing, erasing, drawX, drawY, lastDrawX, lastDrawY, brushSize, brushColor);
        this.cursorRenderer.update(drawX, drawY, erasing, brushSize + 0.03);

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.001, 1000);
        const view = this.camera.get_view();
        const model = mat4.create();

        this.contextMgr.updateUniforms(model, view, projection);

        const device = this.contextMgr.device;
        const commandEncoder = device.createCommandEncoder();
        const textureView = this.contextMgr.context.getCurrentTexture().createView();

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        this.strokeMgr.render(pass, this.contextMgr.pipeline, this.contextMgr.bindGroup);
        this.cursorRenderer.render(pass, this.contextMgr.pipeline, this.contextMgr.bindGroup, !panning);

        pass.end();
        device.queue.submit([commandEncoder.finish()]);
    }
}
