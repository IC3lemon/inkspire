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
    
    forwards_amount !: number;
    right_amount !: number;
    isCursorLocked: boolean = false;
    isSpacePressed: boolean = false;
    isLeftClicked:boolean = false;

    constructor(canvas : HTMLCanvasElement){
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        this.forwards_amount = 0;
        this.right_amount = 0;

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
            
        });

        this.canvas.addEventListener("mousedown", (event) => {
        if (event.button === 0) { // Left click
            this.isLeftClicked = true;
        }
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

        
    });

    }

    async initialize(){
        await this.renderer.Initialize();
    }

    run = () => {
        var running : boolean = true;
        this.renderer.render(this.isSpacePressed && this.isLeftClicked, this.mouseX, this.mouseY);

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
    }

    handle_mousemove(event : MouseEvent){
        this.mouseX = event.movementX;
        this.mouseY = event.movementY;
        this.mouseXLabel.innerText = this.mouseX.toString();
        this.mouseYLabel.innerText = this.mouseY.toString();
        // event.movementX, event.movementY -> to get cursor
    }
}