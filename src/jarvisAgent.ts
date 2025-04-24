import axios from "axios";
import { Readable } from "stream";

// Jarvis API configuration
const JARVIS_PORT = process.env.JARVIS_PORT || "8000";
const JARVIS_HOST = process.env.JARVIS_HOST || "localhost";
const JARVIS_URL = `http://${JARVIS_HOST}:${JARVIS_PORT}`;

const USER_EMAIL = process.env.USER_EMAIL || "noone@cisco.com";

interface JarvisChatResponse {
  answer: string;
}

/**
 * Posts a prompt to the Jarvis API. Await should be used to ensure the request
 * is sent before proceeding.
 * 
 * @param chatId chat identifier
 * @param prompt user prompt
 */
export async function postJarvisPrompt(chatId: string, prompt: string): Promise<boolean> {
  console.log(
    "Posting prompt: ", prompt.length > 50
      ? prompt.substring(0, 20) + "..."
      : prompt
  );

  return await axios.post(JARVIS_URL + "/submit_question", {
    chat_id: chatId,
    question: prompt,
  }, {
    headers: { "USER_EMAIL": USER_EMAIL }
  }).then((res) => {
    console.log("Posted:", {
      status: res.status,
      data: res.data,
    });
    return res.status === 200;
  }).catch((err) => {
    console.error("Error: ", err);
    throw new Error("Failed to post Jarvis prompt");
  });
}

/**
 * Retrieves the Jarvis chat response for a given chat ID.
 * 
 * @param chatId chat identifier
 * @returns a promise that resolves to the Jarvis chat response
 */
export async function getJarvisResponse(chatId: string): Promise<JarvisChatResponse> {
  console.log("Getting Jarvis response for chat ID: ", chatId);

  return await axios.get(JARVIS_URL + `/get_answer/${chatId}`, {
    headers: { "USER_EMAIL": USER_EMAIL }
  }).then((res) => {
    if (res.status !== 200) {
      throw new Error("Failed to get Jarvis response");
    }

    console.log("Received response: ", res.data);
    return res.data;
  }).catch((err) => {
    console.error("Error: ", err);
    throw new Error("Failed to get Jarvis response");
  });
}

/**
 * Retrieves the Jarvis chat response as a stream for a given chat ID.
 * 
 * @param chatId chat identifier
 * @returns a promise that resolves to a Readable stream of the Jarvis chat response
 */
export async function getJarvisResponseStream(chatId: string): Promise<Readable> {
  console.log("Getting Jarvis response stream for chat ID: ", chatId);

  return await axios.get(JARVIS_URL + `/get_answer_stream/${chatId}`, {
    headers: { "USER_EMAIL": USER_EMAIL },
    responseType: "stream",
  }).then((res)  => {
    if (res.status !== 200) {
      throw new Error("Failed to get Jarvis response");
    }

    console.log("Received response: stream");
    return res.data as Readable;
  }).catch((err) => {
    console.error("Error: ", err);
    throw new Error("Failed to get Jarvis response stream");
  });
}
