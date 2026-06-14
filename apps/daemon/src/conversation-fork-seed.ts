import type {
  ChatMessage,
  ChatMessageFeedback,
  ChatMessageFeedbackReasonCode,
  ChatMessageFeedbackRating,
  Conversation,
} from '@open-design/contracts';

type SeedConversationMessage = Readonly<Pick<ChatMessage, 'content' | 'id' | 'role'>> &
  Partial<Pick<ChatMessage,
    | 'agentId'
    | 'agentName'
    | 'attachments'
    | 'commentAttachments'
    | 'events'
    | 'feedback'
    | 'preTurnFileNames'
    | 'producedFiles'
  >>;

interface SeedConversationForkDeps<Db> {
  readonly body: Record<string, unknown>;
  readonly db: Db;
  readonly getConversation: (db: Db, conversationId: string) => Pick<Conversation, 'projectId'> | null | undefined;
  readonly listMessages: (db: Db, conversationId: string) => ChatMessage[];
  readonly projectId: string;
  readonly randomId: () => string;
  readonly targetConversationId: string;
  readonly upsertMessage: (db: Db, conversationId: string, message: ChatMessage) => unknown;
}

export function requestBodyObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function seedConversationForkMessages<Db>({
  body,
  db,
  getConversation,
  listMessages,
  projectId,
  randomId,
  targetConversationId,
  upsertMessage,
}: SeedConversationForkDeps<Db>): void {
  const seedMessages =
    seedMessagesFromRequest(body) ??
    seedMessagesFromSource({
      body,
      db,
      getConversation,
      listMessages,
      projectId,
    });
  if (!seedMessages || seedMessages.length === 0) return;
  for (const message of seedMessages) {
    upsertMessage(db, targetConversationId, forkedConversationMessage(message, randomId));
  }
}

function seedMessagesFromRequest(body: Record<string, unknown>): SeedConversationMessage[] | null {
  if (!Array.isArray(body.seedMessages)) return null;
  return body.seedMessages
    .map(seedMessageFromUnknown)
    .filter(isSeedConversationMessage);
}

function seedMessagesFromSource<Db>({
  body,
  db,
  getConversation,
  listMessages,
  projectId,
}: Pick<SeedConversationForkDeps<Db>, 'body' | 'db' | 'getConversation' | 'listMessages' | 'projectId'>): SeedConversationMessage[] | null {
  if (typeof body.seedFromConversationId !== 'string' || !body.seedFromConversationId) return null;
  const source = getConversation(db, body.seedFromConversationId);
  if (!source || source.projectId !== projectId) return null;
  const messages = listMessages(db, body.seedFromConversationId);
  if (typeof body.forkAfterMessageId !== 'string' || !body.forkAfterMessageId) return messages;
  const forkIndex = messages.findIndex((message) => message.id === body.forkAfterMessageId);
  return forkIndex >= 0 ? messages.slice(0, forkIndex + 1) : [];
}

function seedMessageFromUnknown(value: unknown): SeedConversationMessage | null {
  if (!isRecord(value)) return null;
  const { content, id, role } = value;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof content !== 'string' || typeof id !== 'string' || id.length === 0) return null;

  const message: SeedConversationMessage = { content, id, role };
  if (typeof value.agentId === 'string') message.agentId = value.agentId;
  if (typeof value.agentName === 'string') message.agentName = value.agentName;
  const feedback = feedbackFromUnknown(value.feedback);
  if (feedback) message.feedback = feedback;
  return message;
}

function isSeedConversationMessage(value: SeedConversationMessage | null): value is SeedConversationMessage {
  return value !== null;
}

function forkedConversationMessage(message: SeedConversationMessage, randomId: () => string): ChatMessage {
  const forked: ChatMessage = {
    id: randomId(),
    role: message.role,
    content: message.content,
  };
  if (typeof message.agentId === 'string') forked.agentId = message.agentId;
  if (typeof message.agentName === 'string') forked.agentName = message.agentName;
  if (message.events) forked.events = [...message.events];
  if (message.attachments) forked.attachments = [...message.attachments];
  if (message.commentAttachments) forked.commentAttachments = [...message.commentAttachments];
  if (message.producedFiles) forked.producedFiles = [...message.producedFiles];
  if (message.feedback) forked.feedback = cloneFeedback(message.feedback);
  if (message.preTurnFileNames) forked.preTurnFileNames = [...message.preTurnFileNames];
  return forked;
}

function cloneFeedback(feedback: ChatMessageFeedback): ChatMessageFeedback {
  const cloned: ChatMessageFeedback = {
    createdAt: feedback.createdAt,
    rating: feedback.rating,
  };
  if (feedback.reasonCodes) cloned.reasonCodes = [...feedback.reasonCodes];
  if (feedback.customReason !== undefined) cloned.customReason = feedback.customReason;
  if (feedback.reasonsSubmittedAt !== undefined) cloned.reasonsSubmittedAt = feedback.reasonsSubmittedAt;
  if (feedback.updatedAt !== undefined) cloned.updatedAt = feedback.updatedAt;
  return cloned;
}

function feedbackFromUnknown(value: unknown): ChatMessageFeedback | undefined {
  if (!isRecord(value)) return undefined;
  const rating = feedbackRatingFromUnknown(value.rating);
  if (!rating || typeof value.createdAt !== 'number') return undefined;
  const feedback: ChatMessageFeedback = {
    createdAt: value.createdAt,
    rating,
  };
  if (typeof value.customReason === 'string') feedback.customReason = value.customReason;
  if (typeof value.reasonsSubmittedAt === 'number') feedback.reasonsSubmittedAt = value.reasonsSubmittedAt;
  if (typeof value.updatedAt === 'number') feedback.updatedAt = value.updatedAt;
  const reasonCodes = feedbackReasonCodesFromUnknown(value.reasonCodes);
  if (reasonCodes) feedback.reasonCodes = reasonCodes;
  return feedback;
}

function feedbackRatingFromUnknown(value: unknown): ChatMessageFeedbackRating | null {
  if (value === 'positive' || value === 'negative') return value;
  return null;
}

function feedbackReasonCodesFromUnknown(value: unknown): ChatMessageFeedbackReasonCode[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isFeedbackReasonCode);
}

function isFeedbackReasonCode(value: unknown): value is ChatMessageFeedbackReasonCode {
  switch (value) {
    case 'matched_request':
    case 'strong_visual':
    case 'useful_structure':
    case 'easy_to_continue':
    case 'followed_design_system':
    case 'missed_request':
    case 'weak_visual':
    case 'incomplete_output':
    case 'hard_to_use':
    case 'missed_design_system':
    case 'other':
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
