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

    // 반복 일정은 항상 새로 생성하므로 POST 사용 (기존 일정은 이미 삭제됨)
    const method = 'POST';
    const url = '/api/events-list';

    // 서버의 /api/events-list 엔드포인트를 사용하여 반복 일정을 한 번에 저장
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
    console.log('🔍 updateRepeatEvents 시작');

    // 기존 일정을 찾아서 삭제 (단일 일정 -> 반복 일정 변경 케이스 포함)
    let eventsToDelete: Event[] = [];

    console.log('🔍 originalEvent.repeat.type:', originalEvent.repeat.type);

    if (originalEvent.repeat.type === 'none') {
      // 단일 일정을 반복 일정으로 변경하는 경우: 기존 단일 일정 삭제
      eventsToDelete = events.filter((event) => event.id === originalEvent.id);
      console.log('🔍 삭제할 단일 일정:', {
        originalId: originalEvent.id,
        foundEvents: eventsToDelete.length,
        allEventIds: events.map((e) => e.id),
      });
    } else {
      // 기존 반복 일정을 수정하는 경우: 간단하게 해당 일정만 삭제
      // (새로운 반복 일정들이 생성될 것이므로 기존 것만 삭제하면 됨)
      console.log('🔍 기존 반복 일정 수정 케이스 - 해당 일정만 삭제');
      eventsToDelete = events.filter((event) => event.id === originalEvent.id);
      console.log('🔍 삭제할 일정:', eventsToDelete.length, originalEvent.id);
    }

    // 기존 일정들 삭제 (fetchEvents 호출 없이)
    for (const event of eventsToDelete) {
      console.log('🔍 삭제 요청 중:', event.id);
      try {
        const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
        console.log('🔍 삭제 응답:', response.status, response.ok);
        if (!response.ok) {
          throw new Error('Failed to delete event');
        }
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    }

    console.log('🔍 삭제 완료, 새로운 일정 생성 시작');

    // 새로운 일정 생성
    if (updatedEventData.repeat.type !== 'none') {
      // 반복 일정으로 생성
      console.log('🔍 새로운 반복 일정 생성');
      await saveRepeatEvents(updatedEventData, true);
    } else {
      // 단일 일정으로 생성 (반복 해제)
      console.log('🔍 새로운 단일 일정 생성');
      await saveSingleEvent(updatedEventData);
    }

    console.log('🔍 updateRepeatEvents 완료');
  };

  const saveEvent = async (eventData: Event | EventForm) => {
    console.log('🔍 saveEvent 호출됨:', {
      editing,
      eventData,
      hasId: !!(eventData as Event).id,
      repeatType: eventData.repeat?.type,
    });

    try {
      const isRepeatEvent = eventData.repeat?.type !== 'none';

      if (editing) {
        // 수정 시에는 기존 일정이 반복이거나 새로운 일정이 반복이면 updateRepeatEvents 호출
        const originalEvent = eventData as Event;
        const wasRepeatEvent = originalEvent.repeat?.type !== 'none';

        console.log('🔍 editing 모드:', {
          wasRepeatEvent,
          isRepeatEvent,
          willCallUpdateRepeatEvents: wasRepeatEvent || isRepeatEvent,
        });

        if (wasRepeatEvent || isRepeatEvent) {
          // 기존이 반복이거나 새로운게 반복이면 updateRepeatEvents 호출
          console.log('🔍 updateRepeatEvents 호출 예정');
          await updateRepeatEvents(originalEvent, eventData as EventForm);
          enqueueSnackbar('일정이 수정되었습니다.', { variant: 'success' });
        } else {
          // 둘 다 단일 일정인 경우만 saveSingleEvent 호출
          console.log('🔍 saveSingleEvent 호출 예정');
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
