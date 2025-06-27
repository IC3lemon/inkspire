struct Fragment {
    @builtin(position) Position : vec4<f32>, // builtin screen ka pposition
    @location(0) @interpolate(flat) Color : vec4<f32> // location in the vertex buffer
};

@vertex
fn vs_main(@location(0) vertexPosition: vec2<f32>, @location(1) vertexColor : vec3<f32>) -> Fragment {

    var output : Fragment;
    output.Position = vec4<f32>(vertexPosition, 0.0, 1.0);
    output.Color = vec4<f32>(vertexColor, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) @interpolate(flat) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}

// what are these function parameters
// what is that fragment shader, how tf is that working