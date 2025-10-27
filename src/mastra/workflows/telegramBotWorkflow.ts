import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { telegramBotAgent } from "../agents/telegramBotAgent";

/**
 * Step 1: Process message with agent
 * This step calls the agent to handle the /text command with admin verification
 */
const useAgent = createStep({
  id: "use-agent",
  description: "Process the Telegram message with the bot agent",
  
  inputSchema: z.object({
    message: z.string().describe("The incoming message from Telegram"),
    threadId: z.string().describe("Thread ID for conversation continuity"),
    chatId: z.union([z.string(), z.number()]).describe("Telegram chat ID"),
    userId: z.number().describe("Telegram user ID"),
  }),
  
  outputSchema: z.object({
    response: z.string().describe("Agent's response"),
    chatId: z.union([z.string(), z.number()]).describe("Chat ID to send response to"),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [UseAgent Step] Starting execution with params:', {
      messageLength: inputData.message.length,
      threadId: inputData.threadId,
      chatId: inputData.chatId,
      userId: inputData.userId,
    });
    
    // Construct prompt with context for the agent
    const prompt = `
User message: ${inputData.message}
Chat ID: ${inputData.chatId}
User ID: ${inputData.userId}

Please process this message according to your instructions.
`;
    
    logger?.info('📝 [UseAgent Step] Calling agent with prompt');
    
    const { text } = await telegramBotAgent.generate([
      { role: "user", content: prompt }
    ], {
      resourceId: "telegram-bot",
      threadId: inputData.threadId,
      maxSteps: 5,
    });
    
    logger?.info('✅ [UseAgent Step] Agent responded', { responseLength: text.length });
    
    return {
      response: text,
      chatId: inputData.chatId,
    };
  },
});

/**
 * Step 2: Send reply to Telegram
 * This step sends the agent's response back to the Telegram chat
 */
const sendReply = createStep({
  id: "send-reply",
  description: "Send the bot's response back to Telegram",
  
  inputSchema: z.object({
    response: z.string().describe("The message to send"),
    chatId: z.union([z.string(), z.number()]).describe("Chat ID to send to"),
  }),
  
  outputSchema: z.object({
    success: z.boolean().describe("Whether the message was sent successfully"),
    messageId: z.number().optional().describe("ID of the sent message"),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [SendReply Step] Starting execution', {
      chatId: inputData.chatId,
      responseLength: inputData.response.length,
    });
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger?.error('❌ [SendReply Step] TELEGRAM_BOT_TOKEN not found');
      return {
        success: false,
      };
    }
    
    try {
      logger?.info('📝 [SendReply Step] Sending message to Telegram');
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: inputData.chatId,
            text: inputData.response,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.ok) {
        logger?.error('❌ [SendReply Step] Telegram API error', data);
        return {
          success: false,
        };
      }
      
      logger?.info('✅ [SendReply Step] Message sent successfully', {
        messageId: data.result.message_id,
      });
      
      return {
        success: true,
        messageId: data.result.message_id,
      };
    } catch (error) {
      logger?.error('❌ [SendReply Step] Exception occurred', error);
      return {
        success: false,
      };
    }
  },
});

/**
 * Telegram Bot Workflow
 * Handles incoming Telegram messages with a two-step process:
 * 1. Process with agent (admin verification + message handling)
 * 2. Send response back to Telegram
 */
export const telegramBotWorkflow = createWorkflow({
  id: "telegram-bot-workflow",
  
  inputSchema: z.object({
    message: z.string(),
    threadId: z.string(),
    chatId: z.union([z.string(), z.number()]),
    userId: z.number(),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional(),
  }),
})
  .then(useAgent)
  .then(sendReply)
  .commit();
