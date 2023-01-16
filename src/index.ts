import TileMap from "./renderer/TileMap";
import getCanvasAndContext from "./getCanvasAndContext";
import getImage from "./getImage";
import mapUrl from "../res/map.png";
import tilesUrl from "../res/tiles.png";

const tileSize = 16;
const tileScale = 2;

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
  const chooseTile = (x: number, y: number) => {
    tileX = x;
    tileY = y;

    const size = tileSize * tileScale;
    selector.style.left = `${x * size}px`;
    selector.style.top = `${y * size}px`;
  };

  getImage(tilesUrl).then((image) => {
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
        if (tileX === u && tileY === v) map.draw(x, y, 255, 255);
        else map.draw(x, y, tileX, tileY);
      }
    });

    onResize();
  });

  const [main, gl] = getCanvasAndContext("webgl");
  main.id = "game";
  gl.clearColor(0.0, 0.0, 0.1, 1.0);
  gl.clearDepth(1.0);

  const tm = new TileMap(gl);
  tm.setSpriteSheet(tilesUrl);
  tm.tileSize = tileSize;
  tm.setTileScale(tileScale);
  const map = tm.addTileLayer(mapUrl, 0);

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

  const tick = (time: number) => {
    draw();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  (window as any).g = tm;

  container.append(panel, main);
}

window.addEventListener("load", init);
