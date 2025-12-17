export interface Report {
  id: string;
  connectionId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  notionUrl?: string;
  pdfUrl?: string;
  isMonthly?: boolean;
}

export interface QBConnection {
  id: string;
  realmId: string;
  locationName: string | null;
  hasAccess: boolean;
}

export type ReportMode = 'period' | 'monthly';

export interface SelectedMonth {
  year: number;
  month: number; // 0-11
}
