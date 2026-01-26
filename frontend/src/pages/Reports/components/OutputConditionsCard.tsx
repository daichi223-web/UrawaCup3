// src/pages/Reports/components/OutputConditionsCard.tsx

import type { DateOptions } from '../types';

interface OutputConditionsCardProps {
  date: string;
  setDate: (date: string) => void;
  venueId: string;
  setVenueId: (venueId: string) => void;
  format: 'pdf' | 'excel';
  setFormat: (format: 'pdf' | 'excel') => void;
  venues: { id: number; name: string }[];
  dateOptions: DateOptions;
}

export function OutputConditionsCard({
  date,
  setDate,
  venueId,
  setVenueId,
  format,
  setFormat,
  venues,
  dateOptions,
}: OutputConditionsCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">出力条件</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">日付</label>
            <select
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              <option value="">日付を選択</option>
              <option value="day1">{dateOptions.labels['day1']}</option>
              <option value="day2">{dateOptions.labels['day2']}</option>
              <option value="day3">{dateOptions.labels['day3']}</option>
            </select>
          </div>
          <div>
            <label className="form-label">会場</label>
            <select
              className="form-input"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              <option value="">全会場</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">出力形式</label>
            <select
              className="form-input"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel')}
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
