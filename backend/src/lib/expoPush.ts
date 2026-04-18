type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Sends via Expo Push API (works with Expo push tokens from the mobile app).
 * Failures are logged only so care workflows are never blocked by push.
 */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => typeof m.to === 'string' && m.to.length > 8);
  if (valid.length === 0) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valid),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[expo-push] send failed', res.status, text);
    }
  } catch (e) {
    console.warn('[expo-push] send error', e);
  }
}
