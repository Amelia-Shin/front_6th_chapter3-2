import { EventForm, RepeatType } from '../types';
import { formatDate } from './dateUtils';

export const MAX_REPEAT_END_DATE = '2025-10-30';

/**
 * 반복 일정의 모든 발생 일자를 계산합니다
 */
export function generateRepeatEvents(event: EventForm): EventForm[] {
  const { repeat } = event;

  if (repeat.type === 'none') {
    return [event];
  }

  const events: EventForm[] = [];
  const startDate = new Date(event.date);
  const endDate = repeat.endDate ? new Date(repeat.endDate) : new Date(MAX_REPEAT_END_DATE);

  // 시작일도 포함
  events.push(event);

  let currentDate = new Date(startDate);

  while (true) {
    currentDate = getNextOccurrence(currentDate, repeat.type, repeat.interval);

    if (currentDate > endDate) {
      break;
    }

    events.push({
      ...event,
      date: formatDate(currentDate),
    });
  }

  return events;
}

/**
 * 다음 반복 일정 발생 일자를 계산합니다
 */
function getNextOccurrence(currentDate: Date, repeatType: RepeatType, interval: number): Date {
  const nextDate = new Date(currentDate);

  switch (repeatType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;

    case 'weekly':
      nextDate.setDate(nextDate.getDate() + interval * 7);
      break;

    case 'monthly':
      // 매월 반복: 31일에 매월을 선택한다면 31일에만 생성
      nextDate.setMonth(nextDate.getMonth() + interval);

      // 해당 월에 해당 일자가 없는 경우 (예: 2월 31일) 건너뛰기
      if (nextDate.getDate() !== currentDate.getDate()) {
        // 일자가 맞지 않으면 다음 달로 계속 시도
        return getNextOccurrence(nextDate, repeatType, interval);
      }
      break;

    case 'yearly':
      // 매년 반복: 윤년 29일에 매년을 선택한다면 29일에만 생성
      nextDate.setFullYear(nextDate.getFullYear() + interval);

      // 해당 년도에 해당 일자가 없는 경우 (예: 평년 2월 29일) 건너뛰기
      if (nextDate.getDate() !== currentDate.getDate()) {
        // 일자가 맞지 않으면 다음 년도로 계속 시도
        return getNextOccurrence(nextDate, repeatType, interval);
      }
      break;

    default:
      break;
  }

  return nextDate;
}
