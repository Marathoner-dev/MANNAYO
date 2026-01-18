/**
 * 주소에서 동/읍/면 단위 추출
 * 예: "서울특별시 강남구 역삼동 123" -> "역삼동"
 * 예: "경기도 성남시 분당구 정자동 456" -> "정자동"
 * 예: "서울특별시 강남구 역삼1동" -> "역삼1동"
 */
export function extractDongEupMyeon(address: string): string | null {
  if (!address || address.trim() === '') {
    return null;
  }

  // 건물명 제거 (괄호 안의 내용 제거)
  let cleanAddress = address.replace(/\s*\([^)]*\)/g, '').trim();

  // 한국 주소 패턴: 시/도 시/군/구 동/읍/면 ...
  // 동/읍/면은 보통 2-4글자 + 동/읍/면 으로 끝남
  // 숫자가 포함될 수 있음 (예: 역삼1동, 정자3동)
  const dongPattern = /([가-힣]+(?:\d+)?(?:동|읍|면))/g;
  
  const matches = cleanAddress.match(dongPattern);
  
  if (matches && matches.length > 0) {
    // 가장 마지막에 나오는 동/읍/면이 실제 주소일 가능성이 높음
    for (let i = matches.length - 1; i >= 0; i--) {
      const dong = matches[i];
      // 시/도, 구/시/군은 제외 (예: "강동구", "서울시" 등)
      // 하지만 너무 엄격하게 필터링하지 않고, 일반적인 패턴만 체크
      if (dong.length > 2 && !dong.match(/^(?:강|송|영|용|광|수|마|양|은|평|파|금|중|북|남|동|서|강동|강서|강남|강북|송파|영등|용산|광진|성동|성북|마포|양천|은평|관악|서초|금천|중랑|노원|도봉)(?:시|도|구|군)$/)) {
        return dong;
      }
    }
    // 모든 게 시/구/군이면 마지막 것 반환
    return matches[matches.length - 1];
  }

  return null;
}

/**
 * 주소를 동/읍/면 단위로 그룹화
 */
export function groupAddressesByDong(
  addresses: Array<{ address: string; [key: string]: any }>
): Map<string, { addresses: string[]; count: number; data: any[] }> {
  const groups = new Map<string, { addresses: string[]; count: number; data: any[] }>();

  addresses.forEach((item) => {
    const dong = extractDongEupMyeon(item.address);
    
    if (dong) {
      if (!groups.has(dong)) {
        groups.set(dong, {
          addresses: [],
          count: 0,
          data: [],
        });
      }

      const group = groups.get(dong)!;
      if (!group.addresses.includes(item.address)) {
        group.addresses.push(item.address);
      }
      group.count++;
      group.data.push(item);
    }
  });

  return groups;
}
