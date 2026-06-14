import type { ChatMessage } from '../types';

export function conversationForkSeedMessages(
  messages: readonly ChatMessage[],
  forkAfterMessageId: string,
): ChatMessage[] {
  const forkIndex = messages.findIndex((message) => message.id === forkAfterMessageId);
  if (forkIndex < 0) return [];
  return messages.slice(0, forkIndex + 1).map(forkSeedMessage);
}

function forkSeedMessage(message: ChatMessage): ChatMessage {
  const seed: ChatMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
  };
  if (message.agentId !== undefined) seed.agentId = message.agentId;
  if (message.agentName !== undefined) seed.agentName = message.agentName;
  if (message.feedback !== undefined) seed.feedback = {
    createdAt: message.feedback.createdAt,
    rating: message.feedback.rating,
    ...(message.feedback.reasonCodes !== undefined ? { reasonCodes: [...message.feedback.reasonCodes] } : {}),
    ...(message.feedback.customReason !== undefined ? { customReason: message.feedback.customReason } : {}),
    ...(message.feedback.reasonsSubmittedAt !== undefined ? { reasonsSubmittedAt: message.feedback.reasonsSubmittedAt } : {}),
    ...(message.feedback.updatedAt !== undefined ? { updatedAt: message.feedback.updatedAt } : {}),
  };
  return seed;
}
