declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };
  function convert(options: ConvertOptions): Promise<Buffer>;
  export default convert;
}
