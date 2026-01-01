/**
 * 개발 모드 확인
 */
export const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * 디버그 로그 (개발 모드에서만 출력)
 */
export function debugLog(tag: string, message: string, data?: any) {
  if (isDev) {
    console.log(`[${tag}] ${message}`, data || '');
  }
}

/**
 * 디버그 에러 (개발 모드에서만 상세 출력)
 */
export function debugError(tag: string, message: string, error: any) {
  if (isDev) {
    console.error(`[${tag}] ${message}`, error);
    if (error instanceof Error) {
      console.error(`[${tag}] Stack:`, error.stack);
    }
  } else {
    // 프로덕션에서는 간단한 로그만
    console.error(`[${tag}] ${message}`);
  }
}

/**
 * 성능 측정 헬퍼
 */
export function measurePerformance<T>(
  tag: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isDev) {
    return fn();
  }

  const start = performance.now();
  return fn().then((result) => {
    const end = performance.now();
    debugLog('PERF', `${tag} took ${(end - start).toFixed(2)}ms`);
    return result;
  });
}

/**
 * 함수 실행 추적
 */
export function traceFunction<T extends (...args: any[]) => any>(
  tag: string,
  fn: T
): T {
  if (!isDev) {
    return fn;
  }

  return ((...args: any[]) => {
    debugLog('TRACE', `${tag} called`, { args });
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result
          .then((res) => {
            debugLog('TRACE', `${tag} resolved`, { result: res });
            return res;
          })
          .catch((err) => {
            debugError('TRACE', `${tag} rejected`, err);
            throw err;
          });
      }
      debugLog('TRACE', `${tag} returned`, { result });
      return result;
    } catch (error) {
      debugError('TRACE', `${tag} threw`, error);
      throw error;
    }
  }) as T;
}

