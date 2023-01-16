import Vec2 from "./Vec2";
import getCanvasAndContext from "../getCanvasAndContext";
import getImage from "../getImage";
import { getTexture } from "./util";

export default class TileMapLayer {
  scrollScaleX: number;
  scrollScaleY: number;
  tileTexture: WebGLTexture;
  inverseTextureSize: Vec2;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  data!: ImageData;
  dirty: boolean;

  constructor(public gl: WebGLRenderingContext) {
    this.scrollScaleX = 1;
    this.scrollScaleY = 1;
    this.tileTexture = getTexture(gl);
    this.inverseTextureSize = [0, 0];
    [this.canvas, this.ctx] = getCanvasAndContext("2d");
    this.dirty = false;
  }

  setTexture(src: string, repeat?: boolean) {
    const { canvas, ctx, gl, inverseTextureSize } = this;

    getImage(src).then((image) => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
      this.data = ctx.getImageData(
        0,
        0,
        image.naturalWidth,
        image.naturalHeight
      );
      this.refresh();

      // MUST be filtered with NEAREST or tile lookup fails
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

      if (repeat) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }

      inverseTextureSize[0] = 1 / image.width;
      inverseTextureSize[1] = 1 / image.height;
    });
  }

  refresh() {
    const { data, gl, tileTexture } = this;

    gl.bindTexture(gl.TEXTURE_2D, tileTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);

    this.dirty = false;
  }

  draw(x: number, y: number, u: number, v: number) {
    const { canvas, data } = this;

    const i = (y * canvas.width + x) * 4;
    data.data[i] = u;
    data.data[i + 1] = v;
    this.dirty = true;
  }

  get(x: number, y: number): [u: number, v: number] {
    const { canvas, data } = this;

    const i = (y * canvas.width + x) * 4;
    return [data.data[i], data.data[i + 1]];
  }

  contains(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.canvas.width && y < this.canvas.height;
  }

  dump() {
    const { canvas, data } = this;

    let i = 0;
    const rows = [];
    for (let y = 0; y < canvas.height; y++) {
      const row = [];

      for (let x = 0; x < canvas.width; x++) {
        const u = data.data[i];
        const v = data.data[i + 1];

        row.push([u, v]);
        i += 4;
      }

      rows.push(row);
    }

    return rows;
  }
}
