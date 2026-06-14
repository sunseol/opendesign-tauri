import {
  $applyNodeReplacement,
  TextNode,
  type DOMConversionMap,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from 'lexical';

import {
  inlineMentionToken,
  type InlineMentionEntity,
  type InlineMentionKind,
} from '../../utils/inlineMentions';

export type SerializedMentionNode = Spread<
  {
    mentionId: string;
    mentionKind: InlineMentionKind;
    mentionLabel: string;
    mentionTitle?: string;
    mentionToken: string;
  },
  SerializedTextNode
>;

function normalizedMentionEntity(entity: InlineMentionEntity): InlineMentionEntity {
  const token = entity.token ?? inlineMentionToken(entity.label);
  return {
    id: entity.id,
    kind: entity.kind,
    label: entity.label,
    token,
    ...(entity.title ? { title: entity.title } : {}),
  };
}

function syncMentionDom(dom: HTMLElement, entity: InlineMentionEntity): void {
  dom.classList.add('composer-inline-mention', `composer-inline-mention--${entity.kind}`);
  dom.dataset.mentionId = entity.id;
  dom.dataset.mentionKind = entity.kind;
  dom.dataset.mentionLabel = entity.label;
  dom.dataset.mentionToken = entity.token ?? inlineMentionToken(entity.label);
  dom.setAttribute('contenteditable', 'false');
  dom.setAttribute('spellcheck', 'false');
  if (entity.title) {
    dom.title = entity.title;
  } else {
    dom.removeAttribute('title');
  }
}

export class MentionNode extends TextNode {
  __mentionId: string;
  __mentionKind: InlineMentionKind;
  __mentionLabel: string;
  __mentionTitle: string | null;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.getMentionEntity(), node.__text, node.__key);
  }

  constructor(entity: InlineMentionEntity, text?: string, key?: NodeKey) {
    const normalized = normalizedMentionEntity(entity);
    super(text ?? normalized.token, key);
    this.__mentionId = normalized.id;
    this.__mentionKind = normalized.kind;
    this.__mentionLabel = normalized.label;
    this.__mentionTitle = normalized.title ?? null;
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const entity: InlineMentionEntity = {
      id: serializedNode.mentionId,
      kind: serializedNode.mentionKind,
      label: serializedNode.mentionLabel,
      token: serializedNode.mentionToken,
      ...(serializedNode.mentionTitle ? { title: serializedNode.mentionTitle } : {}),
    };
    return $createMentionNode(entity).updateFromJSON(serializedNode).setMode('token');
  }

  getMentionEntity(): InlineMentionEntity {
    const self = this.getLatest();
    return {
      id: self.__mentionId,
      kind: self.__mentionKind,
      label: self.__mentionLabel,
      token: self.getTextContent(),
      ...(self.__mentionTitle ? { title: self.__mentionTitle } : {}),
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    syncMentionDom(dom, this.getMentionEntity());
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const shouldRemount = super.updateDOM(prevNode, dom, config);
    syncMentionDom(dom, this.getMentionEntity());
    return shouldRemount;
  }

  exportJSON(): SerializedMentionNode {
    const entity = this.getMentionEntity();
    return {
      ...super.exportJSON(),
      mentionId: entity.id,
      mentionKind: entity.kind,
      mentionLabel: entity.label,
      mentionToken: entity.token ?? inlineMentionToken(entity.label),
      mode: 'token',
      type: 'mention',
      version: 1,
      ...(entity.title ? { mentionTitle: entity.title } : {}),
    };
  }

  isToken(): boolean {
    return true;
  }

  isTextEntity(): boolean {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createMentionNode(entity: InlineMentionEntity): MentionNode {
  return $applyNodeReplacement(new MentionNode(entity)).setMode('token');
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
