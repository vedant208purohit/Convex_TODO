interface ImportMetaGlob {
  (pattern: string | string[], options?: any): Record<string, () => Promise<any>>;
}

interface ImportMeta {
  readonly glob: ImportMetaGlob;
}
