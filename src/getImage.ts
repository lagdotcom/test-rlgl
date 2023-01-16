const images: Map<string, Promise<HTMLImageElement>> = new Map();

export default function getImage(src: string) {
  const item = images.get(src);
  if (item) return item;

  const promise = new Promise<HTMLImageElement>((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));

    image.src = src;
  });
  images.set(src, promise);
  return promise;
}
