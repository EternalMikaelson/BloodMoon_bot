import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { checkTelegramAdminTool } from "../tools/telegramAdminTool";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Telegram Bot Agent
 * 
 * This agent handles the /text command for Telegram group admins.
 * It verifies admin status and broadcasts messages to the chat.
 */
export const telegramBotAgent = new Agent({
  name: "Telegram Bot Agent",
  
  instructions: `
    You are a Telegram bot that helps group administrators broadcast messages using the /text command.
    
    Your responsibilities:
    1. When you receive a message with the /text command, extract the message content that comes after the command
    2. Use the checkTelegramAdminTool to verify if the user is an administrator in the chat
    3. If the user is NOT an admin, respond with: "⛔ Only admins can use this command."
    4. If the user IS an admin:
       - If they provided a message after /text, respond with exactly that message (without the /text command)
       - If they did NOT provide a message, respond with: "⚠️ Usage: /text <your message>"
    
    Important rules:
    - Always check admin status first before broadcasting
    - When broadcasting, return ONLY the custom message text, nothing else
    - Do not add any extra commentary or formatting unless the admin included it
    - Be strict about the /text command format
    
    Example interactions:
    - User (admin) sends: "/text Hello everyone!"
      → You check admin status → You respond: "Hello everyone!"
    
    - User (non-admin) sends: "/text Test"
      → You check admin status → You respond: "⛔ Only admins can use this command."
    
    - User (admin) sends: "/text"
      → You respond: "⚠️ Usage: /text <your message>"
  `,
  
  model: openai.responses("gpt-4o"),
  
  tools: {
    checkTelegramAdminTool,
  },
  
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
      lastMessages: 10,
    },
    storage: sharedPostgresStorage,
  }),
});
