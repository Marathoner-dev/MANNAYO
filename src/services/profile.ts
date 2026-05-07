import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Profile } from '../types';
import { debugLog, debugError, measurePerformance } from '../utils/debug';

// 프로필에 임의 배정될 색상 팔레트 — 시각적으로 구분되는 32가지 색
// 모바일 작은 아바타에서도 흰 글자 대비가 충분하도록 700/900 레벨 사용
export const PROFILE_COLORS = [
  // Vibrant 700 (16)
  '#b91c1c', // red
  '#c2410c', // orange
  '#b45309', // amber
  '#a16207', // yellow
  '#4d7c0f', // lime
  '#15803d', // green
  '#047857', // emerald
  '#0f766e', // teal
  '#0e7490', // cyan
  '#0369a1', // sky
  '#1d4ed8', // blue
  '#4338ca', // indigo
  '#6d28d9', // violet
  '#7e22ce', // purple
  '#a21caf', // fuchsia
  '#be185d', // pink
  // Deep saturated 900 (16)
  '#7f1d1d', // red dark
  '#7c2d12', // orange dark
  '#78350f', // amber dark
  '#713f12', // yellow dark
  '#365314', // lime dark
  '#14532d', // green dark
  '#064e3b', // emerald dark
  '#134e4a', // teal dark
  '#164e63', // cyan dark
  '#0c4a6e', // sky dark
  '#1e3a8a', // blue dark
  '#312e81', // indigo dark
  '#4c1d95', // violet dark
  '#581c87', // purple dark
  '#701a75', // fuchsia dark
  '#831843', // pink dark
];

/**
 * 사용 중이지 않은 색상 중에서 랜덤 선택
 * 모든 색상이 사용 중이면 전체 팔레트에서 랜덤 선택
 */
export function pickRandomColor(usedColors: string[] = []): string {
  const available = PROFILE_COLORS.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : PROFILE_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 특정 달력의 모든 프로필 조회
 */
export async function getProfilesByCalendar(
  calendarId: string
): Promise<Profile[]> {
  debugLog('PROFILE', 'getProfilesByCalendar 시작', { calendarId });

  return measurePerformance('getProfilesByCalendar', async () => {
    try {
      const profilesRef = collection(db, 'calendars', calendarId, 'profiles');
      const querySnapshot = await getDocs(query(profilesRef));

      const profiles: Profile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        profiles.push({
          id: doc.id,
          calendarId,
          name: data.name,
          color: data.color,
          password: data.password ?? null,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('PROFILE', 'getProfilesByCalendar 완료', {
        calendarId,
        count: profiles.length,
      });

      return profiles;
    } catch (error) {
      debugError('PROFILE', 'getProfilesByCalendar 실패', error);
      throw error;
    }
  });
}

/**
 * 특정 프로필 단건 조회 (저장된 프로필 ID가 여전히 유효한지 검증용)
 */
export async function getProfileById(
  calendarId: string,
  profileId: string
): Promise<Profile | null> {
  try {
    const profileRef = doc(db, 'calendars', calendarId, 'profiles', profileId);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      calendarId,
      name: data.name,
      color: data.color,
      password: data.password ?? null,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  } catch (error) {
    debugError('PROFILE', 'getProfileById 실패', error);
    return null;
  }
}

/**
 * 새 프로필 생성
 */
export async function addProfile(
  calendarId: string,
  name: string,
  color?: string,
  password?: string | null
): Promise<Profile> {
  debugLog('PROFILE', 'addProfile 시작', {
    calendarId,
    name,
    color,
    hasPassword: !!password,
  });

  return measurePerformance('addProfile', async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('이름을 입력해주세요.');
    }

    const trimmedPassword = password ? password.trim() : '';
    const finalPassword: string | null = trimmedPassword ? trimmedPassword : null;

    try {
      let assignedColor = color;
      if (!assignedColor) {
        const existing = await getProfilesByCalendar(calendarId);
        assignedColor = pickRandomColor(existing.map((p) => p.color));
      }

      const profilesRef = collection(db, 'calendars', calendarId, 'profiles');
      const newProfile = {
        name: trimmed,
        color: assignedColor,
        password: finalPassword,
        createdAt: new Date(),
      };

      const docRef = await addDoc(profilesRef, newProfile);
      debugLog('PROFILE', 'addProfile 완료', {
        id: docRef.id,
        calendarId,
        name: trimmed,
        color: assignedColor,
        hasPassword: !!finalPassword,
      });

      return {
        id: docRef.id,
        calendarId,
        ...newProfile,
      };
    } catch (error) {
      debugError('PROFILE', 'addProfile 실패', error);
      throw error;
    }
  });
}

/**
 * 프로필 삭제 — 해당 프로필의 가용성(availability) 기록도 함께 정리
 */
export async function deleteProfile(
  calendarId: string,
  profileId: string
): Promise<void> {
  debugLog('PROFILE', 'deleteProfile 시작', { calendarId, profileId });

  return measurePerformance('deleteProfile', async () => {
    try {
      const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
      const q = query(availabilityRef, where('profileId', '==', profileId));
      const snap = await getDocs(q);

      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'calendars', calendarId, 'profiles', profileId));
      await batch.commit();

      debugLog('PROFILE', 'deleteProfile 완료', {
        calendarId,
        profileId,
        availabilityDeleted: snap.size,
      });
    } catch (error) {
      debugError('PROFILE', 'deleteProfile 실패', error);
      throw error;
    }
  });
}

/**
 * 프로필 변경 실시간 감지
 */
export function subscribeProfiles(
  calendarId: string,
  callback: (profiles: Profile[]) => void
): () => void {
  debugLog('PROFILE', 'subscribeProfiles 시작', { calendarId });

  const profilesRef = collection(db, 'calendars', calendarId, 'profiles');
  const q = query(profilesRef);

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const profiles: Profile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        profiles.push({
          id: doc.id,
          calendarId,
          name: data.name,
          color: data.color,
          password: data.password ?? null,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('PROFILE', 'subscribeProfiles 변경 감지', {
        calendarId,
        count: profiles.length,
      });

      callback(profiles);
    },
    (error) => {
      debugError('PROFILE', 'subscribeProfiles 에러', error);
    }
  );

  return unsubscribe;
}

/**
 * localStorage에 선택한 프로필 ID 저장/조회
 */
const profileKey = (calendarId: string) => `calendar_profile_${calendarId}`;

export function getSelectedProfileId(calendarId: string): string | null {
  try {
    return localStorage.getItem(profileKey(calendarId));
  } catch {
    return null;
  }
}

export function setSelectedProfileId(calendarId: string, profileId: string): void {
  try {
    localStorage.setItem(profileKey(calendarId), profileId);
  } catch (error) {
    debugError('PROFILE', 'setSelectedProfileId 실패', error);
  }
}

export function clearSelectedProfileId(calendarId: string): void {
  try {
    localStorage.removeItem(profileKey(calendarId));
  } catch {
    // ignore
  }
}

/**
 * 프로필별 비밀번호 인증 캐시 (한 번 인증한 프로필은 다시 묻지 않음)
 */
const profileAuthKey = (profileId: string) => `profile_auth_${profileId}`;

export function isProfileAuthenticated(profileId: string): boolean {
  try {
    return localStorage.getItem(profileAuthKey(profileId)) === 'true';
  } catch {
    return false;
  }
}

export function setProfileAuthenticated(profileId: string): void {
  try {
    localStorage.setItem(profileAuthKey(profileId), 'true');
  } catch (error) {
    debugError('PROFILE', 'setProfileAuthenticated 실패', error);
  }
}

export function clearProfileAuthenticated(profileId: string): void {
  try {
    localStorage.removeItem(profileAuthKey(profileId));
  } catch {
    // ignore
  }
}
