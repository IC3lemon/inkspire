import { CircleMesh } from "./circleMesh";
import { Stroke } from "./stroke";
import { GPUContextManager } from "./gpuContextManager";
import { HistoryManager } from "../control/historyManager";

export class StrokeManager {
    canvas: HTMLCanvasElement;
    contextMgr: GPUContextManager;
    circleMeshes: CircleMesh[] = [];
    strokes: Stroke[] = [];
    currentStrokePoints: number[][] = [];
    defaultBrushSize: number = 0.07;
    minRadius: number;
    maxRadius: number;

    constructor(
        canvas: HTMLCanvasElement,
        contextMgr: GPUContextManager,
        public historyMgr : HistoryManager,
        maxRadius: number = 0.07,
        minRadius: number = 0.02
    ) {
        this.canvas = canvas;
        this.contextMgr = contextMgr;
        this.maxRadius = maxRadius;
        this.minRadius = minRadius;
    }

    getBufferLayout(): GPUVertexBufferLayout {
        const temp = new CircleMesh(
            this.contextMgr.device,
            [0, 0],
            this.canvas.width,
            this.canvas.height,
            [1, 1, 1]
        );
        return temp.bufferLayout;
    }

    update(
        drawing: boolean,
        erasing: boolean,
        drawX: number,
        drawY: number,
        lastDrawX: number | null,
        lastDrawY: number | null,
        brushSize: number,
        brushColor: number[] = [0.13, 0.157, 0.192]
    ) {
        const minSize = 0.01;
        const maxSize = 2.5;
        const clamped = Math.min(Math.max(brushSize, minSize), maxSize);

        const maxTaper = 0.7;
        const scale = 20;
        const taper = maxTaper / (1 + scale * clamped * clamped);
        const taperFactor = Math.min(Math.max(taper, 0), 0.95);

        this.defaultBrushSize = brushSize;
        this.maxRadius = brushSize;
        this.minRadius = brushSize * (1 - taperFactor);


        document.getElementById('maxsize')!.innerText = this.maxRadius.toFixed(3);
        document.getElementById('minsize')!.innerText = this.minRadius.toFixed(3);

        if (drawing && !erasing) {
            const prevX = lastDrawX;
            const prevY = lastDrawY;

            if (prevX === null || prevY === null) {
                this.currentStrokePoints.push([drawX, drawY]);
                this.drawCircle(drawX, drawY, brushColor);
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
                    this.drawCircle(x, y, brushColor);
                }
            }
        }

        if (!drawing && !erasing && this.currentStrokePoints.length > 0) {
            this.historyMgr.save(this.strokes);

            const totalPoints = this.currentStrokePoints.length;
            const taperPercent = 0.15;
            const radii: number[] = [];

            this.circleMeshes.splice(this.circleMeshes.length - totalPoints);
            const startIndex = this.circleMeshes.length;

            for (let i = 0; i < totalPoints; i++) {
                let t = 1;
                if (i < totalPoints * taperPercent)
                    t = i / (totalPoints * taperPercent);
                else if (i > totalPoints * (1 - taperPercent))
                    t = (totalPoints - i) / (totalPoints * taperPercent);

                t = Math.max(0, Math.min(1, t));
                const radius = this.minRadius + (this.maxRadius - this.minRadius) * t;
                const [x, y] = this.currentStrokePoints[i];
                this.drawCircle(x, y, brushColor, radius);
                radii.push(radius);
            }

            const endIndex = this.circleMeshes.length - 1;
            this.strokes.push(new Stroke(this.currentStrokePoints, radii, brushColor, startIndex, endIndex));
            this.currentStrokePoints = [];
        }

        if (erasing && drawing) {
            for (let i = 0; i < this.strokes.length; i++) {
                const stroke = this.strokes[i];
                if (stroke.isPointOnStroke(drawX, drawY)) {
                    this.historyMgr.save(this.strokes);
                    const count = stroke.meshEndIndex - stroke.meshStartIndex + 2;
                    this.circleMeshes.splice(stroke.meshStartIndex, count);
                    this.strokes.splice(i, 1);
                    this.recalculateStrokeMeshIndices();
                    break;
                }
            }
        }
    }

    private drawCircle(x: number, y: number, rgb: number[], radius = this.defaultBrushSize) {
        const mesh = new CircleMesh(
            this.contextMgr.device,
            [x, y],
            this.canvas.width,
            this.canvas.height,
            rgb,
            radius
        );
        this.circleMeshes.push(mesh);
    }

    private recalculateStrokeMeshIndices() {
        let currentIndex = 0;
        for (const s of this.strokes) {
            const len = s.points.length;
            s.meshStartIndex = currentIndex;
            s.meshEndIndex = currentIndex + len - 1;
            currentIndex += len;
        }
    }

    render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup) {
        for (const mesh of this.circleMeshes) {
            if (mesh.erased) continue;
            pass.setPipeline(pipeline);
            pass.setVertexBuffer(0, mesh.buffer);
            pass.setBindGroup(0, bindGroup);
            pass.draw(66, 1, 0, 0);
        }

        const strokeCountElem = document.getElementById("strokes");
        if (strokeCountElem) strokeCountElem.innerText = this.strokes.length.toString();
    }

    applyStrokes(newStrokes: Stroke[]) {
        this.strokes = newStrokes;
        this.rebuildMeshes();
    }

    private rebuildMeshes() {
        this.circleMeshes = [];
        for (const stroke of this.strokes) {
            for (let i = 0; i < stroke.points.length; i++) {
                const [x, y] = stroke.points[i];
                const radius = stroke.radii[i];
                this.drawCircle(x, y, stroke.color, radius);
            }
        }
        this.recalculateStrokeMeshIndices();
    }
}
