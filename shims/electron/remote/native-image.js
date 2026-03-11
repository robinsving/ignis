export const nativeImageShim = {
  createFromBuffer(buffer) {
    return {
      isEmpty: () => !buffer || buffer.length === 0,
      getSize: () => ({ width: 0, height: 0 }),
      toPNG: () => buffer || new Uint8Array(0),
      toJPEG: (quality) => buffer || new Uint8Array(0),
      toDataURL: () => "",
    };
  },

  createFromPath(filePath) {
    // TODO: could fetch from server and create image
    return nativeImageShim.createFromBuffer(new Uint8Array(0));
  },

  createEmpty() {
    return nativeImageShim.createFromBuffer(new Uint8Array(0));
  },
};
