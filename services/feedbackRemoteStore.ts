
import { withAutoRetry } from "../utils/retry";
import { BACKEND_URL } from "./apiConfig";

// URL agora vem do apiConfig
const API_URL = BACKEND_URL;

export type FeedbackType = "like" | "dislike";

export interface RemoteFeedbackPayload {
  feedbackId: string;
  sessionId: string;
  messageId: string;
  sectionKey: string | null;
  sectionTitle: string | null;
  type: FeedbackType;
  comment: string;
  aiContent: string;
  userId: string;
  userName?: string;
  timestamp: string;
}

export async function sendFeedbackRemote(entry: RemoteFeedbackPayload) {
  const payload = { 
    action: "feedback", // Explicit action just in case
    feedback: entry 
  };

  const apiCall = async () => {
    const res = await fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        // CRITICAL FOR APPS SCRIPT CORS: Use text/plain
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    
    // Safely read body once
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid JSON response from server");
    }

    if (!data.ok) throw new Error("Feedback API Error");
    return true;
  };

  try {
    return await withAutoRetry('Feedback:send', apiCall, { maxRetries: 2 });
  } catch (error) {
    console.error("Feedback failed after retries", error);
    return false;
  }
}
