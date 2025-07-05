export class InputManager {
    isCursorLocked = false;
    isSpacePressed = false;
    isLeftClicked = false;
    isErasing = false;
    skipNextClick = false;

    mouseX = 0;
    mouseY = 0;
    virtualMouseX = 0;
    virtualMouseY = 0;
    ndcX = 0;
    ndcY = 0;

    keyLabel: HTMLElement;
    mouseXLabel: HTMLElement;
    mouseYLabel: HTMLElement;
    pointerLabel: HTMLElement;
    brushSize : number = 0.07;
    taperPercent : number = 0.15;
    brushColor: number[] = [0.13, 0.157, 0.192];

    constructor(canvas: HTMLCanvasElement) {
        this.keyLabel = document.getElementById("key-down")!;
        this.mouseXLabel = document.getElementById("mouse-x")!;
        this.mouseYLabel = document.getElementById("mouse-y")!;
        this.pointerLabel = document.getElementById("pointerlock")!;

        const colorPicker = document.getElementById("color-picker") as HTMLInputElement;
        colorPicker.addEventListener("input", () => {
            const hex = colorPicker.value;
            const r = parseInt(hex.substring(1, 3), 16);
            const g = parseInt(hex.substring(3, 5), 16);
            const b = parseInt(hex.substring(5, 7), 16);

            this.brushColor = [r / 255, g / 255, b / 255];

            (document.getElementById("color-r") as HTMLElement).innerText = r.toString();
            (document.getElementById("color-g") as HTMLElement).innerText = g.toString();
            (document.getElementById("color-b") as HTMLElement).innerText = b.toString();
            (document.getElementById("brushcolor") as HTMLElement).innerText = `[${r}, ${g}, ${b}]`;
        });

        document.addEventListener("keydown", this.onKeyDown);
        document.addEventListener("keyup", this.onKeyUp);

        document.addEventListener("pointerlockchange", () => {
            this.isCursorLocked = document.pointerLockElement === canvas;
            if (this.isCursorLocked) this.skipNextClick = true;
        });

        canvas.onclick = () => canvas.requestPointerLock();
        canvas.addEventListener("mousedown", e => { if (e.button === 0) this.isLeftClicked = true; });
        canvas.addEventListener("mouseup", e => { if (e.button === 0) this.isLeftClicked = false; });
        canvas.addEventListener("mouseleave", () => { this.isLeftClicked = false; });
        const brushSlider = document.getElementById("brush-size-slider") as HTMLInputElement;
        
        brushSlider.addEventListener("input", () => {
            this.brushSize = parseFloat(brushSlider.value);
        });
        
        canvas.addEventListener("mousemove", (e) => this.onMouseMove(e, canvas));
    }

    private onKeyDown = (e: KeyboardEvent) => {
        this.keyLabel.innerText = e.code;
        if (e.code === "Space") this.isSpacePressed = true;
    };

    private onKeyUp = (e: KeyboardEvent) => {
        this.keyLabel.innerText = `${e.code} released`;
        if (e.code === "Space") this.isSpacePressed = false;
        if (e.code === "KeyE") {
            this.isErasing = !this.isErasing;
            document.getElementById("erasing")!.innerText = this.isErasing.toString();
        }
    };

    private onMouseMove(e: MouseEvent, canvas: HTMLCanvasElement) {
        if (!this.isCursorLocked) return;
        this.mouseX = e.movementX;
        this.mouseY = e.movementY;

        this.virtualMouseX += e.movementX;
        this.virtualMouseY += e.movementY;

        this.ndcX = (10 * this.virtualMouseX) / canvas.width;
        this.ndcY = 1 - ((10 * this.virtualMouseY) / canvas.height);

        this.mouseXLabel.innerText = this.ndcX.toString();
        this.mouseYLabel.innerText = this.ndcY.toString();
        this.pointerLabel.innerText = (this.isSpacePressed && this.isLeftClicked).toString();
    }
}
