/**
 * 공유 미리보기 메타 태그 설정 유틸리티
 * 
 * 이 파일은 소셜 미디어 공유 시 표시되는 미리보기 정보를 설정합니다.
 * 각 페이지에서 이 함수를 호출하여 동적으로 메타 태그를 업데이트할 수 있습니다.
 */

interface MetaTagsConfig {
  // ========== 기본 정보 ==========
  /** 페이지 제목 (브라우저 탭에 표시) */
  title?: string;
  
  /** 페이지 설명 (검색 엔진 및 소셜 미디어에 표시) */
  description?: string;
  
  // ========== Open Graph (Facebook, LinkedIn 등) ==========
  /** OG 제목 (공유 시 표시되는 제목) */
  ogTitle?: string;
  
  /** OG 설명 (공유 시 표시되는 설명) */
  ogDescription?: string;
  
  /** OG 이미지 URL (공유 시 표시되는 이미지) */
  ogImage?: string;
  
  /** OG 이미지 너비 (픽셀) */
  ogImageWidth?: string;
  
  /** OG 이미지 높이 (픽셀) */
  ogImageHeight?: string;
  
  /** OG 타입 (website, article 등) */
  ogType?: string;
  
  /** OG URL (공유할 페이지의 전체 URL) */
  ogUrl?: string;
  
  // ========== Twitter Card ==========
  /** Twitter Card 타입 (summary, summary_large_image 등) */
  twitterCard?: string;
  
  /** Twitter 제목 */
  twitterTitle?: string;
  
  /** Twitter 설명 */
  twitterDescription?: string;
  
  /** Twitter 이미지 URL */
  twitterImage?: string;
}

/**
 * 메타 태그를 동적으로 설정하는 함수
 * 
 * @param config 메타 태그 설정 객체
 * 
 * @example
 * ```tsx
 * setMetaTags({
 *   title: '내 달력 - 만나요',
 *   description: '약속 날짜를 조율하는 공유 달력',
 *   ogTitle: '내 달력',
 *   ogDescription: '함께 약속 날짜를 정해보세요!',
 *   ogImage: 'https://example.com/calendar-preview.jpg',
 *   ogUrl: 'https://example.com/calendar/ABC123'
 * });
 * ```
 */
export function setMetaTags(config: MetaTagsConfig) {
  const {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogImageWidth = '1200',
    ogImageHeight = '630',
    ogType = 'website',
    ogUrl,
    twitterCard = 'summary_large_image',
    twitterTitle,
    twitterDescription,
    twitterImage,
  } = config;

  // 기본 제목 설정
  if (title) {
    document.title = title;
    setOrCreateMetaTag('title', title);
  }

  // 기본 설명 설정
  if (description) {
    setOrCreateMetaTag('description', description, 'name');
  }

  // Open Graph 태그 설정
  if (ogTitle) {
    setOrCreateMetaTag('og:title', ogTitle, 'property');
  }
  if (ogDescription) {
    setOrCreateMetaTag('og:description', ogDescription, 'property');
  }
  if (ogImage) {
    setOrCreateMetaTag('og:image', ogImage, 'property');
    setOrCreateMetaTag('og:image:width', ogImageWidth, 'property');
    setOrCreateMetaTag('og:image:height', ogImageHeight, 'property');
  }
  if (ogType) {
    setOrCreateMetaTag('og:type', ogType, 'property');
  }
  if (ogUrl) {
    setOrCreateMetaTag('og:url', ogUrl, 'property');
  }

  // Twitter Card 태그 설정
  if (twitterCard) {
    setOrCreateMetaTag('twitter:card', twitterCard, 'name');
  }
  if (twitterTitle) {
    setOrCreateMetaTag('twitter:title', twitterTitle, 'name');
  } else if (ogTitle) {
    // Twitter 제목이 없으면 OG 제목 사용
    setOrCreateMetaTag('twitter:title', ogTitle, 'name');
  }
  if (twitterDescription) {
    setOrCreateMetaTag('twitter:description', twitterDescription, 'name');
  } else if (ogDescription) {
    // Twitter 설명이 없으면 OG 설명 사용
    setOrCreateMetaTag('twitter:description', ogDescription, 'name');
  }
  if (twitterImage) {
    setOrCreateMetaTag('twitter:image', twitterImage, 'name');
  } else if (ogImage) {
    // Twitter 이미지가 없으면 OG 이미지 사용
    setOrCreateMetaTag('twitter:image', ogImage, 'name');
  }
}

/**
 * 메타 태그를 설정하거나 생성하는 헬퍼 함수
 */
function setOrCreateMetaTag(
  property: string,
  content: string,
  attribute: 'name' | 'property' = 'name'
): void {
  const selector = `meta[${attribute}="${property}"]`;
  let metaTag = document.querySelector(selector) as HTMLMetaElement;

  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute(attribute, property);
    document.head.appendChild(metaTag);
  }

  metaTag.setAttribute('content', content);
}

/**
 * 기본 메타 태그로 리셋하는 함수
 */
export function resetMetaTags() {
  const defaultTitle = '만나요 - Copy, Share, Click';
  const defaultDescription = '여러 사용자가 공동으로 약속 가능일을 조율할 수 있는 공유 달력 서비스';

  setMetaTags({
    title: defaultTitle,
    description: defaultDescription,
    ogTitle: defaultTitle,
    ogDescription: defaultDescription,
    ogImage: `${window.location.origin}/calendar-preview.jpg`,
    ogUrl: window.location.origin,
  });
}

