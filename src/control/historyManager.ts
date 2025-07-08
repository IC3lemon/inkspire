import { Stroke } from "../graphics/stroke";

export class HistoryManager {
    private undoStack: Stroke[][] = [];
    private redoStack: Stroke[][] = [];

    save(strokes: Stroke[]) {
        const snapshot = strokes.map(s => s.clone());
        this.undoStack.push(snapshot);
        this.redoStack = [];
    }

    undo(currentStrokes: Stroke[]): Stroke[] | null {
        if (this.undoStack.length === 0) return null;
        this.redoStack.push(currentStrokes.map(s => s.clone()));
        return this.undoStack.pop()!;
    }

    redo(currentStrokes: Stroke[]): Stroke[] | null {
        if (this.redoStack.length === 0) return null;
        this.undoStack.push(currentStrokes.map(s => s.clone()));
        return this.redoStack.pop()!;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
