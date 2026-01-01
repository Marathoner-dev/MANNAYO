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
  createdBy: string;
  participants: string[];
  createdAt: Date;
}

export interface Availability {
  id: string;
  calendarId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  isUnavailable: boolean;
  createdAt: Date;
}

export interface CalendarWithDetails extends Omit<Calendar, 'participants'> {
  participants: User[];
  availability: Availability[];
}


