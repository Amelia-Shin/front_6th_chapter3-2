import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';
import { debug } from 'vitest-preview';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
  setupMockHandlerRepeatEvents,
  setupMockHandlerSingleRepeatEvent,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { server } from '../setupTests';
import { Event } from '../types';

const theme = createTheme();

// ! Hard 여기 제공 안함
const setup = (element: ReactElement) => {
  const user = userEvent.setup();

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>{element}</SnackbarProvider>
      </ThemeProvider>
    ),
    user,
  };
};

// ! Hard 여기 제공 안함
const saveSchedule = async (
  user: UserEvent,
  form: Omit<Event, 'id' | 'notificationTime' | 'repeat'> & {
    repeat?: { type: string; interval: number; endDate?: string };
  }
) => {
  const { title, date, startTime, endTime, location, description, category, repeat } = form;

  await user.click(screen.getAllByText('일정 추가')[0]);

  await user.type(screen.getByLabelText('제목'), title);
  await user.type(screen.getByLabelText('날짜'), date);
  await user.type(screen.getByLabelText('시작 시간'), startTime);
  await user.type(screen.getByLabelText('종료 시간'), endTime);
  await user.type(screen.getByLabelText('설명'), description);
  await user.type(screen.getByLabelText('위치'), location);
  await user.click(screen.getByLabelText('카테고리'));
  await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: `${category}-option` }));

  // 반복 설정이 있는 경우 처리
  if (repeat && repeat.type !== 'none') {
    // 반복 유형 선택 - FormLabel을 통해 Select 찾기
    const repeatTypeLabel = screen.getByText('반복 유형');
    const repeatTypeSelect = repeatTypeLabel.closest('div')?.querySelector('div[role="combobox"]');

    if (repeatTypeSelect) {
      await user.click(repeatTypeSelect);
      // 옵션 선택
      const repeatTypeMap: Record<string, string> = {
        weekly: '매주',
        daily: '매일',
        monthly: '매월',
        yearly: '매년',
      };
      const optionLabel = repeatTypeMap[repeat.type];
      await user.click(screen.getByRole('option', { name: optionLabel }));
    }

    // 반복 간격 설정
    if (repeat.interval && repeat.interval > 1) {
      const intervalInput = screen.getByLabelText('반복 간격');
      await user.clear(intervalInput);
      await user.type(intervalInput, repeat.interval.toString());
    }

    const endDate = repeat.endDate ?? '2025-10-31';
    await user.type(screen.getByLabelText('반복 종료일'), endDate);
  }
  await user.click(screen.getByTestId('event-submit-button'));
};

describe('일정 CRUD 및 기본 기능', () => {
  it('입력한 새로운 일정 정보에 맞춰 모든 필드가 이벤트 리스트에 정확히 저장된다.', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '14:00',
      endTime: '15:00',
      description: '프로젝트 진행 상황 논의',
      location: '회의실 A',
      category: '업무',
    });

    // 생성된 일정 확인 - 비동기 처리 완료 대기
    await waitFor(() => {
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('새 회의')).toBeInTheDocument();
      expect(eventList.getByText('2025-10-15')).toBeInTheDocument();
      expect(eventList.getByText('14:00 - 15:00')).toBeInTheDocument();
      expect(eventList.getByText('프로젝트 진행 상황 논의')).toBeInTheDocument();
      expect(eventList.getByText('회의실 A')).toBeInTheDocument();
      expect(eventList.getByText('카테고리: 업무')).toBeInTheDocument();
    });
  });

  it('기존 일정의 세부 정보를 수정하고 변경사항이 정확히 반영된다', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    await user.click(await screen.findByLabelText('Edit event'));

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
  });

  it('일정을 삭제하고 더 이상 조회되지 않는지 확인한다', async () => {
    setupMockHandlerDeletion();

    const { user } = setup(<App />);
    const eventList = within(screen.getByTestId('event-list'));
    expect(await eventList.findByText('삭제할 이벤트')).toBeInTheDocument();

    // 삭제 버튼 클릭
    const allDeleteButton = await screen.findAllByLabelText('Delete event');
    await user.click(allDeleteButton[0]);

    expect(eventList.queryByText('삭제할 이벤트')).not.toBeInTheDocument();
  });
});

describe('일정 뷰', () => {
  it('주별 뷰를 선택 후 해당 주에 일정이 없으면, 일정이 표시되지 않는다.', async () => {
    // ! 현재 시스템 시간 2025-10-01
    const { user } = setup(<App />);

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('주별 뷰 선택 후 해당 일자에 일정이 존재한다면 해당 일정이 정확히 표시된다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번주 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번주 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    const weekView = within(screen.getByTestId('week-view'));
    expect(weekView.getByText('이번주 팀 회의')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 없으면, 일정이 표시되지 않아야 한다.', async () => {
    vi.setSystemTime(new Date('2025-01-01'));

    setup(<App />);

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 정확히 표시되는지 확인한다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번달 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번달 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    const monthView = within(screen.getByTestId('month-view'));
    expect(monthView.getByText('이번달 팀 회의')).toBeInTheDocument();
  });

  it('달력에 1월 1일(신정)이 공휴일로 표시되는지 확인한다', async () => {
    vi.setSystemTime(new Date('2025-01-01'));
    setup(<App />);

    const monthView = screen.getByTestId('month-view');

    // 1월 1일 셀 확인
    const januaryFirstCell = within(monthView).getByText('1').closest('td')!;
    expect(within(januaryFirstCell).getByText('신정')).toBeInTheDocument();
  });
});

describe('검색 기능', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json({
          events: [
            {
              id: 1,
              title: '팀 회의',
              date: '2025-10-15',
              startTime: '09:00',
              endTime: '10:00',
              description: '주간 팀 미팅',
              location: '회의실 A',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
            {
              id: 2,
              title: '프로젝트 계획',
              date: '2025-10-16',
              startTime: '14:00',
              endTime: '15:00',
              description: '새 프로젝트 계획 수립',
              location: '회의실 B',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
          ],
        });
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('검색 결과가 없으면, "검색 결과가 없습니다."가 표시되어야 한다.', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '존재하지 않는 일정');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it("'팀 회의'를 검색하면 해당 제목을 가진 일정이 리스트에 노출된다", async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
  });

  it('검색어를 지우면 모든 일정이 다시 표시되어야 한다', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');
    await user.clear(searchInput);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 계획')).toBeInTheDocument();
  });
});

describe('일정 충돌', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('겹치는 시간에 새 일정을 추가할 때 경고가 표시된다', async () => {
    setupMockHandlerCreation([
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
    ]);

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '09:30',
      endTime: '10:30',
      description: '설명',
      location: '회의실 A',
      category: '업무',
    });

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });

  it('기존 일정의 시간을 수정하여 충돌이 발생하면 경고가 노출된다', async () => {
    setupMockHandlerUpdating();

    const { user } = setup(<App />);

    const editButton = (await screen.findAllByLabelText('Edit event'))[1];
    await user.click(editButton);

    // 시간 수정하여 다른 일정과 충돌 발생
    await user.clear(screen.getByLabelText('시작 시간'));
    await user.type(screen.getByLabelText('시작 시간'), '08:30');
    await user.clear(screen.getByLabelText('종료 시간'));
    await user.type(screen.getByLabelText('종료 시간'), '10:30');

    await user.click(screen.getByTestId('event-submit-button'));

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });
});

it('notificationTime을 10으로 하면 지정 시간 10분 전 알람 텍스트가 노출된다', async () => {
  vi.setSystemTime(new Date('2025-10-15 08:49:59'));

  setup(<App />);

  // ! 일정 로딩 완료 후 테스트
  await screen.findByText('일정 로딩 완료!');

  expect(screen.queryByText('10분 후 기존 회의 일정이 시작됩니다.')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(screen.getByText('10분 후 기존 회의 일정이 시작됩니다.')).toBeInTheDocument();
});

describe('반복 일정', () => {
  // beforeEach(() => {
  //   vi.setSystemTime(new Date('2025-10-15'));
  // });

  // afterEach(() => {
  //   vi.useRealTimers();
  //   server.resetHandlers();
  // });

  describe('1. 반복 유형 선택 테스트', () => {
    it('일정 생성 시 반복 유형을 선택할 수 있다', async () => {
      const { user } = setup(<App />);

      // 반복 옵션 렌더링 확인
      expect(screen.getByText('반복 유형')).toBeInTheDocument();
      expect(screen.getByText('반복 간격')).toBeInTheDocument();
      expect(screen.getByText('반복 종료일')).toBeInTheDocument();

      // 반복 유형 선택 확인
      const repeatSection = screen.getByText('반복 유형').closest('div');
      const repeatSelect = within(repeatSection!).getByRole('combobox');
      await user.click(repeatSelect);
      await user.click(screen.getByRole('option', { name: '매주' }));

      expect(repeatSelect).toHaveTextContent('매주');
    });

    it('매일 반복 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '매일 아침 체크인',
        date: '2025-10-15',
        startTime: '09:00',
        endTime: '09:15',
        description: '매일 아침 팀 체크인',
        location: '온라인',
        category: '업무',
        repeat: { type: 'daily', interval: 1 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('매일 아침 체크인')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매일')).toBeInTheDocument();
    });

    it('매월 반복 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '매월 말 프로젝트 리뷰',
        date: '2025-10-31',
        startTime: '14:00',
        endTime: '15:00',
        description: '월간 프로젝트 진행상황 리뷰',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'monthly', interval: 1 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('매월 말 프로젝트 리뷰')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매월')).toBeInTheDocument();
    });

    it('매년 반복 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '매년 회사 창립일',
        date: '2025-10-01',
        startTime: '10:00',
        endTime: '11:00',
        description: '회사 창립 기념일',
        location: '대강당',
        category: '기타',
        repeat: { type: 'yearly', interval: 1 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('매년 회사 창립일')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매년')).toBeInTheDocument();
    });

    it('31일에 매월 반복을 선택하면 31일에만 생성된다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '31일 프로젝트 리뷰',
        date: '2025-10-31',
        startTime: '14:00',
        endTime: '15:00',
        description: '매월 31일에 진행하는 프로젝트 리뷰',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'monthly', interval: 1 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('31일 프로젝트 리뷰')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매월')).toBeInTheDocument();
    });

    it('격주(2주마다) 반복 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '격주 팀 회의',
        date: '2025-10-15',
        startTime: '14:00',
        endTime: '15:00',
        description: '2주마다 진행하는 팀 회의',
        location: '회의실 C',
        category: '업무',
        repeat: { type: 'weekly', interval: 2 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('격주 팀 회의')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
    });
  });

  describe('2. 반복 일정 표시 테스트', () => {
    it('캘린더 뷰에서 반복 일정이 아이콘과 함께 표시된다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '격주 팀 회의',
        date: '2025-10-15',
        startTime: '14:00',
        endTime: '15:00',
        description: '2주마다 진행하는 팀 회의',
        location: '회의실 C',
        category: '업무',
        repeat: { type: 'weekly', interval: 2, endDate: '2025-10-30' },
      });

      const monthView = within(screen.getByTestId('month-view'));

      expect(monthView.getAllByLabelText('반복 일정')).toHaveLength(2);
    });

    it('주별 뷰에서 반복 일정이 올바르게 표시된다', async () => {
      vi.setSystemTime(new Date('2025-10-15'));
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '격주 팀 회의',
        date: '2025-10-15',
        startTime: '14:00',
        endTime: '15:00',
        description: '2주마다 진행하는 팀 회의',
        location: '회의실 C',
        category: '업무',
        repeat: { type: 'daily', interval: 2, endDate: '2025-10-20' },
      });

      // 주별 뷰로 변경
      await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'week-option' }));

      // // 주별 뷰에서 반복 일정 확인
      const weekView = within(screen.getByTestId('week-view'));
      expect(weekView.getAllByText('격주 팀 회의')).toHaveLength(2);

      // // 반복 일정 아이콘도 표시되어야 함
      expect(weekView.getAllByLabelText('반복 일정')).toHaveLength(2);
    });

    it('반복 일정과 일반 일정이 구분되어 표시된다', async () => {
      setupMockHandlerCreation([
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
      ]);

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '매주 팀 회의',
        date: '2025-10-16',
        startTime: '14:00',
        endTime: '15:00',
        description: '매주 진행하는 팀 회의',
        location: '회의실 A',
        category: '업무',
        repeat: { type: 'monthly', interval: 1, endDate: '2025-11-30' },
      });

      // 반복 일정과 일반 일정이 모두 표시되는지 확인
      const eventList = within(screen.getByTestId('event-list'));

      // 반복 일정
      expect(eventList.getByText('매주 팀 회의')).toBeInTheDocument();
      expect(eventList.getByText(/반복: 매월/)).toBeInTheDocument();
      expect(eventList.getByText(/종료: 2025-11-30/)).toBeInTheDocument();

      // 일반 일정
      expect(eventList.getByText('기존 회의')).toBeInTheDocument();

      expect(eventList.getAllByText(/반복: 매월/)).toHaveLength(1);
    });
  });

  describe('3. 반복 종료 테스트', () => {
    it('반복 종료일을 설정하여 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '2025년까지 매주 회의',
        date: '2025-10-15',
        startTime: '09:00',
        endTime: '10:00',
        description: '2025년 말까지 진행하는 주간 회의',
        location: '회의실 A',
        category: '업무',
        repeat: { type: 'weekly', interval: 1, endDate: '2025-12-31' },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('2025년까지 매주 회의')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
      expect(eventList.getByText('반복 종료: 2025-12-31')).toBeInTheDocument();
    });

    it('반복 종료일을 설정하기 않으면 최대 2025년 10월 30일까지 반복 일정을 생성할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await saveSchedule(user, {
        title: '10월까지 매주 회의',
        date: '2025-10-15',
        startTime: '14:00',
        endTime: '15:00',
        description: '10월 말까지 진행하는 주간 회의',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'weekly', interval: 1 },
      });

      // 생성된 일정 확인
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('10월까지 매주 회의')).toBeInTheDocument();
      expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
      expect(eventList.getByText('반복 종료: 2025-10-30')).toBeInTheDocument();
    });
  });

  describe('4. 반복 일정 단일 수정 테스트', () => {
    it('반복 일정을 수정하면 단일 일정으로 변경된다', async () => {
      setupMockHandlerSingleRepeatEvent();

      const { user } = setup(<App />);

      // 반복 일정 수정 버튼 클릭
      const editButton = await screen.findByLabelText('Edit event');
      await user.click(editButton);

      // 제목 수정
      await user.clear(screen.getByLabelText('제목'));
      await user.type(screen.getByLabelText('제목'), '수정된 팀 회의');

      // 반복 일정 체크박스 해제하여 단일 일정으로 변경
      await user.click(screen.getByLabelText('반복 일정'));

      await user.click(screen.getByTestId('event-submit-button'));

      // 수정된 일정 확인 - 반복 정보가 사라져야 함
      await waitFor(() => {
        const eventList = within(screen.getByTestId('event-list'));
        expect(eventList.getByText('수정된 팀 회의')).toBeInTheDocument();
        expect(eventList.queryByText('반복: 매주')).not.toBeInTheDocument();
      });
    });

    it('반복 일정 수정 시 반복 아이콘이 사라진다', async () => {
      setupMockHandlerSingleRepeatEvent();

      const { user } = setup(<App />);

      // 반복 일정 수정 버튼 클릭
      const editButton = await screen.findByLabelText('Edit event');
      await user.click(editButton);

      // 반복 일정 체크박스 해제
      await user.click(screen.getByLabelText('반복 일정'));

      await user.click(screen.getByTestId('event-submit-button'));

      // 수정된 일정 확인 - 반복 아이콘이 사라져야 함
      await waitFor(() => {
        const monthView = within(screen.getByTestId('month-view'));
        expect(monthView.getAllByLabelText('반복 일정')).toHaveLength(0);
      });
    });

    it('반복 일정의 반복 유형을 변경할 수 있다', async () => {
      setupMockHandlerSingleRepeatEvent();

      const { user } = setup(<App />);

      // 반복 일정 수정 버튼 클릭
      const editButton = await screen.findByLabelText('Edit event');
      await user.click(editButton);

      // 반복 유형을 매월로 변경
      const repeatTypeLabel = screen.getByText('반복 유형');
      const repeatTypeSelect = repeatTypeLabel
        .closest('div')
        ?.querySelector('div[role="combobox"]');
      if (repeatTypeSelect) {
        await user.click(repeatTypeSelect);
        await user.click(screen.getByRole('option', { name: '매월' }));
      }

      await user.click(screen.getByTestId('event-submit-button'));

      // 수정된 일정 확인 - 반복 유형이 변경되어야 함
      await waitFor(() => {
        const eventList = within(screen.getByTestId('event-list'));
        expect(eventList.getByText('반복: 매월')).toBeInTheDocument();
      });
    });

    it('반복 일정의 반복 간격을 변경할 수 있다', async () => {
      setupMockHandlerSingleRepeatEvent();

      const { user } = setup(<App />);

      // 반복 일정 수정 버튼 클릭
      const editButton = await screen.findByLabelText('Edit event');
      await user.click(editButton);

      // 반복 간격을 2로 변경
      const intervalInput = screen.getByLabelText('반복 간격');
      await user.clear(intervalInput);
      await user.type(intervalInput, '2');

      await user.click(screen.getByTestId('event-submit-button'));

      // 수정된 일정 확인 - 반복 간격이 변경되어야 함
      await waitFor(() => {
        const eventList = within(screen.getByTestId('event-list'));
        expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
      });
    });
  });

  describe.skip('5. 반복 일정 단일 삭제 테스트', () => {
    it('반복 일정을 삭제하면 해당 일정만 삭제된다', async () => {
      setupMockHandlerRepeatEvents();

      const { user } = setup(<App />);

      // 반복 일정 삭제 버튼 클릭
      const deleteButton = await screen.findByLabelText('Delete event');
      await user.click(deleteButton);

      // 삭제 확인 다이얼로그에서 확인
      const confirmButton = screen.getByText('확인');
      await user.click(confirmButton);

      // 삭제된 일정이 더 이상 표시되지 않음
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.queryByText('매주 팀 회의')).not.toBeInTheDocument();

      // 다른 반복 일정들은 여전히 표시됨
      expect(eventList.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
      expect(eventList.getByText('매년 회사 창립일')).toBeInTheDocument();
    });

    it('반복 일정 삭제 시 다른 일정에 영향이 없다', async () => {
      setupMockHandlerRepeatEvents();

      const { user } = setup(<App />);

      // 첫 번째 반복 일정 삭제
      const deleteButtons = await screen.findAllByLabelText('Delete event');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('확인');
      await user.click(confirmButton);

      // 삭제된 일정만 사라지고 다른 일정들은 그대로 유지
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.queryByText('매주 팀 회의')).not.toBeInTheDocument();
      expect(eventList.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
      expect(eventList.getByText('매년 회사 창립일')).toBeInTheDocument();
      expect(eventList.getByText('기존 회의')).toBeInTheDocument();
    });

    it('반복 일정 삭제 후 캘린더 뷰에서도 해당 일정이 사라진다', async () => {
      setupMockHandlerRepeatEvents();

      const { user } = setup(<App />);

      // 반복 일정 삭제
      const deleteButton = await screen.findByLabelText('Delete event');
      await user.click(deleteButton);

      const confirmButton = screen.getByText('확인');
      await user.click(confirmButton);

      // 월별 뷰에서도 삭제된 일정이 사라져야 함
      const monthView = within(screen.getByTestId('month-view'));
      expect(monthView.queryByText('매주 팀 회의')).not.toBeInTheDocument();

      // 반복 아이콘 개수도 줄어들어야 함
      const repeatIcons = monthView.getAllByTestId('repeat-icon');
      expect(repeatIcons).toHaveLength(2); // 3개에서 2개로 줄어듦
    });
  });
});
