import { http, HttpResponse } from 'msw';

import { server } from '../setupTests';
import { Event } from '../types';

// ! Hard 여기 제공 안함
export const setupMockHandlerCreation = (initEvents = [] as Event[]) => {
  const mockEvents: Event[] = [...initEvents];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events', async ({ request }) => {
      const newEvent = (await request.json()) as Event;
      newEvent.id = String(mockEvents.length + 1); // 간단한 ID 생성
      mockEvents.push(newEvent);
      return HttpResponse.json(newEvent, { status: 201 });
    })
  );
};

export const setupMockHandlerUpdating = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '기존 회의',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '기존 팀 미팅',
      location: '회의실 B',
      category: '업무',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '기존 회의2',
      date: '2025-10-15',
      startTime: '11:00',
      endTime: '12:00',
      description: '기존 팀 미팅 2',
      location: '회의실 C',
      category: '업무',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents[index] = { ...mockEvents[index], ...updatedEvent };
      return HttpResponse.json(mockEvents[index]);
    })
  );
};

export const setupMockHandlerDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '삭제할 이벤트',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '삭제할 이벤트입니다',
      location: '어딘가',
      category: '기타',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    })
  );
};

// 반복 일정 테스트를 위한 모킹 함수들
export const setupMockHandlerRepeatEvents = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '매주 팀 회의',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '주간 팀 미팅',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, endDate: '2025-10-30' },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '매주 팀 회의',
      date: '2025-10-22',
      startTime: '09:00',
      endTime: '10:00',
      description: '주간 팀 미팅',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, endDate: '2025-10-30' },
      notificationTime: 10,
    },
    {
      id: '3',
      title: '매주 팀 회의',
      date: '2025-10-29',
      startTime: '09:00',
      endTime: '10:00',
      description: '주간 팀 미팅',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, endDate: '2025-10-30' },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events-list', async ({ request }) => {
      const { events: newEvents } = (await request.json()) as { events: Event[] };

      const processedEvents = newEvents.map((event) => {
        return {
          ...event,
          repeat: {
            ...event.repeat,
          },
        };
      });

      mockEvents.push(...processedEvents);
      return HttpResponse.json(processedEvents, { status: 201 });
    }),
    http.put('/api/events-list', async ({ request }) => {
      const { events: updatedEvents } = (await request.json()) as { events: Event[] };
      let isUpdated = false;

      const newEvents = [...mockEvents];
      updatedEvents.forEach((event) => {
        const eventIndex = mockEvents.findIndex((target) => target.id === event.id);
        if (eventIndex > -1) {
          isUpdated = true;
          newEvents[eventIndex] = { ...mockEvents[eventIndex], ...event };
        }
      });

      if (isUpdated) {
        // mockEvents 배열 업데이트
        mockEvents.splice(0, mockEvents.length, ...newEvents);
        return HttpResponse.json(mockEvents);
      } else {
        return new HttpResponse(null, { status: 404 });
      }
    }),
    http.delete('/api/events-list', async ({ request }) => {
      const { eventIds } = (await request.json()) as { eventIds: string[] };
      const newEvents = mockEvents.filter((event) => !eventIds.includes(event.id));

      // mockEvents 배열 업데이트
      mockEvents.splice(0, mockEvents.length, ...newEvents);
      return new HttpResponse(null, { status: 204 });
    })
  );
};

export const setupMockHandlerSingleRepeatEvent = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '매주 팀 회의',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '주간 팀 미팅',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, endDate: '2025-10-30' },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index > -1) {
        // 반복 일정을 단일 일정으로 변경
        mockEvents[index] = {
          ...mockEvents[index],
          ...updatedEvent,
          repeat: { type: 'none', interval: 0 },
        };
        return HttpResponse.json(mockEvents[index]);
      } else {
        return new HttpResponse(null, { status: 404 });
      }
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index > -1) {
        mockEvents.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      } else {
        return new HttpResponse(null, { status: 404 });
      }
    })
  );
};
