import { CircleMesh } from "./circleMesh";
import { GPUContextManager } from "./gpuContextManager";
import { HistoryManager } from "../control/historyManager";
import { AnimationManager } from "../control/animationManager";
import { IStroke } from "../types/animationTypes";
import { CollabManager } from "../core/collabManager";

// 7 floats per instance: x, y, r, g, b, radius, alpha
const FLOATS_PER_INSTANCE = 7;
const BYTES_PER_INSTANCE  = FLOATS_PER_INSTANCE * 4; // 28

export class StrokeManager {
    canvas: HTMLCanvasElement;
    contextMgr: GPUContextManager;
    animMgr: AnimationManager;

    circleMesh!: CircleMesh;

    // Main instance buffer (active frame strokes)
    instanceBuffer!: GPUBuffer;
    maxInstances = 200000;
    instanceCount = 0;
    instanceData!: Float32Array;

    // Onion skin instance buffer
    onionBuffer!: GPUBuffer;
    onionCount = 0;
    onionData!: Float32Array;

    // Brush settings
    defaultBrushSize = 0.12;
    maxRadius = 0.12;
    minRadius = 0.02;

    // In-progress stroke accumulation: [x, y, pressure, appliedRadius]
    currentStrokePoints: number[][] = [];

    collab: CollabManager | null = null;

    constructor(
        canvas: HTMLCanvasElement,
        contextMgr: GPUContextManager,
        public historyMgr: HistoryManager,
        animMgr: AnimationManager
    ) {
        this.canvas = canvas;
        this.contextMgr = contextMgr;
        this.animMgr = animMgr;
    }

    initialize() {
        this.circleMesh = new CircleMesh(this.contextMgr.device);

        this.instanceData = new Float32Array(this.maxInstances * FLOATS_PER_INSTANCE);
        this.instanceBuffer = this.contextMgr.device.createBuffer({
            size: this.instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.onionData = new Float32Array(this.maxInstances * FLOATS_PER_INSTANCE);
        this.onionBuffer = this.contextMgr.device.createBuffer({
            size: this.onionData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    getBufferLayouts(): GPUVertexBufferLayout[] {
        const instanceLayout: GPUVertexBufferLayout = {
            arrayStride: BYTES_PER_INSTANCE,
            stepMode: "instance",
            attributes: [
                { shaderLocation: 1, format: "float32x2", offset: 0  }, // offset
                { shaderLocation: 2, format: "float32x3", offset: 8  }, // color
                { shaderLocation: 3, format: "float32",   offset: 20 }, // radius
                { shaderLocation: 4, format: "float32",   offset: 24 }, // alpha
            ],
        };
        return [this.circleMesh.bufferLayout, instanceLayout];
    }

    instanceRuns: { start: number, count: number, isEraser: boolean }[] = [];

    // ── Load a frame into the GPU buffer ──────────────────────────────────────

    loadFrame() {
        this.instanceCount = 0;
        this.instanceRuns = [];
        const strokes = this.animMgr.getFrameStrokes(this.animMgr.currentFrameIndex);

        for (const s of strokes) {
            const isEraser = !!s.isEraser;
            const start = this.instanceCount;

            for (let i = 0; i < s.points.length; i++) {
                this.pushInstance(s.points[i][0], s.points[i][1], s.color, s.radii[i], 1.0);
            }

            const count = this.instanceCount - start;
            if (count > 0) {
                if (this.instanceRuns.length > 0 && this.instanceRuns[this.instanceRuns.length - 1].isEraser === isEraser) {
                    this.instanceRuns[this.instanceRuns.length - 1].count += count;
                } else {
                    this.instanceRuns.push({ start, count, isEraser });
                }
            }
        }
        this.flushInstanceBuffer();
    }

    loadOnionSkins() {
        this.onionCount = 0;
        const fi = this.animMgr.currentFrameIndex;

        const pushOnion = (frameIdx: number, color: number[]) => {
            const strokes = this.animMgr.getFrameStrokes(frameIdx);
            for (const s of strokes) {
                for (let i = 0; i < s.points.length; i++) {
                    this.pushOnionInstance(s.points[i][0], s.points[i][1], color, s.radii[i]);
                }
            }
        };

        if (fi > 0) pushOnion(fi - 1, [1.0, 0.35, 0.35]);
        if (fi > 1) pushOnion(fi - 2, [1.0, 0.6,  0.6 ]);
        if (fi < this.animMgr.frameCount - 1) pushOnion(fi + 1, [0.25, 0.85, 0.35]);
        if (fi < this.animMgr.frameCount - 2) pushOnion(fi + 2, [0.6,  1.0,  0.6 ]);

        if (this.onionCount > 0) {
            const slice = this.onionData.subarray(0, this.onionCount * FLOATS_PER_INSTANCE);
            this.contextMgr.device.queue.writeBuffer(
                this.onionBuffer, 0, slice.buffer, slice.byteOffset, slice.byteLength
            );
        }
    }

    // ── Real-time drawing update ───────────────────────────────────────────────

    update(
        drawing: boolean, evaporating: boolean, trueErasing: boolean,
        drawX: number, drawY: number,
        lastDrawX: number | null, lastDrawY: number | null,
        brushSize: number, brushColor: number[],
        pressure: number, usePenPressure: boolean, pressureCurve: number
    ) {
        const clamped = Math.min(Math.max(brushSize, 0.01), 2.5);
        const taperFactor = Math.min(0.95, 0.7 / (1 + 20 * clamped * clamped));
        this.defaultBrushSize = brushSize;
        this.maxRadius = brushSize;
        this.minRadius = brushSize * (1 - taperFactor);

        if (drawing && !evaporating) {
            if (lastDrawX === null || lastDrawY === null) {
                if (usePenPressure) {
                    const ep = Math.pow(Math.max(0, Math.min(1, pressure)), pressureCurve);
                    const r  = this.maxRadius * ep;
                    this.currentStrokePoints.push([drawX, drawY, pressure, r]);
                    this.pushInstance(drawX, drawY, brushColor, r, 1.0);
                    this.flushLast(1);
                } else {
                    this.currentStrokePoints.push([drawX, drawY, pressure, this.defaultBrushSize]);
                    this.pushInstance(drawX, drawY, brushColor, this.defaultBrushSize, 1.0);
                    this.flushLast(1);
                }
            } else {
                const dx = drawX - lastDrawX, dy = drawY - lastDrawY;
                const steps = Math.max(1, Math.floor(Math.sqrt(dx * dx + dy * dy) / 0.02));
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const x = lastDrawX + dx * t;
                    const y = lastDrawY + dy * t;
                    const prevP = this.currentStrokePoints.length > 0
                        ? this.currentStrokePoints[this.currentStrokePoints.length - 1][2]
                        : pressure;
                    const ip = prevP + (pressure - prevP) * t;

                    if (usePenPressure) {
                        const ep = Math.pow(Math.max(0, Math.min(1, ip)), pressureCurve);
                        const r  = this.maxRadius * ep;
                        this.currentStrokePoints.push([x, y, ip, r]);
                        this.pushInstance(x, y, brushColor, r, 1.0);
                    } else {
                        this.currentStrokePoints.push([x, y, ip, this.defaultBrushSize]);
                        this.pushInstance(x, y, brushColor, this.defaultBrushSize, 1.0);
                    }
                }
                this.flushLast(steps + 1);
            }
        }

        // Stroke commit
        if (!drawing && !evaporating && this.currentStrokePoints.length > 0) {
            const total   = this.currentStrokePoints.length;
            const radii: number[] = [];

            if (usePenPressure) {
                for (let i = 0; i < total; i++) radii.push(this.currentStrokePoints[i][3]);
                const stroke: IStroke = {
                    points: this.currentStrokePoints.map(p => [p[0], p[1]]),
                    radii, color: [...brushColor], isEraser: trueErasing
                };
                this.historyMgr.save(this.animMgr.currentStrokes);
                this.animMgr.addStroke(stroke);
                this.collab?.emitStroke(
                    this.animMgr.currentFrameIndex,
                    this.animMgr.currentLayerIndex,
                    stroke
                );
            } else {
                this.instanceCount -= total;
                const taperPct = 0.15;
                for (let i = 0; i < total; i++) {
                    let t = 1;
                    if (i < total * taperPct)            t = i / (total * taperPct);
                    else if (i > total * (1 - taperPct)) t = (total - i) / (total * taperPct);
                    t = Math.max(0, Math.min(1, t));
                    const r = this.minRadius + (this.maxRadius - this.minRadius) * t;
                    const [x, y] = this.currentStrokePoints[i];
                    this.pushInstance(x, y, brushColor, r, 1.0);
                    radii.push(r);
                }
                this.flushLast(total);
                const stroke: IStroke = {
                    points: this.currentStrokePoints.map(p => [p[0], p[1]]),
                    radii, color: [...brushColor], isEraser: trueErasing
                };
                this.historyMgr.save(this.animMgr.currentStrokes);
                this.animMgr.addStroke(stroke);
                this.collab?.emitStroke(
                    this.animMgr.currentFrameIndex,
                    this.animMgr.currentLayerIndex,
                    stroke
                );
            }
            this.currentStrokePoints = [];
        }

        // Evaporating (old erasing)
        if (evaporating && drawing) {
            const strokes = this.animMgr.currentStrokes;
            for (let i = 0; i < strokes.length; i++) {
                if (this.isPointOnStroke(strokes[i], drawX, drawY)) {
                    this.historyMgr.save(strokes);
                    const next = [...strokes];
                    next.splice(i, 1);
                    this.animMgr.setLayerStrokes(next);
                    this.loadFrame();
                    break;
                }
            }
        }
    }

    applyUndoRedo(strokes: IStroke[]) {
        this.animMgr.setLayerStrokes(strokes);
        this.loadFrame();
    }

    // ── Rendering ──────────────────────────────────────────────────────────────

    render(pass: GPURenderPassEncoder, ctx: GPUContextManager, showOnion: boolean, trueErasing: boolean) {
        if (showOnion && this.onionCount > 0) {
            pass.setPipeline(ctx.pipeline);
            pass.setVertexBuffer(0, this.circleMesh.buffer);
            pass.setVertexBuffer(1, this.onionBuffer);
            pass.setBindGroup(0, ctx.bindGroup);
            pass.draw(66, this.onionCount, 0, 0);
        }
        if (this.instanceCount > 0) {
            pass.setVertexBuffer(0, this.circleMesh.buffer);
            pass.setVertexBuffer(1, this.instanceBuffer);
            pass.setBindGroup(0, ctx.bindGroup);

            // Draw runs
            for (const run of this.instanceRuns) {
                pass.setPipeline(run.isEraser ? ctx.eraserPipeline : ctx.pipeline);
                pass.draw(66, run.count, 0, run.start);
            }

            // Active uncommitted stroke at the end
            let committedCount = 0;
            if (this.instanceRuns.length > 0) {
                const lastRun = this.instanceRuns[this.instanceRuns.length - 1];
                committedCount = lastRun.start + lastRun.count;
            }

            if (this.instanceCount > committedCount) {
                const uncommittedCount = this.instanceCount - committedCount;
                pass.setPipeline(trueErasing ? ctx.eraserPipeline : ctx.pipeline);
                pass.draw(66, uncommittedCount, 0, committedCount);
            }
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private pushInstance(x: number, y: number, rgb: number[], radius: number, alpha: number) {
        if (this.instanceCount >= this.maxInstances) return;
        const idx = this.instanceCount * FLOATS_PER_INSTANCE;
        this.instanceData[idx]     = x;
        this.instanceData[idx + 1] = y;
        this.instanceData[idx + 2] = rgb[0];
        this.instanceData[idx + 3] = rgb[1];
        this.instanceData[idx + 4] = rgb[2];
        this.instanceData[idx + 5] = radius;
        this.instanceData[idx + 6] = alpha;
        this.instanceCount++;
    }

    private pushOnionInstance(x: number, y: number, rgb: number[], radius: number) {
        if (this.onionCount >= this.maxInstances) return;
        const idx = this.onionCount * FLOATS_PER_INSTANCE;
        this.onionData[idx]     = x;
        this.onionData[idx + 1] = y;
        this.onionData[idx + 2] = rgb[0];
        this.onionData[idx + 3] = rgb[1];
        this.onionData[idx + 4] = rgb[2];
        this.onionData[idx + 5] = radius;
        this.onionData[idx + 6] = 0.35;
        this.onionCount++;
    }

    private flushInstanceBuffer() {
        if (this.instanceCount === 0) return;
        const slice = this.instanceData.subarray(0, this.instanceCount * FLOATS_PER_INSTANCE);
        this.contextMgr.device.queue.writeBuffer(
            this.instanceBuffer, 0, slice.buffer, slice.byteOffset, slice.byteLength
        );
    }

    private flushLast(count: number) {
        const start = Math.max(0, this.instanceCount - count);
        const slice = this.instanceData.subarray(
            start * FLOATS_PER_INSTANCE,
            this.instanceCount * FLOATS_PER_INSTANCE
        );
        this.contextMgr.device.queue.writeBuffer(
            this.instanceBuffer,
            start * BYTES_PER_INSTANCE,
            slice.buffer, slice.byteOffset, slice.byteLength
        );
    }

    private isPointOnStroke(stroke: IStroke, x: number, y: number): boolean {
        for (let i = 0; i < stroke.points.length; i++) {
            const [px, py] = stroke.points[i];
            const r  = stroke.radii[i] ?? 0.05;
            const dx = x - px, dy = y - py;
            if (dx * dx + dy * dy < (r + 0.05) ** 2) return true;
        }
        return false;
    }
}
