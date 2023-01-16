"use strict";
(() => {
  // src/renderer/util.ts
  function getBuffer(gl) {
    const buffer = gl.createBuffer();
    if (!buffer)
      throw "gl.createBuffer()";
    return buffer;
  }
  function getTexture(gl) {
    const texture = gl.createTexture();
    if (!texture)
      throw "gl.createTexture()";
    return texture;
  }
  function getShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
      throw "gl.createShader()";
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw `Could not compile WebGL shader. 

${info}`;
    }
    return shader;
  }
  function getProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    if (!program)
      throw "gl.createProgram()";
    const vertexShader = getShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = getShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw `Could not compile WebGL program. 

${info}`;
    }
    return program;
  }
  function createProgram(gl, vertexSource, fragmentSource, attributes, uniforms) {
    const program = getProgram(gl, vertexSource, fragmentSource);
    const attribute = Object.fromEntries(
      attributes.map((name) => [name, gl.getAttribLocation(program, name)])
    );
    const uniform = Object.fromEntries(
      uniforms.map((name) => {
        const location = gl.getUniformLocation(program, name);
        if (!location)
          throw `gl.getUniformLocation(${name})`;
        return [name, location];
      })
    );
    return { program, attribute, uniform };
  }

  // src/getCanvasAndContext.ts
  function getCanvasAndContext(type, options) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext(type, options);
    if (!ctx)
      throw `getContext(${type})`;
    return [canvas, ctx];
  }

  // src/getImage.ts
  var images = /* @__PURE__ */ new Map();
  function getImage(src) {
    const item = images.get(src);
    if (item)
      return item;
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.src = src;
    });
    images.set(src, promise);
    return promise;
  }

  // src/renderer/TileMapLayer.ts
  var TileMapLayer = class {
    constructor(gl) {
      this.gl = gl;
      this.scrollScaleX = 1;
      this.scrollScaleY = 1;
      this.tileTexture = getTexture(gl);
      this.inverseTextureSize = [0, 0];
      [this.canvas, this.ctx] = getCanvasAndContext("2d");
      this.dirty = false;
    }
    setTexture(src, repeat) {
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
    draw(x, y, u, v) {
      const { canvas, data } = this;
      const i = (y * canvas.width + x) * 4;
      data.data[i] = u;
      data.data[i + 1] = v;
      this.dirty = true;
    }
    get(x, y) {
      const { canvas, data } = this;
      const i = (y * canvas.width + x) * 4;
      return [data.data[i], data.data[i + 1]];
    }
    contains(x, y) {
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
  };

  // src/renderer/tilemap.frag.shader
  var tilemap_frag_default = "precision mediump float;\r\n\r\nvarying vec2 pixelCoord;\r\nvarying vec2 texCoord;\r\n\r\nuniform sampler2D tiles;\r\nuniform sampler2D sprites;\r\n\r\nuniform vec2 inverseTileTextureSize;\r\nuniform vec2 inverseSpriteTextureSize;\r\nuniform float tileSize;\r\n\r\nvoid main(void) {\r\n   vec4 tile = texture2D(tiles, texCoord);\r\n   if(tile.x == 1.0 && tile.y == 1.0) { discard; }\r\n   vec2 spriteOffset = floor(tile.xy * 256.0) * tileSize;\r\n   vec2 spriteCoord = mod(pixelCoord, tileSize);\r\n   gl_FragColor = texture2D(sprites, (spriteOffset + spriteCoord) * inverseSpriteTextureSize);\r\n}\r\n";

  // src/renderer/tilemap.vert.shader
  var tilemap_vert_default = "precision mediump float;\r\n\r\nattribute vec2 position;\r\nattribute vec2 texture;\r\n\r\nvarying vec2 pixelCoord;\r\nvarying vec2 texCoord;\r\n\r\nuniform vec2 viewOffset;\r\nuniform vec2 viewportSize;\r\nuniform vec2 inverseTileTextureSize;\r\nuniform float inverseTileSize;\r\n\r\nvoid main(void) {\r\n   pixelCoord = (texture * viewportSize) + viewOffset;\r\n   texCoord = pixelCoord * inverseTileTextureSize * inverseTileSize;\r\n   gl_Position = vec4(position, 0.0, 1.0);\r\n}\r\n";

  // src/renderer/TileMap.ts
  var TileMap = class {
    constructor(gl) {
      this.gl = gl;
      this.viewportSize = [0, 0];
      this.scaledViewportSize = [0, 0];
      this.inverseTileTextureSize = [0, 0];
      this.inverseSpriteTextureSize = [0, 0];
      this.tileScale = 1;
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
        [-1, 1, 0, 0]
      ].flat();
      this.quadVertBuffer = getBuffer(gl);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVerts), gl.STATIC_DRAW);
      this.tilemapShader = createProgram(
        gl,
        tilemap_vert_default,
        tilemap_frag_default,
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
      );
    }
    resizeViewport(width, height) {
      this.viewportSize[0] = width;
      this.viewportSize[1] = height;
      this.scaledViewportSize[0] = width / this.tileScale;
      this.scaledViewportSize[1] = height / this.tileScale;
    }
    setTileScale(scale) {
      this.tileScale = scale;
      this.scaledViewportSize[0] = this.viewportSize[0] / scale;
      this.scaledViewportSize[1] = this.viewportSize[1] / scale;
    }
    setFiltered(filtered) {
      const { gl } = this;
      this.filtered = filtered;
      gl.bindTexture(gl.TEXTURE_2D, this.spriteSheet);
      if (filtered) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
    }
    setSpriteSheet(src) {
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
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        this.inverseSpriteTextureSize[0] = 1 / image.width;
        this.inverseSpriteTextureSize[1] = 1 / image.height;
      });
    }
    addTileLayer(src, layerId, scrollScaleX, scrollScaleY) {
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
    draw(x, y) {
      const {
        gl,
        inverseSpriteTextureSize,
        layers,
        quadVertBuffer,
        scaledViewportSize,
        spriteSheet,
        tilemapShader: shader,
        tileScale: tileScale2,
        tileSize: tileSize2
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
      gl.uniform1f(shader.uniform.tileSize, tileSize2);
      gl.uniform1f(shader.uniform.inverseTileSize, 1 / tileSize2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(shader.uniform.sprites, 0);
      gl.bindTexture(gl.TEXTURE_2D, spriteSheet);
      gl.activeTexture(gl.TEXTURE1);
      gl.uniform1i(shader.uniform.tiles, 1);
      for (let i = layers.length; i >= 0; --i) {
        const layer = layers[i];
        if (layer) {
          if (layer.dirty)
            layer.refresh();
          gl.uniform2f(
            shader.uniform.viewOffset,
            Math.floor(x * tileScale2 * layer.scrollScaleX),
            Math.floor(y * tileScale2 * layer.scrollScaleY)
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
  };

  // res/map.png
  var map_default = "./map-LISM5JAL.png";

  // res/tiles.png
  var tiles_default = "./tiles-FR35NWYW.png";

  // src/index.ts
  var tileSize = 16;
  var tileScale = 2;
  function init() {
    const container = document.createElement("div");
    container.id = "main";
    document.body.append(container);
    const panel = document.createElement("div");
    panel.id = "panel";
    const selector = document.createElement("div");
    selector.id = "selector";
    selector.style.width = `${tileSize * tileScale}px`;
    selector.style.height = `${tileSize * tileScale}px`;
    const [tilesCanvas, tiles2d] = getCanvasAndContext("2d");
    panel.append(tilesCanvas);
    panel.append(selector);
    let tileX = NaN;
    let tileY = NaN;
    const chooseTile = (x, y) => {
      tileX = x;
      tileY = y;
      const size = tileSize * tileScale;
      selector.style.left = `${x * size}px`;
      selector.style.top = `${y * size}px`;
    };
    getImage(tiles_default).then((image) => {
      const width = image.naturalWidth * tileScale;
      const height = image.naturalHeight * tileScale;
      tilesCanvas.width = width;
      tilesCanvas.height = height;
      panel.style.flexBasis = `${width}px`;
      tiles2d.imageSmoothingEnabled = false;
      tiles2d.drawImage(image, 0, 0, width, height);
      chooseTile(0, 0);
      tilesCanvas.addEventListener("click", (e) => {
        const size = tileSize * tileScale;
        const x = Math.floor(e.offsetX / size);
        const y = Math.floor(e.offsetY / size);
        chooseTile(x, y);
      });
      main.addEventListener("click", (e) => {
        const size = tileSize * tileScale;
        const x = Math.floor(e.offsetX / size);
        const y = Math.floor(e.offsetY / size);
        if (map.contains(x, y)) {
          const [u, v] = map.get(x, y);
          if (tileX === u && tileY === v)
            map.draw(x, y, 255, 255);
          else
            map.draw(x, y, tileX, tileY);
        }
      });
      onResize();
    });
    const [main, gl] = getCanvasAndContext("webgl");
    main.id = "game";
    gl.clearColor(0, 0, 0.1, 1);
    gl.clearDepth(1);
    const tm = new TileMap(gl);
    tm.setSpriteSheet(tiles_default);
    tm.tileSize = tileSize;
    tm.setTileScale(tileScale);
    const map = tm.addTileLayer(map_default, 0);
    const getMainSize = () => {
      const width = window.innerWidth - tilesCanvas.width;
      const height = window.innerHeight;
      return [width / window.devicePixelRatio, height / window.devicePixelRatio];
    };
    const onResize = () => {
      const [width, height] = getMainSize();
      main.width = width;
      main.height = height;
      gl.viewport(0, 0, width, height);
      tm.resizeViewport(width, height);
    };
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);
    const draw = () => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      tm.draw(0, 0);
    };
    const tick = (time) => {
      draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.g = tm;
    container.append(panel, main);
  }
  window.addEventListener("load", init);
})();
//# sourceMappingURL=bundle.js.map
