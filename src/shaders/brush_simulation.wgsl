struct BrushParticle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    acceleration: vec2<f32>,
    life: f32,
    maxLife: f32,
    size: f32,
    pressure: f32,
    color: vec4<f32>
};

struct SimParams {
    deltaTime: f32,
    gravity: vec2<f32>,
    viscosity: f32,
    diffusion: f32,
    brushPosition: vec2<f32>,
    brushPressure: f32,
    brushSize: f32,
    mousePressed: u32
};

@group(0) @binding(0) var<storage, read_write> particles: array<BrushParticle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(64)
fn updateParticles(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= arrayLength(&particles)) { return; }
    var particle = particles[index];
    if (particle.life <= 0.0) { return; }

    particle.acceleration = params.gravity;
    if (params.mousePressed == 1u) {
        let toBrush = params.brushPosition - particle.position;
        let distance = length(toBrush);
        let force = normalize(toBrush) * params.brushPressure / (distance + 0.1);
        particle.acceleration += force;
    }
    particle.velocity *= (1.0 - params.viscosity * params.deltaTime);
    particle.velocity += particle.acceleration * params.deltaTime;
    particle.position += particle.velocity * params.deltaTime;
    particle.life -= params.deltaTime;
    let lifeRatio = particle.life / particle.maxLife;
    particle.color.a = lifeRatio;
    particles[index] = particle;
}

@compute @workgroup_size(64)
fn spawnParticles(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (params.mousePressed == 0u) { return; }
    var particle = particles[index % arrayLength(&particles)];
    if (particle.life > 0.0) { return; }
    let randomOffset = vec2<f32>(
        (f32(index * 73u + 17u) % 100.0) / 100.0 - 0.5,
        (f32(index * 37u + 23u) % 100.0) / 100.0 - 0.5
    ) * params.brushSize;
    particle.position = params.brushPosition + randomOffset;
    particle.velocity = vec2<f32>(0.0, 0.0);
    particle.acceleration = vec2<f32>(0.0, 0.0);
    particle.life = 2.0 + (f32(index * 41u) % 100.0) / 50.0;
    particle.maxLife = particle.life;
    particle.size = params.brushSize * (0.5 + (f32(index * 59u) % 100.0) / 200.0);
    particle.pressure = params.brushPressure;
    particle.color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    particles[index % arrayLength(&particles)] = particle;
}
