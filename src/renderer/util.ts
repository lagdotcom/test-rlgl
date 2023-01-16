export function getBuffer(gl: WebGLRenderingContext) {
  const buffer = gl.createBuffer();
  if (!buffer) throw "gl.createBuffer()";

  return buffer;
}

export function getTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture();
  if (!texture) throw "gl.createTexture()";

  return texture;
}

export function getShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) throw "gl.createShader()";

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw `Could not compile WebGL shader. \n\n${info}`;
  }

  return shader;
}

export function getProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
) {
  const program = gl.createProgram();
  if (!program) throw "gl.createProgram()";

  const vertexShader = getShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = getShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw `Could not compile WebGL program. \n\n${info}`;
  }

  return program;
}

type RecordObject<Keys extends string[], T> = {
  [Entry in Keys[number]]: T;
};

export type CompiledShader<
  AttributeNames extends string[],
  UniformNames extends string[]
> = {
  program: WebGLProgram;
  attribute: RecordObject<AttributeNames, number>;
  uniform: RecordObject<UniformNames, WebGLUniformLocation>;
};

type A = RecordObject<["a", "b"], number>;

export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributes: string[],
  uniforms: string[]
): CompiledShader<typeof attributes, typeof uniforms> {
  const program = getProgram(gl, vertexSource, fragmentSource);

  const attribute = Object.fromEntries(
    attributes.map((name) => [name, gl.getAttribLocation(program, name)])
  );

  const uniform = Object.fromEntries(
    uniforms.map((name) => {
      const location = gl.getUniformLocation(program, name);
      if (!location) throw `gl.getUniformLocation(${name})`;
      return [name, location];
    })
  );

  return { program, attribute, uniform };
}
