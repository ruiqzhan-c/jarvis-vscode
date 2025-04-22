import axios from "axios";

// Jarvis API configuration
const JARVIS_PORT = process.env.JARVIS_PORT || "8000";
const JARVIS_HOST = process.env.JARVIS_HOST || "localhost";
const JARVIS_URL = `http://${JARVIS_HOST}:${JARVIS_PORT}`;

const USER_EMAIL = process.env.USER_EMAIL || "noone@cisco.com";

interface JarvisChatResponse {
  answer: string;
}


export async function postJarvisPrompt(chatId: string, prompt: string) {
  axios.post(JARVIS_URL + "/submit_question", {
    chat_id: chatId,
    question: prompt,
  }, {
    headers: {
      "USER_EMAIL": USER_EMAIL,
    }
  }).then((res) => {
    console.log(res.data);
  });
}

export async function getJarvisResponse(chatId: string): Promise<JarvisChatResponse> {
  return axios.get(JARVIS_URL + `/get_answer/${chatId}`, {
    headers: {
      "USER_EMAIL": USER_EMAIL,
    }
  }).then((res) => {
    console.log(res.data);
    return res.data;
  });
}