/**
 * 폴리곤 최적화 유틸리티
 * 대규모 폴리곤 렌더링 성능 최적화
 */

import type { AdministrativeBoundary } from './choropleth';

/**
 * 폴리곤 단순화 (Douglas-Peucker 알고리즘 간소 버전)
 * 좌표 수를 줄여 렌더링 성능 향상
 */
export function simplifyPolygon(coordinates: number[][], tolerance: number = 0.0001): number[][] {
  if (coordinates.length <= 2) return coordinates;
  
  // 간단한 단순화: 일정 거리 이상 떨어진 점만 유지
  const simplified: number[][] = [coordinates[0]];
  
  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    const next = coordinates[i + 1];
    
    // 현재 점과 이전/다음 점 사이의 각도 계산
    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    
    // 거리 계산
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    // 임계값 이상 떨어진 점만 유지
    if (dist1 > tolerance || dist2 > tolerance) {
      simplified.push(curr);
    }
  }
  
  simplified.push(coordinates[coordinates.length - 1]);
  return simplified;
}

/**
 * 줌 레벨에 따른 폴리곤 단순화 정도 결정
 */
export function getSimplificationTolerance(zoomLevel: number): number {
  // 줌 레벨이 낮을수록 (넓은 범위) 더 단순화
  if (zoomLevel <= 4) return 0.001; // 매우 단순
  if (zoomLevel <= 8) return 0.0005; // 단순
  if (zoomLevel <= 12) return 0.0001; // 약간 단순
  return 0.00005; // 거의 원본 유지
}

/**
 * 폴리곤이 뷰포트와 교차하는지 확인
 */
export function isPolygonInViewport(
  coordinates: number[][],
  viewportSW: { lat: number; lng: number },
  viewportNE: { lat: number; lng: number },
  padding: number = 0.1
): boolean {
  if (coordinates.length === 0) return false;
  
  // 뷰포트에 패딩 추가
  const latPadding = (viewportNE.lat - viewportSW.lat) * padding;
  const lngPadding = (viewportNE.lng - viewportSW.lng) * padding;
  
  const minLat = viewportSW.lat - latPadding;
  const maxLat = viewportNE.lat + latPadding;
  const minLng = viewportSW.lng - lngPadding;
  const maxLng = viewportNE.lng + lngPadding;
  
  // 폴리곤의 경계 박스 계산
  let minPolyLat = Infinity;
  let maxPolyLat = -Infinity;
  let minPolyLng = Infinity;
  let maxPolyLng = -Infinity;
  
  coordinates.forEach(([lng, lat]) => {
    minPolyLat = Math.min(minPolyLat, lat);
    maxPolyLat = Math.max(maxPolyLat, lat);
    minPolyLng = Math.min(minPolyLng, lng);
    maxPolyLng = Math.max(maxPolyLng, lng);
  });
  
  // 경계 박스 교차 확인
  return !(
    maxPolyLat < minLat ||
    minPolyLat > maxLat ||
    maxPolyLng < minLng ||
    minPolyLng > maxLng
  );
}

/**
 * 줌 레벨에 따른 최대 폴리곤 수 제한
 */
export function getMaxPolygonsByZoom(zoomLevel: number): number {
  // 줌 레벨이 낮을수록 (넓은 범위) 더 많은 폴리곤 표시 가능
  // 줌 레벨이 높을수록 (좁은 범위) 적은 폴리곤 표시
  if (zoomLevel <= 4) return 50; // 전국 보기: 최대 50개 (시도 단위)
  if (zoomLevel <= 8) return 200; // 시군구 보기: 최대 200개
  if (zoomLevel <= 12) return 500; // 행정동 보기: 최대 500개
  return 1000; // 매우 상세: 최대 1000개
}

/**
 * 폴리곤 병합 (같은 행정구역 내 여러 폴리곤을 하나로)
 * TODO: turf.js의 union 사용 (현재는 기본 구조만 제공)
 */
export function mergePolygonsOfSameUnit(
  boundaries: AdministrativeBoundary[],
  unitName: string
): number[][][] | null {
  // 같은 단위에 속한 모든 폴리곤 찾기
  const sameUnitBoundaries = boundaries.filter(boundary => {
    const name = boundary.properties.name;
    // 단위 이름 추출 로직 (sido, sgg, dong에 따라 다름)
    // 여기서는 간단히 이름으로 비교
    return name.includes(unitName) || name === unitName;
  });
  
  if (sameUnitBoundaries.length === 0) return null;
  
  // 모든 폴리곤의 좌표 수집
  const allCoordinates: number[][][] = [];
  
  sameUnitBoundaries.forEach(boundary => {
    if (boundary.geometry.type === 'Polygon') {
      const coords = boundary.geometry.coordinates[0] as number[][];
      allCoordinates.push(coords);
    } else if (boundary.geometry.type === 'MultiPolygon') {
      boundary.geometry.coordinates.forEach((polygon: number[][][]) => {
        if (polygon[0]) {
          allCoordinates.push(polygon[0]);
        }
      });
    }
  });
  
  // 실제 병합은 turf.js의 union을 사용해야 함
  // 여기서는 구조만 반환
  return allCoordinates.length > 0 ? allCoordinates : null;
}

/**
 * 좌표 수 기반 폴리곤 필터링
 * 너무 많은 좌표를 가진 폴리곤은 제외 또는 단순화
 */
export function filterPolygonsByCoordinateCount(
  boundaries: AdministrativeBoundary[],
  maxCoordinates: number = 1000
): AdministrativeBoundary[] {
  return boundaries.filter(boundary => {
    let coordCount = 0;
    
    if (boundary.geometry.type === 'Polygon') {
      const coords = boundary.geometry.coordinates[0] as number[][];
      coordCount = coords.length;
    } else if (boundary.geometry.type === 'MultiPolygon') {
      boundary.geometry.coordinates.forEach((polygon: number[][][]) => {
        if (polygon[0]) {
          coordCount += polygon[0].length;
        }
      });
    }
    
    return coordCount <= maxCoordinates;
  });
}
