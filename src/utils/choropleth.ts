import * as turf from '@turf/turf';
import { debugLog, debugError } from './debug';

/**
 * 행정구역 GeoJSON Feature 타입
 */
export interface AdministrativeBoundary {
  type: 'Feature';
  properties: {
    code?: string; // 행정구역 코드
    name: string; // 행정구역명 (예: "강남구", "역삼동")
    sig_kor_nm?: string; // 시군구명 (시군구 단위인 경우)
    emd_kor_nm?: string; // 읍면동명 (행정동 단위인 경우)
    count?: number; // 집계된 주소 개수
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/**
 * 행정구역 GeoJSON FeatureCollection 타입
 */
export interface AdministrativeBoundaryCollection {
  type: 'FeatureCollection';
  features: AdministrativeBoundary[];
}

/**
 * 행정구역별 집계 결과
 */
export interface AdministrativeAggregation {
  name: string; // 행정구역명
  code?: string; // 행정구역 코드
  count: number; // 주소 개수
  coordinates: Array<{ lat: number; lng: number }>; // 해당 행정구역의 좌표들
  addresses: string[]; // 주소 목록
}

/**
 * Point-in-Polygon: 좌표가 어떤 행정구역 폴리곤에 속하는지 확인
 */
export function findAdministrativeBoundary(
  lat: number,
  lng: number,
  boundaries: AdministrativeBoundary[]
): AdministrativeBoundary | null {
  const point = turf.point([lng, lat]); // GeoJSON은 [lng, lat] 순서

  for (const boundary of boundaries) {
    try {
      // boundary를 Feature<Polygon | MultiPolygon>으로 타입 단언하여 사용
      // @turf/turf의 booleanPointInPolygon은 Feature<Polygon | MultiPolygon>을 기대함
      // boundary의 geometry는 이미 'Polygon' | 'MultiPolygon' 타입이므로 타입 단언 사용
      if (turf.booleanPointInPolygon(point, boundary as any)) {
        return boundary;
      }
    } catch (error) {
      debugError('CHOROPLETH', 'Point-in-Polygon 연산 실패', error);
      continue;
    }
  }

  return null;
}

/**
 * 좌표 리스트를 행정구역별로 그룹화
 */
export function aggregateByAdministrativeBoundary(
  coordinates: Array<{ lat: number; lng: number; address: string }>,
  boundaries: AdministrativeBoundary[]
): Map<string, AdministrativeAggregation> {
  const aggregationMap = new Map<string, AdministrativeAggregation>();

  // 행정구역별 집계 초기화
  boundaries.forEach((boundary) => {
    const name = boundary.properties.name;
    if (!aggregationMap.has(name)) {
      aggregationMap.set(name, {
        name,
        code: boundary.properties.code,
        count: 0,
        coordinates: [],
        addresses: [],
      });
    }
  });

  // 각 좌표를 행정구역에 매핑
  coordinates.forEach(({ lat, lng, address }) => {
    const boundary = findAdministrativeBoundary(lat, lng, boundaries);

    if (boundary) {
      const name = boundary.properties.name;
      const aggregation = aggregationMap.get(name);

      if (aggregation) {
        aggregation.count++;
        aggregation.coordinates.push({ lat, lng });
        if (!aggregation.addresses.includes(address)) {
          aggregation.addresses.push(address);
        }
      }
    } else {
      // 행정구역을 찾지 못한 경우 "기타" 카테고리로 분류 (선택사항)
      debugLog('CHOROPLETH', `행정구역을 찾을 수 없는 좌표: (${lat}, ${lng}) - ${address}`);
    }
  });

  return aggregationMap;
}

/**
 * Zoom level에 따라 행정구역 단위로 재집계
 * @param aggregationMap 기존 집계 결과 (행정동 단위)
 * @param boundaries 행정구역 경계 데이터
 * @param aggregationUnit 집계 단위 ('sido' | 'sgg' | 'dong')
 * @returns 재집계된 결과
 */
export function reaggregateByUnit(
  aggregationMap: Map<string, AdministrativeAggregation>,
  boundaries: AdministrativeBoundary[],
  aggregationUnit: 'sido' | 'sgg' | 'dong'
): Map<string, AdministrativeAggregation> {
  const reaggregatedMap = new Map<string, AdministrativeAggregation>();

  // 각 집계 결과를 단위별로 재그룹화
  aggregationMap.forEach((aggregation, dongName) => {
    // 해당 행정동의 boundary 찾기
    const boundary = boundaries.find(b => b.properties.name === dongName);
    if (!boundary) return;

    // 행정구역명 파싱
    const parts = dongName.trim().split(/\s+/);
    let unitName = '';
    
    switch (aggregationUnit) {
      case 'sido':
        unitName = parts[0] || dongName; // 시도만
        break;
      case 'sgg':
        unitName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || dongName; // 시도 시군구
        break;
      case 'dong':
        unitName = dongName; // 전체 (행정동)
        break;
    }

    // 재집계
    if (!reaggregatedMap.has(unitName)) {
      reaggregatedMap.set(unitName, {
        name: unitName,
        code: undefined,
        count: 0,
        coordinates: [],
        addresses: [],
      });
    }

    const reaggregation = reaggregatedMap.get(unitName)!;
    reaggregation.count += aggregation.count;
    reaggregation.coordinates.push(...aggregation.coordinates);
    aggregation.addresses.forEach(addr => {
      if (!reaggregation.addresses.includes(addr)) {
        reaggregation.addresses.push(addr);
      }
    });
  });

  return reaggregatedMap;
}

/**
 * 집계값을 기반으로 색상 계산 (100단계 빨간색 계열)
 * @param count 집계 건수
 * @param minCount 최소 건수
 * @param maxCount 최대 건수
 * @returns 색상 hex 코드
 */
export function calculateColorByCount(
  count: number,
  minCount: number,
  maxCount: number
): string {
  if (maxCount === minCount) {
    return '#fca5a5'; // 모두 같으면 밝은 빨간색 (테스트용)
  }

  // 고정 100단계 색상 구간 사용
  const steps = 100;

  const ratio = (count - minCount) / (maxCount - minCount);
  const stepIndex = Math.min(Math.floor(ratio * steps), steps - 1);

  // 빨간색 계열 색상 팔레트 생성 (100단계) - 테스트용 진한 색상
  // 가장 밝은 빨간색 (#fca5a5) → 가장 진한 빨간색 (#7f1d1d)
  const generateRedPalette = (totalSteps: number): string[] => {
    const palette: string[] = [];
    for (let i = 0; i < totalSteps; i++) {
      const t = i / (totalSteps - 1); // 0 ~ 1
      
      // RGB 보간: 밝은 빨강(252, 165, 165) → 진한 빨강(127, 29, 29) - 테스트용 더 진하게
      const r = Math.round(252 - (252 - 127) * t);
      const g = Math.round(165 - (165 - 29) * t);
      const b = Math.round(165 - (165 - 29) * t);
      
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      palette.push(hex);
    }
    return palette;
  };

  const palette = generateRedPalette(steps);
  return palette[stepIndex];
}

/**
 * 행정구역 GeoJSON 데이터 로드
 * @param url GeoJSON 파일 URL (public 폴더 기준 또는 외부 URL)
 */
export async function loadAdministrativeBoundaries(
  url: string
): Promise<AdministrativeBoundary[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GeoJSON 로드 실패: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('유효하지 않은 GeoJSON 형식입니다.');
    }

    // properties 필드 정규화 (adm_nm -> name 등)
    const normalizedFeatures: AdministrativeBoundary[] = data.features.map((feature: any) => {
      const properties = feature.properties || {};
      
      return {
        ...feature,
        properties: {
          ...properties,
          // adm_nm이 있으면 name으로 매핑, 없으면 기존 name 사용
          name: properties.adm_nm || properties.name || '',
          // 코드 필드도 정규화 (adm_cd, adm_cd2 등)
          code: properties.adm_cd || properties.adm_cd2 || properties.code,
          // 기타 필드도 유지
          ...properties,
        },
      };
    });

    debugLog('CHOROPLETH', `행정구역 GeoJSON 로드 완료`, { count: normalizedFeatures.length });
    
    return normalizedFeatures;
  } catch (error) {
    debugError('CHOROPLETH', '행정구역 GeoJSON 로드 실패', error);
    throw error;
  }
}
