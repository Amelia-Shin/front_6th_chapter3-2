import { EventForm } from '../types';

export const generateRepeatEvents = (eventData: EventForm): EventForm[] => {
  const { repeat, date, startTime, endTime, id, ...baseEvent } = eventData;

  if (!repeat || repeat.type === 'none' || !repeat.endDate) {
    return [eventData];
  }

  const events: EventForm[] = [];
  const startDate = new Date(date);
  const endDate = new Date(repeat.endDate);

  let currentDate = new Date(startDate);

  // 시작일부터 종료일까지 반복 일정 생성
  while (currentDate <= endDate) {
    const eventDate = currentDate.toISOString().split('T')[0];

    events.push({
      ...baseEvent,
      date: eventDate,
      startTime,
      endTime,
      repeat: {
        type: repeat.type,
        interval: repeat.interval,
        endDate: repeat.endDate,
      },
    });

    // 다음 반복 날짜 계산
    switch (repeat.type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + repeat.interval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7 * repeat.interval);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + repeat.interval);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + repeat.interval);
        break;
      default:
        currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return events;
};
