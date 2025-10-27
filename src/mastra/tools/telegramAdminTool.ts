import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Tool to check if a user is an admin in a Telegram group/channel
 */
export const checkTelegramAdminTool = createTool({
  id: "check-telegram-admin",
  description: "Checks if a user is an administrator in a Telegram chat",
  
  inputSchema: z.object({
    chatId: z.union([z.string(), z.number()]).describe("Chat ID where to check admin status"),
    userId: z.number().describe("User ID to check"),
  }),
  
  outputSchema: z.object({
    isAdmin: z.boolean().describe("Whether the user is an admin"),
    status: z.string().optional().describe("Admin status: creator, administrator, member, etc."),
    error: z.string().optional().describe("Error message if check failed"),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [CheckTelegramAdmin] Starting execution with params:', context);
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger?.error('❌ [CheckTelegramAdmin] TELEGRAM_BOT_TOKEN not found');
      return {
        isAdmin: false,
        error: "Bot token not configured",
      };
    }
    
    try {
      logger?.info('📝 [CheckTelegramAdmin] Checking admin status for user', { 
        userId: context.userId, 
        chatId: context.chatId 
      });
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMember`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: context.chatId,
            user_id: context.userId,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.ok) {
        logger?.error('❌ [CheckTelegramAdmin] Telegram API error', data);
        return {
          isAdmin: false,
          error: data.description || "Failed to check admin status",
        };
      }
      
      const memberStatus = data.result.status;
      const isAdmin = memberStatus === "creator" || memberStatus === "administrator";
      
      logger?.info('✅ [CheckTelegramAdmin] Admin check completed', { 
        isAdmin, 
        status: memberStatus 
      });
      
      return {
        isAdmin,
        status: memberStatus,
      };
    } catch (error) {
      logger?.error('❌ [CheckTelegramAdmin] Exception occurred', error);
      return {
        isAdmin: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Tool to send messages via Telegram
 */
export const sendTelegramMessageTool = createTool({
  id: "send-telegram-message",
  description: "Sends a message to a Telegram chat",
  
  inputSchema: z.object({
    chatId: z.union([z.string(), z.number()]).describe("Chat ID to send message to"),
    text: z.string().describe("Message text to send"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional().describe("ID of the sent message"),
    error: z.string().optional().describe("Error message if send failed"),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [SendTelegramMessage] Starting execution with params:', { 
      chatId: context.chatId, 
      textLength: context.text.length 
    });
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger?.error('❌ [SendTelegramMessage] TELEGRAM_BOT_TOKEN not found');
      return {
        success: false,
        error: "Bot token not configured",
      };
    }
    
    try {
      logger?.info('📝 [SendTelegramMessage] Sending message to chat', { chatId: context.chatId });
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: context.chatId,
            text: context.text,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.ok) {
        logger?.error('❌ [SendTelegramMessage] Telegram API error', data);
        return {
          success: false,
          error: data.description || "Failed to send message",
        };
      }
      
      logger?.info('✅ [SendTelegramMessage] Message sent successfully', { 
        messageId: data.result.message_id 
      });
      
      return {
        success: true,
        messageId: data.result.message_id,
      };
    } catch (error) {
      logger?.error('❌ [SendTelegramMessage] Exception occurred', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
