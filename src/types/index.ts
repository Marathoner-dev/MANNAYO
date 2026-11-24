export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

/** 확정된 약속 시간 — 시(hour) 단위, end는 미포함 (예: 18~21시 → { start: 18, end: 21 }) */
export interface ConfirmedTime {
  start: number;
  end: number;
}

export interface Calendar {
  id: string;
  title: string;
  code: string;
  usePassword: boolean;
  password: string | null;
  confirmedDate: string | null;
  /** null이면 종일 (또는 날짜 미확정) */
  confirmedTime: ConfirmedTime | null;
  confirmedLocation: string | null;
  createdBy: string;
  participants: string[];
  createdAt: Date;
  // locations 컬렉션에 저장된 지오코딩된 좌표 (optional)
  lat?: number | null;
  lng?: number | null;
}

export interface Availability {
  id: string;
  calendarId: string;
  date: string; // YYYY-MM-DD
  profileId: string;
  isUnavailable: boolean;
  /** 안 되는 시간(0~23시). null 또는 빈 배열이면 종일 불가 */
  busyHours: number[] | null;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  calendarId: string;
  name: string;
  color: string;
  password: string | null;
  createdAt: Date;
}

export interface CalendarWithDetails extends Omit<Calendar, 'participants'> {
  participants: User[];
  availability: Availability[];
}


