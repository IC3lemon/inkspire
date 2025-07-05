import { Renderer } from "../graphics/renderer";
import { InputManager } from "../core/inputManager";

export class App {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    input: InputManager;

    lastDrawX: number | null = null;
    lastDrawY: number | null = null;
    smoothedX = 0;
    smoothedY = 0;
    smoothedSpeed = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.input = new InputManager(canvas);
    }

    async initialize() {
        await this.renderer.Initialize();
    }

    run = () => {
        const alpha = 0.45;
        const i = this.input;

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
            i.isErasing
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
