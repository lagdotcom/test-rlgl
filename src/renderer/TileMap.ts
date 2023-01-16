import { CompiledShader, createProgram, getBuffer, getTexture } from "./util";

import TileMapLayer from "./TileMapLayer";
import Vec2 from "./Vec2";
import fragmentSource from "./tilemap.frag.shader";
import getImage from "../getImage";
import vertexSource from "./tilemap.vert.shader";

export default class TileMap {
  viewportSize: Vec2;
  scaledViewportSize: Vec2;
  inverseTileTextureSize: Vec2;
  inverseSpriteTextureSize: Vec2;
  tileScale: number;
  tileSize: number;
  filtered: boolean;
  spriteSheet: WebGLTexture;
  layers: TileMapLayer[];
  quadVertBuffer: WebGLBuffer;
  tilemapShader: CompiledShader<
    ["position", "texture"],
    [
      "tileSize",
      "inverseTileSize",
      "viewportSize",
      "inverseSpriteTextureSize",
      "sprites",
      "tiles",
      "viewOffset",
      "inverseTileTextureSize"
    ]
  >;

  constructor(public gl: WebGLRenderingContext) {
    this.viewportSize = [0, 0];
    this.scaledViewportSize = [0, 0];
    this.inverseTileTextureSize = [0, 0];
    this.inverseSpriteTextureSize = [0, 0];

    this.tileScale = 1.0;
    this.tileSize = 16;

    this.filtered = false;

    this.spriteSheet = getTexture(gl);
    this.layers = [];

    const quadVerts = [
      //x  y  u  v
      [-1, -1, 0, 1],
      [1, -1, 1, 1],
      [1, 1, 1, 0],

      [-1, -1, 0, 1],
      [1, 1, 1, 0],
      [-1, 1, 0, 0],
    ].flat();

    this.quadVertBuffer = getBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVerts), gl.STATIC_DRAW);

    this.tilemapShader = createProgram(
      gl,
      vertexSource,
      fragmentSource,
      ["position", "texture"],
      [
        "tileSize",
        "inverseTileSize",
        "viewportSize",
        "inverseSpriteTextureSize",
        "sprites",
        "tiles",
        "viewOffset",
        "inverseTileTextureSize",
      ]
    );
  }

  public resizeViewport(width: number, height: number) {
    this.viewportSize[0] = width;
    this.viewportSize[1] = height;

    this.scaledViewportSize[0] = width / this.tileScale;
    this.scaledViewportSize[1] = height / this.tileScale;
  }

  public setTileScale(scale: number) {
    this.tileScale = scale;

    this.scaledViewportSize[0] = this.viewportSize[0] / scale;
    this.scaledViewportSize[1] = this.viewportSize[1] / scale;
  }

  public setFiltered(filtered: boolean) {
    const { gl } = this;
    this.filtered = filtered;

    // TODO: Cache currently bound texture?
    gl.bindTexture(gl.TEXTURE_2D, this.spriteSheet);

    if (filtered) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // Worth it to mipmap here?
    }
  }

  public setSpriteSheet(src: string) {
    const { gl } = this;
    getImage(src).then((image) => {
      gl.bindTexture(gl.TEXTURE_2D, this.spriteSheet);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      if (!this.filtered) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // Worth it to mipmap here?
      }

      this.inverseSpriteTextureSize[0] = 1 / image.width;
      this.inverseSpriteTextureSize[1] = 1 / image.height;
    });
  }

  public addTileLayer(
    src: string,
    layerId: number,
    scrollScaleX?: number,
    scrollScaleY?: number
  ) {
    const layer = new TileMapLayer(this.gl);
    layer.setTexture(src);
    if (scrollScaleX) {
      layer.scrollScaleX = scrollScaleX;
    }
    if (scrollScaleY) {
      layer.scrollScaleY = scrollScaleY;
    }

    this.layers[layerId] = layer;
    return layer;
  }

  public draw(x: number, y: number) {
    const {
      gl,
      inverseSpriteTextureSize,
      layers,
      quadVertBuffer,
      scaledViewportSize,
      spriteSheet,
      tilemapShader: shader,
      tileScale,
      tileSize,
    } = this;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(shader.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertBuffer);

    gl.enableVertexAttribArray(shader.attribute.position);
    gl.enableVertexAttribArray(shader.attribute.texture);
    gl.vertexAttribPointer(
      shader.attribute.position,
      2,
      gl.FLOAT,
      false,
      16,
      0
    );
    gl.vertexAttribPointer(shader.attribute.texture, 2, gl.FLOAT, false, 16, 8);

    gl.uniform2fv(shader.uniform.viewportSize, scaledViewportSize);
    gl.uniform2fv(
      shader.uniform.inverseSpriteTextureSize,
      inverseSpriteTextureSize
    );
    gl.uniform1f(shader.uniform.tileSize, tileSize);
    gl.uniform1f(shader.uniform.inverseTileSize, 1 / tileSize);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shader.uniform.sprites, 0);
    gl.bindTexture(gl.TEXTURE_2D, spriteSheet);

    gl.activeTexture(gl.TEXTURE1);
    gl.uniform1i(shader.uniform.tiles, 1);

    // Draw each layer of the map
    for (let i = layers.length; i >= 0; --i) {
      const layer = layers[i];
      if (layer) {
        if (layer.dirty) layer.refresh();

        gl.uniform2f(
          shader.uniform.viewOffset,
          Math.floor(x * tileScale * layer.scrollScaleX),
          Math.floor(y * tileScale * layer.scrollScaleY)
        );
        gl.uniform2fv(
          shader.uniform.inverseTileTextureSize,
          layer.inverseTextureSize
        );

        gl.bindTexture(gl.TEXTURE_2D, layer.tileTexture);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
  }
}
