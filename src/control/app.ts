import { Renderer } from "../graphics/renderer";
import { InputManager } from "../core/inputManager";
import { Camera } from "../core/camera";

export class App {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    input: InputManager;

    lastDrawX: number | null = null;
    lastDrawY: number | null = null;
    smoothedX = 0;
    smoothedY = 0;
    smoothedSpeed = 0;
    zoomLevel : number = 10;
    

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.input = new InputManager(canvas);
        this.renderer.camera.position[0] = this.zoomLevel;
    }

    async initialize() {
        await this.renderer.initialize();
    }

    run = () => {
        const i = this.input;
        const alpha = 0.45; 

        if(i.takeScreenShot){
            i.takeScreenShot = false;
            // remove cursor
            this.renderer.render(
                true, // panning
                false,
                i.mouseX,
                i.mouseY,
                this.smoothedX,
                this.smoothedY,
                this.lastDrawX,
                this.lastDrawY,
                i.isErasing,
                i.brushSize,// brush Sizez
                i.brushColor
            );
            const dataURL = this.canvas.toDataURL("image/png");

            const link = document.createElement("a");
            link.href = dataURL;
            link.download = "screenshot.png";
            link.click();
        } // perfecto

        if(i.zoomIn && this.zoomLevel > 1.5){
            this.zoomLevel -= 0.5;
            // i.zoomIn = false;
        }
        
        else if (i.zoomOut) {
            this.zoomLevel += 0.5;
            // i.zoomOut = false;
        }

        this.renderer.camera.position[0] = this.zoomLevel;
        this.renderer.camera.update();
        document.getElementById('zoom')!.innerText = this.zoomLevel.toString();

        const isDrawing = i.isLeftClicked && i.isCursorLocked && !i.skipNextClick && !i.isSpacePressed;
        this.smoothedX = (1 - alpha) * this.smoothedX + alpha * i.ndcX;
        this.smoothedY = (1 - alpha) * this.smoothedY + alpha * i.ndcY;

        this.renderer.render(
            i.isSpacePressed && i.isCursorLocked, // panning
            isDrawing,
            i.mouseX,
            i.mouseY,
            this.smoothedX,
            this.smoothedY,
            this.lastDrawX,
            this.lastDrawY,
            i.isErasing,
            i.brushSize,// brush Sizez
            i.brushColor
        );

        if (isDrawing) {
            this.lastDrawX = this.smoothedX;
            this.lastDrawY = this.smoothedY;
        } else {
            this.lastDrawX = null;
            this.lastDrawY = null;
        }

        i.skipNextClick = false;
        i.mouseX = 0;
        i.mouseY = 0;

        requestAnimationFrame(this.run);

        
    };
}