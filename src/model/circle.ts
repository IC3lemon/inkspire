import { vec2, mat4, vec3 } from "gl-matrix";
import { Deg2Rad } from "./math_stuff";

export class Circle{
    position: vec3;
    eulers: vec3;
    model!: mat4;

    constructor(position : vec3, theta : number){
        this.position = position;
        this.eulers = vec3.create();
        this.eulers[2] = theta;
    }

    update(){
        this.model = mat4.create();
        mat4.translate(
            this.model, this.model, this.position
        );
    }

    get_model() : mat4{
        return this.model;
    }
}