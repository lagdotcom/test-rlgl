type MapContextType = {
  "2d": CanvasRenderingContext2D;
  bitmaprenderer: ImageBitmapRenderingContext;
  webgl: WebGLRenderingContext;
  webgl2: WebGL2RenderingContext;
};

type MapSettingsType = {
  "2d": CanvasRenderingContext2DSettings;
  bitmaprenderer: ImageBitmapRenderingContextSettings;
  webgl: WebGLContextAttributes;
  webgl2: WebGLContextAttributes;
};

type ContextType = keyof MapContextType;

export default function getCanvasAndContext<T extends ContextType>(
  type: T,
  options?: MapSettingsType[T]
): [HTMLCanvasElement, MapContextType[T]] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext(type, options) as MapContextType[T] | null;
  if (!ctx) throw `getContext(${type})`;

  return [canvas, ctx];
}
