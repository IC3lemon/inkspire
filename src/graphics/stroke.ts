export class Stroke {
    points: number[][];
    radii: number[];
    color: number[];
    meshStartIndex: number;
    meshEndIndex: number;

    constructor(
        points: number[][],
        radii: number[],
        color: number[],
        meshStartIndex: number,
        meshEndIndex: number
    ) {
        this.points = points;
        this.radii = radii;
        this.color = color;
        this.meshStartIndex = meshStartIndex;
        this.meshEndIndex = meshEndIndex;
    }

    isPointOnStroke(x: number, y: number): boolean {
        const threshold = 0.05; // default tolerance (world-space)
        for (let i = 0; i < this.points.length; i++) {
            const [px, py] = this.points[i];
            const r = this.radii[i] ?? 0.05;
            const dx = x - px;
            const dy = y - py;
            const distSq = dx * dx + dy * dy;
            if (distSq < (r + threshold) ** 2) {
                return true;
            }
        }
        return false;
    }

    clone() : Stroke{
        return new Stroke(
            this.points.map(p => [...p]),
            [...this.radii],
            [...this.color],
            this.meshStartIndex,
            this.meshEndIndex
        );
    }
}
