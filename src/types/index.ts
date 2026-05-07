export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Calendar {
  id: string;
  title: string;
  code: string;
  usePassword: boolean;
  password: string | null;
  confirmedDate: string | null;
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
  createdAt: Date;
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


