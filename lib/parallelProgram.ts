import { Program } from 'ogl';

// KHR_parallel_shader_compile로 셰이더를 백그라운드에서 링크한다. 첫 그리기의 동기 컴파일이 메인 스레드를 막지 않는다.
// 확장이 없으면 OGL Program과 같다. finish()가 true를 돌려준 뒤에만 그린다.

export class ParallelProgram extends Program {
  ready!: boolean;
  private parallel!: KHR_parallel_shader_compile | null;

  setShaders({ vertex, fragment }: { vertex: string; fragment: string }) {
    const gl = this.gl;
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (!this.parallel) {
      super.setShaders({ vertex, fragment });
      this.ready = true;
      return;
    }

    gl.shaderSource(this.vertexShader, vertex);
    gl.compileShader(this.vertexShader);
    gl.shaderSource(this.fragmentShader, fragment);
    gl.compileShader(this.fragmentShader);
    gl.linkProgram(this.program);
    this.ready = false;
    this.uniformLocations = new Map();
    this.attributeLocations = new Map();
    this.attributeOrder = '';
  }

  finish() {
    if (this.ready) return true;
    const gl = this.gl;
    if (!gl.getProgramParameter(this.program, this.parallel!.COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(this.program));
      return false;
    }

    this.uniformLocations = new Map();
    for (let i = 0, count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS); i < count; i++) {
      const uniform = gl.getActiveUniform(this.program, i) as Parameters<typeof this.uniformLocations.set>[0] | null;
      if (!uniform) continue;
      const location = gl.getUniformLocation(this.program, uniform.name);
      if (!location) continue;
      const [name, ...parts] = uniform.name.match(/(\w+)/g) ?? [];
      if (!name) continue;
      this.uniformLocations.set(uniform, location);
      uniform.uniformName = name;
      uniform.nameComponents = parts;
    }
    this.attributeLocations = new Map();
    const locations: string[] = [];
    for (let i = 0, count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES); i < count; i++) {
      const attribute = gl.getActiveAttrib(this.program, i);
      if (!attribute) continue;
      const location = gl.getAttribLocation(this.program, attribute.name);
      if (location < 0) continue;
      locations[location] = attribute.name;
      this.attributeLocations.set(attribute, location);
    }
    this.attributeOrder = locations.join('');
    this.ready = true;
    return true;
  }
}
