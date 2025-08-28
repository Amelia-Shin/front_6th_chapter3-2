import { http, HttpResponse } from 'msw';

import { server } from '../setupTests';
import { Event } from '../types';

// 기본 이벤트 생성/조회를 위한 mock handler
export const setupMockHandlerCreation = (initEvents = [] as Event[]) => {
  const mockEvents: Event[] = [...initEvents];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events', async ({ request }) => {
      const newEvent = (await request.json()) as Event;
      newEvent.id = String(mockEvents.length + 1);
      mockEvents.push(newEvent);
      return HttpResponse.json(newEvent, { status: 201 });
    }),
    http.post('/api/events-list', async ({ request }) => {
      const { events: newEvents } = (await request.json()) as { events: Event[] };

      const processedEvents = newEvents.map((event, index) => ({
        ...event,
        id: String(mockEvents.length + index + 1),
      }));

      mockEvents.push(...processedEvents);
      return HttpResponse.json(processedEvents, { status: 201 });
    })
  );
};

// 이벤트 수정을 위한 mock handler
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

      if (index > -1) {
        mockEvents[index] = { ...mockEvents[index], ...updatedEvent };
        return HttpResponse.json(mockEvents[index]);
      }
      return new HttpResponse(null, { status: 404 });
    }),
    http.put('/api/events-list', async ({ request }) => {
      const { events: updatedEvents } = (await request.json()) as { events: Event[] };

      updatedEvents.forEach((event) => {
        const eventIndex = mockEvents.findIndex((target) => target.id === event.id);
        if (eventIndex > -1) {
          mockEvents[eventIndex] = { ...mockEvents[eventIndex], ...event };
        }
      });

      return HttpResponse.json(mockEvents);
    })
  );
};

// 이벤트 삭제를 위한 mock handler
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

      if (index > -1) {
        mockEvents.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }
      return new HttpResponse(null, { status: 404 });
    })
  );
};

// 반복 일정 테스트를 위한 mock handler
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

      const processedEvents = newEvents.map((event, index) => ({
        ...event,
        id: String(mockEvents.length + index + 1),
      }));

      mockEvents.push(...processedEvents);
      return HttpResponse.json(processedEvents, { status: 201 });
    }),
    http.put('/api/events-list', async ({ request }) => {
      const { events: updatedEvents } = (await request.json()) as { events: Event[] };

      updatedEvents.forEach((event) => {
        const eventIndex = mockEvents.findIndex((target) => target.id === event.id);
        if (eventIndex > -1) {
          mockEvents[eventIndex] = { ...mockEvents[eventIndex], ...event };
        }
      });

      return HttpResponse.json(mockEvents);
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index > -1) {
        mockEvents.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }
      return new HttpResponse(null, { status: 404 });
    })
  );
};

// 단일 반복 일정 수정/삭제를 위한 mock handler
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
        mockEvents[index] = {
          ...mockEvents[index],
          ...updatedEvent,
          repeat: { type: 'none', interval: 0 },
        };
        return HttpResponse.json(mockEvents[index]);
      }
      return new HttpResponse(null, { status: 404 });
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index > -1) {
        mockEvents.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }
      return new HttpResponse(null, { status: 404 });
    })
  );
};
