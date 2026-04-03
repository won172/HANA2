export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error("빈 응답을 받았습니다.");
  }

  let data: T;

  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("서버 응답을 해석하지 못했습니다.");
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "요청 처리에 실패했습니다.";
    throw new Error(message);
  }

  return data;
}
