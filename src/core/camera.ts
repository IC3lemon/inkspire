import { vec3, mat4 } from "gl-matrix";

export class Camera {
    position: vec3;
    view: mat4;

    constructor(position: vec3) {
        this.position = position;
        this.view = mat4.create();
        this.update();
    }


    update() {
        const target = vec3.fromValues(0, this.position[1], this.position[2]);
        mat4.lookAt(this.view, this.position, target, [0, 0, 1]);
    }

    get_view(): mat4 {
        return this.view;
    }

    pan(deltaX: number, deltaY: number) {
        const SENSITIVITY = 0.01;
        this.position[1] -= deltaX * SENSITIVITY;  // horizontal mouse moves camera along Y
        this.position[2] += deltaY * SENSITIVITY;  // vertical mouse moves camera along Z (up)
        this.update();
    }
}
