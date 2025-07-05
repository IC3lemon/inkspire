import { Renderer } from "../view/renderer";
import $ from "jquery";

export class App{
    canvas : HTMLCanvasElement;
    renderer : Renderer;

    keyLabel : HTMLElement;
    mouseXLabel : HTMLElement;
    mouseYLabel : HTMLElement;
    pointerLabel : HTMLElement;
    
    mouseX!: number;
    mouseY!: number;
    virtualMouseX : number = 0;
    virtualMouseY : number = 0;
    ndcX : number = 0;
    ndcY : number = 0;
    
    forwards_amount !: number;
    right_amount !: number;

    isCursorLocked: boolean = false;
    isSpacePressed: boolean = false;
    isLeftClicked:boolean = false;
    skipNextClick : boolean = false;
    isErasing : boolean;
    lastDrawX: number | null = null;
    lastDrawY: number | null = null;
    smoothedX: number = 0;
    smoothedY: number = 0;

    smoothedSpeed: number = 0;

    constructor(canvas : HTMLCanvasElement){
        this.isErasing = false;
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        this.forwards_amount = 0;
        this.right_amount = 0;
        this.mouseX = 0;
        this.mouseY = 0;

        this.keyLabel = <HTMLElement>document.getElementById('key-down');
        this.mouseXLabel = <HTMLElement>document.getElementById('mouse-x');
        this.mouseYLabel = <HTMLElement>document.getElementById('mouse-y');
        this.pointerLabel = <HTMLElement>document.getElementById("pointerlock");
        $(document).on("keydown", (event) => {this.handle_keypress(event)});
        $(document).on("keyup", (event) => {this.handle_keyrelease(event)});
        
        this.canvas.onclick = () => {
            this.canvas.requestPointerLock();
        }

        document.addEventListener("pointerlockchange", () => {
            this.isCursorLocked = document.pointerLockElement === this.canvas;
            if (this.isCursorLocked) {
                this.skipNextClick = true;
            }
            
        });

        this.canvas.addEventListener("mousedown", (event) => {
            if (event.button === 0) { // Left click
                this.isLeftClicked = true;
            }
        });

        this.canvas.addEventListener("mouseup", (event) => {
            if (event.button === 0) { // Left click
                this.isLeftClicked = false;
            }
        });

        this.canvas.addEventListener("mouseleave", () => {
            this.isLeftClicked = false;
        });

        this.canvas.addEventListener("mousemove", (event) => {
            if(this.isCursorLocked){
                this.handle_mousemove(event);
                this.pointerLabel.innerText = (this.isSpacePressed && this.isLeftClicked).toString();
            }
        });
    }

    async initialize(){
        await this.renderer.Initialize();
    }

    run = () => {
        var running : boolean = true;
        const isDrawing = this.isLeftClicked && this.isCursorLocked && !this.skipNextClick && !this.isSpacePressed;

        const alpha = 0.45; // try 0.1 - 0.3 for smoothing aggressiveness 0.45 is comfy acc to me, 1 => smoothing off
        this.smoothedX = (1 - alpha) * this.smoothedX + alpha * this.ndcX;
        this.smoothedY = (1 - alpha) * this.smoothedY + alpha * this.ndcY;

        this.renderer.render(
            this.isSpacePressed && this.isCursorLocked, // panning 
            isDrawing, 
            this.mouseX, this.mouseY, 
            this.smoothedX, this.smoothedY, 
            this.lastDrawX,
            this.lastDrawY,
            this.isErasing // ts not working
        );
        if (isDrawing) {
            this.lastDrawX = this.smoothedX;
            this.lastDrawY = this.smoothedY;
        } else {
            this.lastDrawX = null;
            this.lastDrawY = null;
        }

        this.skipNextClick = false;
        this.mouseX = 0;
        this.mouseY = 0;

        if(running){
            requestAnimationFrame(this.run);
        }
    }

    handle_keypress(event : JQuery.KeyDownEvent){
        this.keyLabel.innerText = event.code;
        if (event.code == 'Space'){
            this.isSpacePressed = true;
        }
    }

    handle_keyrelease(event : JQuery.KeyUpEvent){
        this.keyLabel.innerText = event.code + "released";
        if (event.code == 'Space'){
            this.isSpacePressed = false;
        }
        if (event.code == 'KeyE'){
            this.isErasing = !this.isErasing;
            var erasing = <HTMLElement>document.getElementById('erasing');
            erasing.innerText = this.isErasing.toString();
        }
    }

    handle_mousemove(event : MouseEvent){
        this.mouseX = event.movementX;
        this.mouseY = event.movementY;

        this.virtualMouseX += event.movementX;
        this.virtualMouseY += event.movementY;

        this.ndcX = (10 * this.virtualMouseX) / this.canvas.width ;
        this.ndcY = 1 - ((10 * this.virtualMouseY) / this.canvas.height);

        this.mouseXLabel.innerText = this.mouseX.toString();
        this.mouseYLabel.innerText = this.mouseY.toString();
    }
}