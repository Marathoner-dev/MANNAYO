/**
 * 달력 페이지 캡처 유틸리티
 * 
 * html-to-image를 사용하여 달력 페이지를 이미지로 변환합니다.
 * 공유 미리보기 이미지로 사용됩니다.
 */

import { toPng } from 'html-to-image';

export interface CaptureOptions {
  /** 이미지 너비 (픽셀) */
  width?: number;
  /** 이미지 높이 (픽셀) */
  height?: number;
  /** 이미지 품질 (0-1) */
  quality?: number;
  /** 픽셀 비율 (고해상도용) */
  pixelRatio?: number;
  /** 배경색 */
  backgroundColor?: string;
}

/**
 * 달력 컨테이너를 이미지로 캡처하는 함수
 * 
 * @param element 캡처할 HTML 요소
 * @param options 캡처 옵션
 * @returns Base64 인코딩된 PNG 이미지 데이터 URL
 * 
 * @example
 * ```tsx
 * const calendarElement = document.querySelector('.calendar-detail-container');
 * if (calendarElement) {
 *   const imageUrl = await captureCalendarImage(calendarElement as HTMLElement);
 *   // 메타 태그에 설정
 *   setMetaTags({ ogImage: imageUrl });
 * }
 * ```
 */
export async function captureCalendarImage(
  element: HTMLElement,
  options?: CaptureOptions
): Promise<string> {
  const {
    width = 1200,
    height = 630,
    quality = 0.95,
    pixelRatio = 2,
    backgroundColor = '#ffffff',
  } = options || {};

  try {
    const dataUrl = await toPng(element, {
      quality,
      width,
      height,
      backgroundColor,
      pixelRatio,
      cacheBust: true,
      // 스타일 필터링 (필요한 스타일만 포함)
      filter: (node) => {
        // script, style 태그 제외
        if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') {
          return false;
        }
        return true;
      },
    });

    return dataUrl;
  } catch (error) {
    console.error('달력 이미지 캡처 실패:', error);
    throw new Error('이미지 캡처에 실패했습니다.');
  }
}

/**
 * 이미지 데이터 URL을 Blob으로 변환
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 이미지 데이터 URL을 다운로드
 */
export function downloadImage(dataUrl: string, filename: string = 'calendar.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

