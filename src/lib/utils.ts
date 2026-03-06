import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 리뷰 내용 등 '- ' 로 시작하는 불릿을 1. 2. 3. 형식으로 변환 */
export function bulletToNumbered(text: string | undefined): string {
  if (!text || typeof text !== "string") return "";
  const lines = text.split("\n");
  let num = 0;
  return lines
    .map((line) => {
      const trimmed = line.trim();
      const isBullet = /^[-–—]\s*/.test(trimmed) || (trimmed.startsWith("-") && trimmed.length > 1);
      if (isBullet) {
        num += 1;
        return `${num}. ${trimmed.replace(/^[-–—]\s*/, "").trim()}`;
      }
      num = 0; // reset on non-bullet so next bullet block starts at 1
      return trimmed;
    })
    .join("\n");
}
