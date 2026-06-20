import { Renderer } from "../graphics/renderer";
import { InputManager } from "../core/inputManager";
import { AnimationManager } from "./animationManager";
import { Exporter } from "../core/exporter";
import { AudioManager } from "../core/audioManager";
import { CollabManager } from "../core/collabManager";

export class App {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    input: InputManager;
    animMgr: AnimationManager;
    exporter!: Exporter;
    audioMgr!: AudioManager;
    collab: CollabManager | null = null;

    lastDrawX: number | null = null;
    lastDrawY: number | null = null;
    smoothedX = 0;
    smoothedY = 0;
    zoomLevel = 10;

    // Canvas transform (free positioning)
    private canvasX = 0;
    private canvasY = 0;
    private canvasAngle = 0;
    private canvasScale = 1.0;

    isPlaying = false;
    private playInterval: number | null = null;

    // UI state
    showOnion = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.animMgr = new AnimationManager();
        this.renderer = new Renderer(canvas, this.animMgr);
        this.input = new InputManager(canvas, this.animMgr);
        this.exporter = new Exporter(this.animMgr, this.renderer, canvas);
        this.audioMgr = new AudioManager();
        this.renderer.camera.position[0] = this.zoomLevel;
    }

    async initialize() {
        let selectedRoomId: string | null = null;

        // Block until splash screen is resolved
        await new Promise<void>(resolve => {
            const screen = document.getElementById("splash-screen");
            if (!screen) return resolve();

            document.getElementById("splash-new")?.addEventListener("click", () => {
                this.animMgr.clearSession();
                screen.remove();
                document.documentElement.requestFullscreen().catch(() => { });
                resolve();
            });
            document.getElementById("splash-continue")?.addEventListener("click", () => {
                const restored = this.animMgr.loadSession();
                if (restored) console.log("Session restored from localStorage");
                screen.remove();
                document.documentElement.requestFullscreen().catch(() => { });
                resolve();
            });
            document.getElementById("splash-collab")?.addEventListener("click", () => {
                document.getElementById("splash-room-section")?.classList.remove("hidden");
                document.getElementById("splash-buttons")?.classList.add("hidden");
                (document.getElementById("room-id-input") as HTMLInputElement)?.focus();
            });
            const doJoin = () => {
                const input = document.getElementById("room-id-input") as HTMLInputElement;
                selectedRoomId = input?.value.trim() || Math.random().toString(36).slice(2, 8);
                this.animMgr.clearSession();
                screen.remove();
                document.documentElement.requestFullscreen().catch(() => { });
                resolve();
            };
            document.getElementById("splash-join")?.addEventListener("click", doJoin);
            document.getElementById("room-id-input")?.addEventListener("keydown", (e) => {
                if ((e as KeyboardEvent).key === "Enter") doJoin();
            });
        });

        await this.renderer.initialize();
        this.renderer.strokeMgr.loadFrame();

        // ── Collaboration setup ────────────────────────────────────────────────
        if (selectedRoomId) {
            this.collab = new CollabManager();
            this.renderer.strokeMgr.collab = this.collab;

            // Wait for room state before continuing (or time out)
            await new Promise<void>(resolve => {
                const timeout = window.setTimeout(resolve, 4000);
                this.collab!.onRoomState = (state) => {
                    window.clearTimeout(timeout);
                    this.animMgr.animation = { version: 1, ...state };
                    this.animMgr.currentFrameIndex = 0;
                    this.animMgr.currentLayerIndex = 0;
                    this.renderer.strokeMgr.loadFrame();
                    resolve();
                };
                this.collab!.connect(selectedRoomId!);
            });

            this.collab.onRemoteStroke = (frameIdx, layerIdx, stroke) => {
                if (frameIdx < this.animMgr.frameCount && layerIdx < this.animMgr.layerCount) {
                    this.animMgr.animation.frames[frameIdx].layerStrokes[layerIdx].push(stroke);
                    if (frameIdx === this.animMgr.currentFrameIndex) {
                        this.renderer.strokeMgr.loadFrame();
                    }
                }
            };

            this.collab.onFullSync = (state) => {
                this.animMgr.animation = { version: 1, ...state };
                this.animMgr.currentFrameIndex = Math.min(
                    this.animMgr.currentFrameIndex, this.animMgr.frameCount - 1
                );
                this.animMgr.currentLayerIndex = Math.min(
                    this.animMgr.currentLayerIndex, this.animMgr.layerCount - 1
                );
                this.renderer.strokeMgr.loadFrame();
                this.updateTimelineUI();
                this.updateLayerUI();
            };

            this.collab.onPeersChanged = () => this.updateCollabBadge();
            window.setInterval(() => this.updateCollabBadge(), 2000);
            this.updateCollabBadge();
        }

        // ── Keyboard shortcuts ─────────────────────────────────────────────────
        window.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "z") {
                e.preventDefault();
                const prev = this.renderer.strokeMgr.historyMgr.undo(this.animMgr.currentStrokes);
                if (prev) {
                    this.renderer.strokeMgr.applyUndoRedo(prev);
                    this.collab?.emitFullSync(
                        this.animMgr.animation.fps,
                        this.animMgr.animation.layers,
                        this.animMgr.animation.frames
                    );
                }
            }
            if (e.ctrlKey && e.key === "y") {
                e.preventDefault();
                const next = this.renderer.strokeMgr.historyMgr.redo(this.animMgr.currentStrokes);
                if (next) {
                    this.renderer.strokeMgr.applyUndoRedo(next);
                    this.collab?.emitFullSync(
                        this.animMgr.animation.fps,
                        this.animMgr.animation.layers,
                        this.animMgr.animation.frames
                    );
                }
            }
            // Arrow navigation
            if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "ArrowLeft") {
                e.preventDefault();
                this.goToFrame(Math.max(0, this.animMgr.currentFrameIndex - 1));
            }
            if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "ArrowRight") {
                e.preventDefault();
                this.goToFrame(Math.min(this.animMgr.frameCount - 1, this.animMgr.currentFrameIndex + 1));
            }
        });

        // Wire AnimationManager change events (frame/layer add/remove)
        this.animMgr.onChanged = () => {
            this.renderer.strokeMgr.loadFrame();
            if (this.showOnion) this.renderer.strokeMgr.loadOnionSkins();
            this.updateTimelineUI();
            this.updateLayerUI();
            this.collab?.emitFullSync(
                this.animMgr.animation.fps,
                this.animMgr.animation.layers,
                this.animMgr.animation.frames
            );
        };

        this.initResizers();
        this.initCanvasTransform();
        this.buildUI();
        this.updateTimelineUI();
        this.updateLayerUI();
    }

    // ── Collab badge ───────────────────────────────────────────────────────────

    private updateCollabBadge() {
        const badge = document.getElementById("collab-badge");
        if (!badge || !this.collab) return;
        badge.classList.remove("hidden");
        const roomEl = document.getElementById("collab-room");
        const usersEl = document.getElementById("collab-users");
        const latEl = document.getElementById("collab-latency");
        if (roomEl) roomEl.textContent = this.collab.connectedRoom ?? '–';
        const total = this.collab.peerCount + 1;
        if (usersEl) usersEl.textContent = `${total} user${total !== 1 ? 's' : ''}`;
        if (latEl) latEl.textContent = this.collab.avgLatencyMs > 0
            ? `${this.collab.avgLatencyMs}ms`
            : (this.collab.isConnected ? 'connected' : 'connecting…');
    }

    // ── UI Panel Resizers ────────────────────────────────────────────────────

    private initResizers() {
        const bindResizer = (resizerId: string, panelId: string, isHoriz: boolean, isLeftOrTop: boolean) => {
            const resizer = document.getElementById(resizerId);
            const panel = document.getElementById(panelId);
            if (!resizer || !panel) return;

            let isDragging = false;
            let startPos = 0;
            let startSize = 0;

            resizer.addEventListener("pointerdown", (e) => {
                isDragging = true;
                startPos = isHoriz ? e.clientY : e.clientX;
                startSize = isHoriz ? panel.offsetHeight : panel.offsetWidth;
                resizer.setPointerCapture(e.pointerId);
            });

            resizer.addEventListener("pointermove", (e) => {
                if (!isDragging) return;
                const currentPos = isHoriz ? e.clientY : e.clientX;
                const delta = isLeftOrTop ? (currentPos - startPos) : (startPos - currentPos);
                let newSize = Math.max(0, startSize + delta);

                // Collapse if too small
                if (newSize < 50) newSize = 0;

                if (isHoriz) {
                    panel.style.flex = `0 0 ${newSize}px`;
                    panel.style.height = `${newSize}px`;
                } else {
                    panel.style.flex = `0 0 ${newSize}px`;
                    panel.style.width = `${newSize}px`;
                }
            });

            resizer.addEventListener("pointerup", (e) => {
                isDragging = false;
                resizer.releasePointerCapture(e.pointerId);
            });
        };

        bindResizer("resizer-layers", "layers-panel", false, true); // vertical, left
        bindResizer("resizer-brush", "brush-panel", false, false);  // vertical, right
    }

    // ── Canvas free transform ────────────────────────────────────────────────

    private initCanvasTransform() {
        // Wait one frame so layout is settled before reading dimensions
        requestAnimationFrame(() => {
            const area = document.getElementById("canvas-area");
            if (area) {
                const r = area.getBoundingClientRect();
                this.canvasX = (r.width - 800) / 2;
                this.canvasY = (r.height - 600) / 2;
            }
            this.applyCanvasTransform();
        });

        let prevX = 0, prevY = 0;

        // Use pointermove on document — works for mouse AND tablet pens
        document.addEventListener("pointermove", (e) => {
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;

            if (this.input.isGrabMode) {
                this.canvasX += dx;
                this.canvasY += dy;
                this.applyCanvasTransform();
            }
            if (this.input.isRotateMode) {
                this.canvasAngle += dx * 0.4;
                this.input.canvasAngle = this.canvasAngle;
                this.applyCanvasTransform();
            }
        });

        // Reset prevX/Y on any pointerdown so first delta is 0
        document.addEventListener("pointerdown", (e) => {
            prevX = e.clientX;
            prevY = e.clientY;
        });

        // Cursor style + scale/reset hotkeys
        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyG") document.body.classList.add("grab-mode");
            if (e.code === "KeyR") document.body.classList.add("rotate-mode");

            // Shift+= → bigger, Shift+- → smaller  (no Ctrl so it doesn't clash with browser zoom)
            if (e.shiftKey && !e.ctrlKey && e.code === "Equal") {
                e.preventDefault();
                this.canvasScale = Math.min(5, parseFloat((this.canvasScale + 0.1).toFixed(2)));
                this.applyCanvasTransform();
            }
            if (e.shiftKey && !e.ctrlKey && e.code === "Minus") {
                e.preventDefault();
                this.canvasScale = Math.max(0.1, parseFloat((this.canvasScale - 0.1).toFixed(2)));
                this.applyCanvasTransform();
            }

            // Home → reset canvas to centre, no rotation, scale 1
            if (e.code === "Home") {
                e.preventDefault();
                this.resetCanvasTransform();
            }
        });
        document.addEventListener("keyup", (e) => {
            if (e.code === "KeyG") document.body.classList.remove("grab-mode");
            if (e.code === "KeyR") document.body.classList.remove("rotate-mode");
        });
    }

    private resetCanvasTransform() {
        const area = document.getElementById("canvas-area");
        if (area) {
            const r = area.getBoundingClientRect();
            this.canvasX = (r.width - 800) / 2;
            this.canvasY = (r.height - 600) / 2;
        }
        this.canvasAngle = 0;
        this.canvasScale = 1.0;
        this.input.canvasAngle = 0;
        this.applyCanvasTransform();
    }

    private applyCanvasTransform() {
        const shadow = document.getElementById("canvas-shadow") as HTMLElement | null;
        if (!shadow) return;
        shadow.style.left = `${this.canvasX}px`;
        shadow.style.top = `${this.canvasY}px`;
        shadow.style.transform = `rotate(${this.canvasAngle}deg) scale(${this.canvasScale})`;
    }

    // ── Main render loop ─────────────────────────────────────────────────────

    run = () => {
        if (this.isPlaying) { requestAnimationFrame(this.run); return; }

        const i = this.input;
        const alpha = i.smoothingWeight;

        // Zoom
        if (i.zoomIn && this.zoomLevel > 1.5) this.zoomLevel -= 0.5;
        if (i.zoomOut) this.zoomLevel += 0.5;
        this.renderer.camera.position[0] = this.zoomLevel;
        this.renderer.camera.update();

        // Project NDC → world space
        const fovy = Math.PI / 4;
        const aspect = this.canvas.width / this.canvas.height;
        const p11 = 1 / Math.tan(fovy / 2);
        const p00 = p11 / aspect;
        const worldY = this.renderer.camera.position[1] + (i.ndcX * this.zoomLevel) / p00;
        const worldZ = this.renderer.camera.position[2] + (i.ndcY * this.zoomLevel) / p11;

        const isDrawing = i.isLeftClicked && !i.isSpacePressed
            && !i.isGrabMode && !i.isRotateMode;

        if (this.lastDrawX === null && isDrawing) {
            this.smoothedX = worldY;
            this.smoothedY = worldZ;
        } else {
            this.smoothedX = (1 - alpha) * this.smoothedX + alpha * worldY;
            this.smoothedY = (1 - alpha) * this.smoothedY + alpha * worldZ;
        }

        this.renderer.render(
            i.isSpacePressed && i.isLeftClicked,
            isDrawing,
            i.mouseX, i.mouseY,
            this.smoothedX, this.smoothedY,
            this.lastDrawX, this.lastDrawY,
            i.isEvaporating, i.isTrueErasing,
            i.brushSize, i.brushColor,
            i.pressure, i.usePenPressure, i.pressureCurve,
            this.showOnion
        );

        if (isDrawing) {
            this.lastDrawX = this.smoothedX;
            this.lastDrawY = this.smoothedY;
        } else {
            this.lastDrawX = null;
            this.lastDrawY = null;
        }

        i.mouseX = 0;
        i.mouseY = 0;
        requestAnimationFrame(this.run);
    };

    // ─── Playback ──────────────────────────────────────────────────────────────

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        const fps = this.animMgr.animation.fps;

        this.audioMgr.play(fps, this.animMgr.currentFrameIndex);

        this.playInterval = window.setInterval(() => {
            const next = (this.animMgr.currentFrameIndex + 1) % this.animMgr.frameCount;
            if (next === 0) {
                // Restart audio on loop
                this.audioMgr.play(fps, 0);
            }
            this.goToFrame(next, false);
            this.renderPlayback();
        }, 1000 / fps);
        const btn = document.getElementById("play-btn");
        if (btn) btn.textContent = "⏸ pause";
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.playInterval !== null) clearInterval(this.playInterval);
        this.playInterval = null;

        this.audioMgr.stop();

        const btn = document.getElementById("play-btn");
        if (btn) btn.textContent = "▶ play";
        requestAnimationFrame(this.run);
    }

    private renderPlayback() {
        this.renderer.render(
            false, false, 0, 0, 0, 0, null, null, false, false,
            this.input.brushSize, this.input.brushColor,
            1.0, false, 1.0, false
        );
    }

    // ─── Frame navigation ──────────────────────────────────────────────────────

    goToFrame(index: number, updateUI = true) {
        this.animMgr.setCurrentFrame(index);
        this.renderer.strokeMgr.loadFrame();
        if (this.showOnion) this.renderer.strokeMgr.loadOnionSkins();
        this.lastDrawX = null;
        this.lastDrawY = null;

        if (!this.isPlaying) {
            this.audioMgr.scrubToFrame(index, this.animMgr.animation.fps);
        }

        if (updateUI) this.updateTimelineUI();
    }

    // ─── Export ────────────────────────────────────────────────────────────────

    async exportFrames() {
        const modal = document.getElementById("export-modal");
        if (modal) modal.classList.remove("hidden");
    }

    private setupExportModal() {
        const modal = document.getElementById("export-modal");
        const close = document.getElementById("exp-close");
        if (!modal || !close) return;

        close.addEventListener("click", () => modal.classList.add("hidden"));

        document.getElementById("exp-mp4")?.addEventListener("click", () => {
            modal.classList.add("hidden");
            this.exporter.exportMP4();
        });
        document.getElementById("exp-gif")?.addEventListener("click", () => {
            modal.classList.add("hidden");
            this.exporter.exportGIF();
        });
        document.getElementById("exp-frame")?.addEventListener("click", () => {
            modal.classList.add("hidden");
            this.exporter.exportCurrentFrame();
        });
        document.getElementById("exp-zip")?.addEventListener("click", () => {
            modal.classList.add("hidden");
            this.exporter.exportZIP();
        });
    }

    // ─── UI building ───────────────────────────────────────────────────────────

    private buildUI() {
        // Play/pause button
        document.getElementById("play-btn")!.addEventListener("click", () => {
            this.isPlaying ? this.pause() : this.play();
        });

        // Prev / Next frame
        document.getElementById("prev-frame-btn")!.addEventListener("click", () => {
            this.goToFrame(Math.max(0, this.animMgr.currentFrameIndex - 1));
        });
        document.getElementById("next-frame-btn")!.addEventListener("click", () => {
            this.goToFrame(Math.min(this.animMgr.frameCount - 1, this.animMgr.currentFrameIndex + 1));
        });

        // Undo / Redo toolbar buttons
        document.getElementById("undo-btn")?.addEventListener("click", () => {
            const prev = this.renderer.strokeMgr.historyMgr.undo(this.animMgr.currentStrokes);
            if (prev) {
                this.renderer.strokeMgr.applyUndoRedo(prev);
                this.collab?.emitFullSync(
                    this.animMgr.animation.fps,
                    this.animMgr.animation.layers,
                    this.animMgr.animation.frames
                );
            }
        });
        document.getElementById("redo-btn")?.addEventListener("click", () => {
            const next = this.renderer.strokeMgr.historyMgr.redo(this.animMgr.currentStrokes);
            if (next) {
                this.renderer.strokeMgr.applyUndoRedo(next);
                this.collab?.emitFullSync(
                    this.animMgr.animation.fps,
                    this.animMgr.animation.layers,
                    this.animMgr.animation.frames
                );
            }
        });

        // FPS input
        const fpsInput = document.getElementById("fps-input") as HTMLInputElement;
        fpsInput.value = String(this.animMgr.animation.fps);
        fpsInput.addEventListener("change", () => {
            this.animMgr.animation.fps = Math.max(1, Math.min(60, parseInt(fpsInput.value) || 12));
        });

        // Frame controls (no add-frame-btn in new HTML toolbar; added via timeline below)
        document.getElementById("dup-frame-btn")?.addEventListener("click", () => {
            this.animMgr.duplicateFrame(this.animMgr.currentFrameIndex);
            this.updateTimelineUI();
        });
        document.getElementById("del-frame-btn")?.addEventListener("click", () => {
            const idx = this.animMgr.currentFrameIndex;
            this.animMgr.deleteFrame(idx);
            this.goToFrame(Math.min(idx, this.animMgr.frameCount - 1));
        });

        // Onion skin — both the anim-controls button and the brush-panel toggle
        document.getElementById("onion-btn")?.addEventListener("click", () => {
            this.showOnion = !this.showOnion;
            document.getElementById("onion-btn")?.classList.toggle("active", this.showOnion);
            // Sync the panel toggle visually
            const tog = document.getElementById("onion-toggle");
            tog?.classList.toggle("on", this.showOnion);
            if (this.showOnion) this.renderer.strokeMgr.loadOnionSkins();
        });
        // Brush panel onion toggle div — inline script already handles .on class;
        // we read the state after it toggles via microtask
        document.getElementById("onion-toggle")?.addEventListener("click", () => {
            setTimeout(() => {
                const isOn = document.getElementById("onion-toggle")?.classList.contains("on") ?? false;
                this.showOnion = isOn;
                document.getElementById("onion-btn")?.classList.toggle("active", this.showOnion);
                if (this.showOnion) this.renderer.strokeMgr.loadOnionSkins();
            }, 0);
        });

        // Add layer
        document.getElementById("add-layer-btn")?.addEventListener("click", () => {
            this.animMgr.addLayer();
            this.updateLayerUI();
        });

        // Save / load / export
        document.getElementById("save-btn")!.addEventListener("click", () => {
            this.animMgr.saveSession();
            this.animMgr.exportProject();
        });

        document.getElementById("load-btn")!.addEventListener("click", () => {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".inkspire,application/json";
            fileInput.onchange = () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    this.animMgr.importProject(reader.result as string);
                    this.renderer.strokeMgr.loadFrame();
                    if (this.showOnion) this.renderer.strokeMgr.loadOnionSkins();
                    this.updateTimelineUI();
                    this.updateLayerUI();
                    const fpsInputEl = document.getElementById("fps-input") as HTMLInputElement;
                    fpsInputEl.value = String(this.animMgr.animation.fps);
                    this.collab?.emitFullSync(
                        this.animMgr.animation.fps,
                        this.animMgr.animation.layers,
                        this.animMgr.animation.frames
                    );
                };
                reader.readAsText(file);
            };
            fileInput.click();
        });

        document.getElementById("export-btn")!.addEventListener("click", () => this.exportFrames());
        this.setupExportModal();

        document.getElementById("load-audio-btn")?.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/*";
            input.onchange = async () => {
                if (input.files?.[0]) {
                    await this.audioMgr.loadAudio(input.files[0]);
                    this.updateTimelineUI(); // Re-render to size waveform properly
                }
            };
            input.click();
        });

        this.initTimelineEvents();
    }

    private initTimelineEvents() {
        const strip = document.getElementById("timeline")!;
        let isScrubbing = false;

        const handleScrub = (e: PointerEvent) => {
            const rect = strip.getBoundingClientRect();
            const x = e.clientX - rect.left + strip.scrollLeft;
            // First cell is "Add Frame" (44px + 3px gap)
            const frameIndex = Math.floor((x - 47) / 47);
            if (frameIndex >= 0 && frameIndex < this.animMgr.frameCount) {
                this.goToFrame(frameIndex);
            }
        };

        strip.addEventListener("pointerdown", (e) => {
            if ((e.target as HTMLElement).id === "add-frame-btn-tl") return;
            isScrubbing = true;
            handleScrub(e);
            strip.setPointerCapture(e.pointerId);
        });

        strip.addEventListener("pointermove", (e) => {
            if (isScrubbing) handleScrub(e);
        });

        strip.addEventListener("pointerup", (e) => {
            isScrubbing = false;
            strip.releasePointerCapture(e.pointerId);
        });
    }

    updateTimelineUI() {
        const strip = document.getElementById("timeline")!;
        strip.innerHTML = "";

        // Add frame button (+ cell) at the start
        const addCell = document.createElement("button");
        addCell.id = "add-frame-btn-tl";
        addCell.textContent = "+";
        addCell.title = "Add frame";
        addCell.addEventListener("click", () => {
            this.animMgr.addFrame(this.animMgr.currentFrameIndex);
            this.goToFrame(this.animMgr.currentFrameIndex + 1);
        });
        strip.appendChild(addCell);

        for (let fi = 0; fi < this.animMgr.frameCount; fi++) {
            const cell = document.createElement("div");
            cell.className = "frame-cell" + (fi === this.animMgr.currentFrameIndex ? " active" : "");
            cell.textContent = String(fi + 1);

            cell.addEventListener("click", () => this.goToFrame(fi));
            cell.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                this.showFrameContextMenu(e, fi);
            });
            strip.appendChild(cell);
        }

        const frameLabel = document.getElementById("frame-label");
        if (frameLabel) frameLabel.textContent = `${this.animMgr.currentFrameIndex + 1} / ${this.animMgr.frameCount}`;

        // The inline script in index.html handles scrubber ticks + audio grid via MutationObserver.
        // Just scroll the active frame into view.
        const activeCell = strip.querySelector(".frame-cell.active") as HTMLElement | null;
        activeCell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    private showFrameContextMenu(e: MouseEvent, fi: number) {
        const existing = document.getElementById("ctx-menu");
        if (existing) existing.remove();

        const menu = document.createElement("div");
        menu.id = "ctx-menu";
        menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;
            background:#1e1e2e;border:1px solid #3a3a5a;border-radius:6px;padding:4px 0;z-index:9999;`;

        const items = [
            ["Insert after", () => { this.animMgr.addFrame(fi); this.updateTimelineUI(); }],
            ["Duplicate", () => { this.animMgr.duplicateFrame(fi); this.updateTimelineUI(); }],
            ["Delete", () => { this.animMgr.deleteFrame(fi); this.goToFrame(this.animMgr.currentFrameIndex); }],
        ] as [string, () => void][];

        for (const [label, action] of items) {
            const item = document.createElement("div");
            item.textContent = label;
            item.style.cssText = "padding:6px 16px;cursor:pointer;color:#cdd6f4;font-size:12px;";
            item.onmouseenter = () => item.style.background = "#313149";
            item.onmouseleave = () => item.style.background = "";
            item.onclick = () => { action(); menu.remove(); };
            menu.appendChild(item);
        }

        document.body.appendChild(menu);
        const dismiss = () => { menu.remove(); document.removeEventListener("click", dismiss); };
        setTimeout(() => document.addEventListener("click", dismiss), 0);
    }

    updateLayerUI() {
        const list = document.getElementById("layer-list")!;
        list.innerHTML = "";
        for (let li = this.animMgr.layerCount - 1; li >= 0; li--) {
            const layer = this.animMgr.animation.layers[li];
            const row = document.createElement("div");
            row.className = "layer-row" + (li === this.animMgr.currentLayerIndex ? " active" : "");

            const eye = document.createElement("span");
            eye.className = "layer-eye";
            eye.textContent = layer.visible ? "👁" : "🚫";
            eye.title = "Toggle visibility";
            eye.onclick = (e) => {
                e.stopPropagation();
                this.animMgr.toggleLayerVisible(li);
                this.renderer.strokeMgr.loadFrame();
                this.updateLayerUI();
            };

            const name = document.createElement("span");
            name.className = "layer-name";
            name.textContent = layer.name;
            name.ondblclick = () => {
                const val = prompt("Rename layer:", layer.name);
                if (val) { this.animMgr.renameLayer(li, val); this.updateLayerUI(); }
            };

            const del = document.createElement("span");
            del.className = "layer-del";
            del.textContent = "✕";
            del.title = "Delete layer";
            del.onclick = (e) => {
                e.stopPropagation();
                this.animMgr.deleteLayer(li);
                this.renderer.strokeMgr.loadFrame();
                this.updateLayerUI();
            };

            row.appendChild(eye);
            row.appendChild(name);
            row.appendChild(del);
            row.onclick = () => {
                this.animMgr.setCurrentLayer(li);
                this.renderer.strokeMgr.loadFrame();
                this.updateLayerUI();
            };

            list.appendChild(row);
        }
    }
}
