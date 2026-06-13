export type LocalDesignSystemImportResult = {
  readonly id: string;
  readonly dir: string;
  readonly files: string[];
};

export type LocalDesignSystemImportOptions = {
  readonly now?: Date;
  readonly name?: string;
  readonly fallbackName?: string;
  readonly reservedIds?: Iterable<string>;
  readonly source?: DesignSystemProjectSource;
  readonly importMode?: 'normalized' | 'hybrid' | 'verbatim';
  readonly craftApplies?: string[];
};

export type DesignSystemProjectSource =
  | {
    readonly type: 'local';
    readonly path: string;
    readonly importedAt?: string;
  }
  | {
    readonly type: 'github';
    readonly url: string;
    readonly branch?: string;
    readonly commit?: string;
    readonly importedAt?: string;
  }
  | {
    readonly type: 'shadcn';
    readonly reference: string;
    readonly registryUrl?: string;
    readonly item?: string;
    readonly homepage?: string;
    readonly importedAt?: string;
  };
