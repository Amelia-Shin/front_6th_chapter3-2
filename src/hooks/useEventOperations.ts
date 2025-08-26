import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import { Event, EventForm } from '../types';
import { generateRepeatEvents } from '../utils/repeatUtils';

export const useEventOperations = (editing: boolean, onSave?: () => void) => {
  const [events, setEvents] = useState<Event[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const { events } = await response.json();
      setEvents(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      enqueueSnackbar('이벤트 로딩 실패', { variant: 'error' });
    }
  };

  const saveSingleEvent = async (eventData: Event | EventForm) => {
    const url = editing ? `/api/events/${(eventData as Event).id}` : '/api/events';
    const method = editing ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${editing ? 'update' : 'create'} event`);
    }

    return response;
  };

  const saveRepeatEvents = async (eventData: EventForm) => {
    const repeatEvents = generateRepeatEvents(eventData);

    // 서버의 /api/events-list 엔드포인트를 사용하여 반복 일정을 한 번에 저장
    const response = await fetch('/api/events-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: repeatEvents }),
    });

    if (!response.ok) {
      throw new Error('Failed to create repeat events');
    }

    return response;
  };

  const saveEvent = async (eventData: Event | EventForm) => {
    try {
      const isRepeatEvent = eventData.repeat?.type !== 'none';

      if (editing) {
        // 수정 시에는 항상 단일 일정으로 처리
        await saveSingleEvent(eventData);
        enqueueSnackbar('일정이 수정되었습니다.', { variant: 'success' });
      } else {
        // 신규 생성 시 반복/단일 일정 구분
        if (isRepeatEvent) {
          await saveRepeatEvents(eventData as EventForm);
          enqueueSnackbar('반복 일정이 추가되었습니다.', { variant: 'success' });
        } else {
          await saveSingleEvent(eventData);
          enqueueSnackbar('일정이 추가되었습니다.', { variant: 'success' });
        }
      }

      await fetchEvents();
      onSave?.();
    } catch (error) {
      console.error('Error saving event:', error);
      enqueueSnackbar('일정 저장 실패', { variant: 'error' });
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const response = await fetch(`/api/events/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      await fetchEvents();
      enqueueSnackbar('일정이 삭제되었습니다.', { variant: 'info' });
    } catch (error) {
      console.error('Error deleting event:', error);
      enqueueSnackbar('일정 삭제 실패', { variant: 'error' });
    }
  };

  const init = async () => {
    await fetchEvents();
    enqueueSnackbar('일정 로딩 완료!', { variant: 'info' });
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, fetchEvents, saveEvent, deleteEvent };
};
