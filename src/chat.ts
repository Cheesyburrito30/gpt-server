import { Express } from "express";
import SSE from "express-sse-ts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
} from "openai";
import { Database } from "sqlite3";

interface IMessage {
  content: string;
  role: string;
}

export const chatRoutes = (app: Express, db: Database) => {
  const chat = new ChatOpenAI({});
  const sse = new SSE();
  const controller = new AbortController();

  app.get("/events", async (req, res, next) => {
    console.log("sse init");
    sse.init(req, res, next);
  });

  app.post("/abort", async (req, res) => {
    controller.abort();
  });

  app.post("/trigger", async (req, res, next) => {
    const streamedChat = new ChatOpenAI({
      streaming: true,
    });
    updateChatSettings(streamedChat, req.body);
    console.log("starting chat stream");
    console.log("params", req.body);
    await streamedChat.call(
      formatMessages((req.body as CreateChatCompletionRequest).messages),
      {
        signal: controller.signal,
      },
      [
        {
          handleLLMNewToken(token: string) {
            console.log(JSON.stringify(token));
            sse.send(JSON.stringify(token));
          },
        },
      ]
    );
    res.status(200).json({ message: "Chat stream started" });
  });
  app.post("/chat", async (req, res) => {
    console.log("starting chat");
    console.log("params", req.body);
    updateChatSettings(chat, req.body);
    const response = await chat.call(
      formatMessages((req.body as CreateChatCompletionRequest).messages)
    );
    res.status(200).json(response);
  });

  function updateChatSettings(
    chat: ChatOpenAI,
    data: CreateChatCompletionRequest
  ) {
    const {
      model,
      temperature,
      frequency_penalty,
      presence_penalty,
      top_p,
      max_tokens,
      n,
    } = sanitizeValues(data);
    chat.modelName = model;
    chat.frequencyPenalty = frequency_penalty ?? 0;
    chat.presencePenalty = presence_penalty ?? 0;
    chat.topP = top_p ?? 1;
    chat.maxTokens = max_tokens ?? 2086;
    chat.temperature = temperature ?? 0.2;
  }
};

const formatMessages = (messages: ChatCompletionRequestMessage[]) => {
  const formattedMessages = messages.map(({ role, content }) => {
    if (role === "system") {
      return new SystemChatMessage(content);
    }
    if (role === "assistant") {
      return new AIChatMessage(content);
    }
    return new HumanChatMessage(content);
  });
  return formattedMessages;
};

function sanitizeValues({
  temperature,
  max_tokens,
  top_p,
  frequency_penalty,
  presence_penalty,
  n,
  ...rest
}: CreateChatCompletionRequest): CreateChatCompletionRequest {
  return {
    ...rest,
    temperature: parseFloat(`${temperature}`),
    max_tokens: parseInt(`${max_tokens}`, 10),
    top_p: parseFloat(`${top_p}`),
    frequency_penalty: parseFloat(`${frequency_penalty}`),
    presence_penalty: parseFloat(`${presence_penalty}`),
    n: parseInt(`${n}`, 10),
  };
}
