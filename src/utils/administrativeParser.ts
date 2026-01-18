/**
 * 행정구역명 파싱 및 단위 추출 유틸리티
 */

export interface AdministrativeUnit {
  sido: string; // 시도 (예: "서울특별시")
  sgg: string; // 시군구 (예: "종로구")
  dong: string; // 행정동 (예: "사직동")
  fullName: string; // 전체 이름
}

/**
 * 행정구역명을 파싱하여 시도/시군구/행정동 추출
 * @param admName 행정구역명 (예: "서울특별시 종로구 사직동")
 * @returns 파싱된 행정구역 단위 정보
 */
export function parseAdministrativeName(admName: string): AdministrativeUnit {
  const parts = admName.trim().split(/\s+/);
  
  let sido = '';
  let sgg = '';
  let dong = '';
  
  if (parts.length >= 1) {
    sido = parts[0]; // 시도
  }
  if (parts.length >= 2) {
    sgg = parts[1]; // 시군구
  }
  if (parts.length >= 3) {
    dong = parts.slice(2).join(' '); // 행정동 (나머지 부분)
  }
  
  return {
    sido,
    sgg,
    dong,
    fullName: admName,
  };
}

/**
 * Zoom level에 따라 집계할 행정구역 단위 결정
 * @param zoomLevel 지도 확대 수준 (Kakao Maps는 보통 1-14)
 * @returns 집계 단위 ('sido' | 'sgg' | 'dong')
 * 
 * 줌 숫자 작을수록 (줌인) -> 좁은 범위 (행정동 단위)
 * 줌 숫자 클수록 (줌아웃) -> 넓은 범위 (시도 단위)
 */
export function getAdministrativeUnitByZoom(zoomLevel: number): 'sido' | 'sgg' | 'dong' {
  // 모든 줌 레벨 처리: 1-14 범위를 명시적으로 처리
  // Zoom level이 작을수록 (줌인) -> 좁은 범위 (행정동)
  // Zoom level이 클수록 (줌아웃) -> 넓은 범위 (시도)
  
  // 줌인: level 1-7 -> 행정동 단위 (좁은 영역)
  if (zoomLevel <= 7) {
    return 'dong';
  }
  // 중간: level 8-10 -> 시군구 단위 (중간 영역)
  else if (zoomLevel <= 8) {
    return 'sgg';
  }
  // 줌아웃: level 11-14 (또는 그 이상) -> 시도 단위 (넓은 영역)
  else {
    return 'sido';
  }
}

/**
 * 행정구역 단위에 따라 표시 이름 생성
 * @param unit 파싱된 행정구역 단위
 * @param aggregationUnit 집계 단위
 * @returns 표시 이름
 */
export function getDisplayName(
  unit: AdministrativeUnit,
  aggregationUnit: 'sido' | 'sgg' | 'dong'
): string {
  switch (aggregationUnit) {
    case 'sido':
      return unit.sido;
    case 'sgg':
      return unit.sgg ? `${unit.sido} ${unit.sgg}` : unit.sido;
    case 'dong':
      return unit.fullName;
    default:
      return unit.fullName;
  }
}
