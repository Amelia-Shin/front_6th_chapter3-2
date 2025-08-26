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

  const saveRepeatEvents = async (eventData: EventForm, isEditing = false) => {
    const repeatEvents = generateRepeatEvents(eventData);
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? '/api/events-list' : '/api/events-list';

    // 서버의 /api/events-list 엔드포인트를 사용하여 반복 일정을 한 번에 저장/수정
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: repeatEvents }),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${isEditing ? 'update' : 'create'} repeat events`);
    }

    return response;
  };

  const updateRepeatEvents = async (originalEvent: Event, updatedEventData: EventForm) => {
    // 기존 반복 일정들을 찾아서 삭제
    const repeatEvents = events.filter(
      (event) =>
        event.repeat.type !== 'none' &&
        event.title === originalEvent.title &&
        event.startTime === originalEvent.startTime &&
        event.endTime === originalEvent.endTime
    );

    // 기존 반복 일정들 삭제
    for (const event of repeatEvents) {
      await deleteEvent(event.id);
    }

    // 새로운 반복 일정 생성 (editing 분기 처리)
    if (updatedEventData.repeat.type !== 'none') {
      await saveRepeatEvents(updatedEventData, true); // editing 모드로 호출
    } else {
      // 반복을 해제한 경우 단일 일정으로 저장
      await saveSingleEvent(updatedEventData);
    }
  };

  const saveEvent = async (eventData: Event | EventForm) => {
    try {
      const isRepeatEvent = eventData.repeat?.type !== 'none';

      if (editing) {
        // 수정 시에는 반복 일정인지 확인하여 처리
        if (isRepeatEvent) {
          await updateRepeatEvents(eventData as Event, eventData as EventForm);
          enqueueSnackbar('반복 일정이 수정되었습니다.', { variant: 'success' });
        } else {
          await saveSingleEvent(eventData);
          enqueueSnackbar('일정이 수정되었습니다.', { variant: 'success' });
        }
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
